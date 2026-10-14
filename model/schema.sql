-- ============================================================================
-- SIFCE - Sistema Inteligente de Filtro y Contratación Empresarial
-- Esquema de base de datos - PostgreSQL
--
-- Cubre las entidades exigidas por el SRS (IEEE 830): empresas, usuarios,
-- roles, candidatos, formación, experiencia, habilidades, idiomas,
-- certificaciones, vacantes, requisitos, postulaciones, hojas de vida,
-- criterios de evaluación, etapas del proceso, resultados de IA,
-- compatibilidades y logs de actividad (RNF-S5).
--
-- Aislamiento por empresa: toda tabla que contiene datos propios de una
-- empresa lleva company_id con FK e índice, y TODAS las consultas del
-- backend filtran obligatoriamente por ese campo (ver src/middleware y
-- src/controllers). El superadministrador es la única excepción: no
-- pertenece a ninguna empresa (company_id NULL).
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Tipos enumerados
-- ----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('superadmin', 'company_admin', 'recruiter', 'candidate');
CREATE TYPE company_status AS ENUM ('active', 'inactive');
CREATE TYPE vacancy_status AS ENUM ('draft', 'active', 'closed');
CREATE TYPE vacancy_modality AS ENUM ('presencial', 'remoto', 'hibrido');
-- 'retirado' es un estado distinto de 'rechazado': lo establece el propio
-- candidato al retirar su postulación, no la empresa.
CREATE TYPE application_status AS ENUM ('postulado', 'en_revision', 'preseleccionado', 'entrevista', 'seleccionado', 'rechazado', 'retirado');
CREATE TYPE resume_status AS ENUM ('uploaded', 'extracted', 'extraction_failed');
CREATE TYPE ai_analysis_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ----------------------------------------------------------------------------
-- Empresas (RF04, RF19)
-- ----------------------------------------------------------------------------
CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    sector          VARCHAR(150),
    description     TEXT,
    location        VARCHAR(200),
    contact_email   VARCHAR(200),
    contact_phone   VARCHAR(50),
    status          company_status NOT NULL DEFAULT 'active',
    -- Código único que la empresa entrega a sus candidatos para vincularse a
    -- su entorno privado. Nunca se expone una lista pública de empresas ni
    -- de vacantes: el único punto de entrada de un candidato a una empresa
    -- es conocer este código (Sección "sistema privado y segmentado").
    access_code     VARCHAR(12) NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Usuarios y roles (RF01, RF02, RF03, RF18)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL para superadmin
    role            user_role NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    email           VARCHAR(200) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    -- Bloqueo por intentos fallidos (protección contra fuerza bruta):
    failed_login_attempts  INTEGER NOT NULL DEFAULT 0,
    locked_until            TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_company_role CHECK (
        (role = 'superadmin' AND company_id IS NULL) OR
        (role <> 'superadmin' AND company_id IS NOT NULL) OR
        (role = 'candidate') -- candidatos no pertenecen a una empresa
    )
);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- Códigos OTP de verificación en dos pasos (segundo factor en el login)
--
-- Tras validar correo y contraseña, si el segundo factor está habilitado
-- (OTP_ENABLED, ver backend/.env.example) se genera un código de un solo uso
-- de 6 dígitos, se guarda SOLO su hash (nunca el código en texto plano) y se
-- envía al correo del usuario (o se imprime en la consola del backend en
-- modo demo, ver services/notify/). La sesión (JWT) recién se emite después
-- de verificar el código correcto.
-- ----------------------------------------------------------------------------
CREATE TABLE login_otp_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash       VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    attempts        INTEGER NOT NULL DEFAULT 0,
    consumed        BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_user ON login_otp_codes(user_id);

-- ----------------------------------------------------------------------------
-- Perfil de candidato (RF06)
-- ----------------------------------------------------------------------------
CREATE TABLE candidate_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    phone           VARCHAR(50),
    location        VARCHAR(200),
    headline        VARCHAR(200),
    summary         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE candidate_education (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    institution     VARCHAR(200) NOT NULL,
    degree          VARCHAR(200) NOT NULL,
    field_of_study  VARCHAR(200),
    year_completed  INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_education_candidate ON candidate_education(candidate_id);

CREATE TABLE candidate_experience (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    company_name    VARCHAR(200) NOT NULL,
    position        VARCHAR(200) NOT NULL,
    years           NUMERIC(4,1) NOT NULL DEFAULT 0,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_experience_candidate ON candidate_experience(candidate_id);

CREATE TABLE candidate_skills (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    type            VARCHAR(20) NOT NULL DEFAULT 'tecnica', -- tecnica | blanda
    level           VARCHAR(30)
);
CREATE INDEX idx_skills_candidate ON candidate_skills(candidate_id);

CREATE TABLE candidate_languages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    language        VARCHAR(100) NOT NULL,
    level           VARCHAR(30) NOT NULL DEFAULT 'basico'
);
CREATE INDEX idx_languages_candidate ON candidate_languages(candidate_id);

CREATE TABLE candidate_certifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    issuer          VARCHAR(200),
    year            INTEGER
);
CREATE INDEX idx_certifications_candidate ON candidate_certifications(candidate_id);

-- ----------------------------------------------------------------------------
-- Vinculación candidato-empresa (modelo privado por código de acceso)
--
-- El candidato tiene UNA sola cuenta e identidad en la plataforma. Para
-- operar dentro del entorno de una empresa debe vincularse primero mediante
-- el código único de esa empresa (companies.access_code). Cada vínculo es
-- independiente: un candidato puede estar vinculado a varias empresas, pero
-- cada una es un entorno aislado (sin vacantes ni postulaciones cruzadas).
-- No existe ninguna tabla ni vista que liste vacantes o empresas sin que el
-- candidato esté vinculado primero.
-- ----------------------------------------------------------------------------
CREATE TABLE candidate_company_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    linked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(candidate_id, company_id)
);
CREATE INDEX idx_links_candidate ON candidate_company_links(candidate_id);
CREATE INDEX idx_links_company ON candidate_company_links(company_id);

-- ----------------------------------------------------------------------------
-- Hojas de vida (RF07)
-- ----------------------------------------------------------------------------
CREATE TABLE resumes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    file_name           VARCHAR(255) NOT NULL,
    file_path           VARCHAR(500) NOT NULL,
    file_size_bytes     INTEGER NOT NULL,
    status              resume_status NOT NULL DEFAULT 'uploaded',
    extracted_text      TEXT,
    extraction_error    TEXT,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resumes_candidate ON resumes(candidate_id);

-- ----------------------------------------------------------------------------
-- Criterios de evaluación por empresa (RF14)
-- ----------------------------------------------------------------------------
CREATE TABLE evaluation_criteria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    category        VARCHAR(30) NOT NULL, -- formacion | experiencia | habilidades | idiomas
    name            VARCHAR(150) NOT NULL,
    weight          NUMERIC(5,2) NOT NULL DEFAULT 25.0, -- % de peso dentro del cálculo global
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_weight CHECK (weight >= 0 AND weight <= 100)
);
CREATE INDEX idx_criteria_company ON evaluation_criteria(company_id);

-- ----------------------------------------------------------------------------
-- Etapas configurables del proceso de selección (RF15)
-- ----------------------------------------------------------------------------
CREATE TABLE selection_stages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    status_code     application_status NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    description     TEXT,
    UNIQUE(company_id, status_code)
);
CREATE INDEX idx_stages_company ON selection_stages(company_id);

-- ----------------------------------------------------------------------------
-- Vacantes (RF05) y sus requisitos
-- ----------------------------------------------------------------------------
CREATE TABLE vacancies (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    title                   VARCHAR(200) NOT NULL,
    description             TEXT,
    required_education      VARCHAR(200),
    min_experience_years    NUMERIC(4,1) NOT NULL DEFAULT 0,
    required_skills         JSONB NOT NULL DEFAULT '[]', -- [{"name":"SQL","weight":1}]
    required_languages      JSONB NOT NULL DEFAULT '[]', -- [{"language":"Inglés","level":"intermedio"}]
    salary                  VARCHAR(100),
    modality                vacancy_modality NOT NULL DEFAULT 'presencial',
    status                  vacancy_status NOT NULL DEFAULT 'draft',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vacancies_company ON vacancies(company_id);
CREATE INDEX idx_vacancies_status ON vacancies(status);

-- ----------------------------------------------------------------------------
-- Postulaciones (RF08, RF13, RF17)
-- ----------------------------------------------------------------------------
CREATE TABLE applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vacancy_id      UUID NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
    candidate_id    UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    resume_id       UUID REFERENCES resumes(id) ON DELETE SET NULL,
    status          application_status NOT NULL DEFAULT 'postulado',
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(vacancy_id, candidate_id) -- evita postulación duplicada
);
CREATE INDEX idx_applications_vacancy ON applications(vacancy_id);
CREATE INDEX idx_applications_candidate ON applications(candidate_id);

CREATE TABLE application_stage_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    from_status     application_status,
    to_status       application_status NOT NULL,
    changed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stage_history_application ON application_stage_history(application_id);

-- ----------------------------------------------------------------------------
-- Resultados del análisis de IA y compatibilidad (RF09, RF10, RF11)
-- ----------------------------------------------------------------------------
CREATE TABLE ai_analysis_results (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id          UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
    status                  ai_analysis_status NOT NULL DEFAULT 'pending',
    provider                VARCHAR(50) NOT NULL DEFAULT 'mock',
    overall_score           NUMERIC(5,2),          -- % de compatibilidad global
    education_score         NUMERIC(5,2),
    experience_score        NUMERIC(5,2),
    skills_score            NUMERIC(5,2),
    languages_score         NUMERIC(5,2),
    strengths               JSONB NOT NULL DEFAULT '[]',
    gaps                    JSONB NOT NULL DEFAULT '[]',
    explanation             TEXT,
    raw_extracted_profile   JSONB,                 -- lo que la IA extrajo del CV
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at            TIMESTAMPTZ
);
CREATE INDEX idx_ai_results_application ON ai_analysis_results(application_id);

-- ----------------------------------------------------------------------------
-- Log de actividad (RNF-S5)
-- ----------------------------------------------------------------------------
CREATE TABLE activity_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       UUID,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_logs_company ON activity_logs(company_id);
CREATE INDEX idx_logs_user ON activity_logs(user_id);
CREATE INDEX idx_logs_created ON activity_logs(created_at);

COMMIT;
