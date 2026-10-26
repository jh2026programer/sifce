/* eslint-disable no-console */
// Script de datos de demostración (Sección 22). Ejecutar con: npm run db:seed
// Crea una empresa, un administrador, un reclutador, tres candidatos con
// hojas de vida (PDF reales generados en el momento), dos vacantes activas,
// criterios de evaluación, etapas y postulaciones ya postuladas para poder
// ver el ranking y la comparación funcionando de inmediato.
const fs = require('fs');
const path = require('path');
const db = require('../db');
const authService = require('../../whatever/services/authService');
const compatibilityService = require('../../whatever/services/compatibilityService');
const microservicios = require('../../whatever/services/microservicios');
const config = require('../../whatever/config/env');

const DEMO_PASSWORD = 'Demo1234!';

// --- Generador mínimo de PDF válido (una página, texto plano en Helvetica) ---
// Se usa solo para poblar datos demo con un archivo real que pdf-parse pueda
// leer, sin depender de una librería adicional de generación de PDF.
function buildSimplePdf(lines) {
  const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const contentLines = lines
    .map((line, i) => `${i === 0 ? '50 750 Td' : '0 -16 Td'} (${escape(line)}) Tj`)
    .join('\n');
  const stream = `BT /F1 11 Tf\n${contentLines}\nET`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

async function upsertUser(client, { companyId, role, fullName, email, password }) {
  const existing = await client.query('SELECT * FROM users WHERE email = $1', [email]);
  if (existing.rows[0]) return existing.rows[0];
  const hash = await authService.hashPassword(password);
  const { rows } = await client.query(
    `INSERT INTO users (company_id, role, full_name, email, password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [companyId, role, fullName, email, hash]
  );
  return rows[0];
}

async function createCandidateWithResume(client, { fullName, email, headline, location, education, experience, skills, languages, certifications, resumeLines }) {
  const user = await upsertUser(client, { companyId: null, role: 'candidate', fullName, email, password: DEMO_PASSWORD });

  let profile = (await client.query('SELECT * FROM candidate_profiles WHERE user_id = $1', [user.id])).rows[0];
  if (!profile) {
    profile = (
      await client.query(
        `INSERT INTO candidate_profiles (user_id, headline, location) VALUES ($1,$2,$3) RETURNING *`,
        [user.id, headline, location]
      )
    ).rows[0];

    for (const e of education) {
      await client.query(
        `INSERT INTO candidate_education (candidate_id, institution, degree, field_of_study, year_completed) VALUES ($1,$2,$3,$4,$5)`,
        [profile.id, e.institution, e.degree, e.fieldOfStudy, e.year]
      );
    }
    for (const e of experience) {
      await client.query(
        `INSERT INTO candidate_experience (candidate_id, company_name, position, years, description) VALUES ($1,$2,$3,$4,$5)`,
        [profile.id, e.companyName, e.position, e.years, e.description || null]
      );
    }
    for (const s of skills) {
      await client.query(`INSERT INTO candidate_skills (candidate_id, name, type) VALUES ($1,$2,$3)`, [profile.id, s.name, s.type || 'tecnica']);
    }
    for (const l of languages) {
      await client.query(`INSERT INTO candidate_languages (candidate_id, language, level) VALUES ($1,$2,$3)`, [profile.id, l.language, l.level]);
    }
    for (const c of certifications) {
      await client.query(`INSERT INTO candidate_certifications (candidate_id, name, issuer, year) VALUES ($1,$2,$3,$4)`, [profile.id, c.name, c.issuer, c.year]);
    }
  }

  let resume = (await client.query('SELECT * FROM resumes WHERE candidate_id = $1', [profile.id])).rows[0];
  if (!resume) {
    const { uploadDir } = config.resume;
    fs.mkdirSync(uploadDir, { recursive: true });
    const fileName = `demo-cv-${user.id}.pdf`;
    const filePath = path.join(uploadDir, fileName);
    const pdfBuffer = buildSimplePdf(resumeLines);
    fs.writeFileSync(filePath, pdfBuffer);

    const extraction = await microservicios.validarCv(pdfBuffer);
    resume = (
      await client.query(
        `INSERT INTO resumes (candidate_id, file_name, file_path, file_size_bytes, status, extracted_text, extraction_error)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [profile.id, fileName, filePath, pdfBuffer.length, extraction.success ? 'extracted' : 'extraction_failed', extraction.text, extraction.error]
      )
    ).rows[0];
  }

  return { user, profile, resume };
}

async function applyIfMissing(client, { vacancyId, candidateId, resumeId }) {
  const existing = await client.query('SELECT * FROM applications WHERE vacancy_id = $1 AND candidate_id = $2', [vacancyId, candidateId]);
  if (existing.rows[0]) return existing.rows[0];

  const { rows } = await client.query(
    `INSERT INTO applications (vacancy_id, candidate_id, resume_id, status) VALUES ($1,$2,$3,'postulado') RETURNING *`,
    [vacancyId, candidateId, resumeId]
  );
  await client.query(
    `INSERT INTO application_stage_history (application_id, from_status, to_status) VALUES ($1, NULL, 'postulado')`,
    [rows[0].id]
  );
  await client.query(`INSERT INTO ai_analysis_results (application_id, status) VALUES ($1, 'pending')`, [rows[0].id]);
  return rows[0];
}

async function main() {
  const client = await db.getClient();
  try {
    console.log('Sembrando datos de demostración...');

    // --- Superadministrador (bootstrap manual: no se autorregistra) ---
    await upsertUser(client, {
      companyId: null,
      role: 'superadmin',
      fullName: 'Super Administrador SIFCE',
      email: 'superadmin@sifce.demo',
      password: DEMO_PASSWORD,
    });

    // --- Empresa demo ---
    let company = (await client.query(`SELECT * FROM companies WHERE name = 'TechNova Soluciones S.A.S.'`)).rows[0];
    if (!company) {
      company = (
        await client.query(
          `INSERT INTO companies (name, sector, description, location, contact_email, status, access_code)
           VALUES ($1,$2,$3,$4,$5,'active',$6) RETURNING *`,
          [
            'TechNova Soluciones S.A.S.',
            'Tecnología',
            'Empresa de desarrollo de software para el sector financiero.',
            'Bucaramanga, Colombia',
            'contacto@technova.demo',
            'TECHNOVA24',
          ]
        )
      ).rows[0];

      const defaultStages = [
        ['Postulado', 'postulado', 1], ['En revisión', 'en_revision', 2], ['Preseleccionado', 'preseleccionado', 3],
        ['Entrevista', 'entrevista', 4], ['Seleccionado', 'seleccionado', 5], ['Rechazado', 'rechazado', 6],
      ];
      for (const [name, code, order] of defaultStages) {
        await client.query(
          `INSERT INTO selection_stages (company_id, name, status_code, sort_order) VALUES ($1,$2,$3,$4)`,
          [company.id, name, code, order]
        );
      }

      await client.query(
        `INSERT INTO evaluation_criteria (company_id, category, name, weight) VALUES
         ($1,'formacion','Formación académica',25), ($1,'experiencia','Experiencia laboral',30),
         ($1,'habilidades','Habilidades técnicas',30), ($1,'idiomas','Idiomas',15)`,
        [company.id]
      );
    }

    // --- Segunda empresa demo (para mostrar entornos privados independientes) ---
    let company2 = (await client.query(`SELECT * FROM companies WHERE name = 'Grupo Andino Retail S.A.S.'`)).rows[0];
    if (!company2) {
      company2 = (
        await client.query(
          `INSERT INTO companies (name, sector, description, location, contact_email, status, access_code)
           VALUES ($1,$2,$3,$4,$5,'active',$6) RETURNING *`,
          [
            'Grupo Andino Retail S.A.S.', 'Retail',
            'Cadena de tiendas de moda con presencia en el oriente colombiano.',
            'Bucaramanga, Colombia', 'contacto@andino.demo', 'ANDINO24',
          ]
        )
      ).rows[0];

      const defaultStages2 = [
        ['Postulado', 'postulado', 1], ['En revisión', 'en_revision', 2], ['Preseleccionado', 'preseleccionado', 3],
        ['Entrevista', 'entrevista', 4], ['Seleccionado', 'seleccionado', 5], ['Rechazado', 'rechazado', 6],
      ];
      for (const [name, code, order] of defaultStages2) {
        await client.query(
          `INSERT INTO selection_stages (company_id, name, status_code, sort_order) VALUES ($1,$2,$3,$4)`,
          [company2.id, name, code, order]
        );
      }
      // Nota: a propósito NO se configuran criterios propios para esta
      // empresa, para demostrar el peso por defecto (25/25/25/25).
    }

    const admin = await upsertUser(client, {
      companyId: company.id, role: 'company_admin', fullName: 'Andrea Ramírez',
      email: 'admin@technova.demo', password: DEMO_PASSWORD,
    });
    const recruiter = await upsertUser(client, {
      companyId: company.id, role: 'recruiter', fullName: 'Jorge Salcedo',
      email: 'reclutador@technova.demo', password: DEMO_PASSWORD,
    });

    const adminAndino = await upsertUser(client, {
      companyId: company2.id, role: 'company_admin', fullName: 'Patricia Neira',
      email: 'admin@andino.demo', password: DEMO_PASSWORD,
    });

    // --- Vacantes ---
    let vacancy1 = (await client.query(`SELECT * FROM vacancies WHERE title = 'Desarrollador Backend Node.js' AND company_id = $1`, [company.id])).rows[0];
    if (!vacancy1) {
      vacancy1 = (
        await client.query(
          `INSERT INTO vacancies (company_id, created_by, title, description, required_education, min_experience_years,
             required_skills, required_languages, salary, modality, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'remoto','active') RETURNING *`,
          [
            company.id, recruiter.id, 'Desarrollador Backend Node.js',
            'Responsable de mantener y evolucionar los servicios REST de la plataforma.',
            'Ingeniería de Sistemas', 2,
            JSON.stringify([{ name: 'Node.js', weight: 2 }, { name: 'PostgreSQL', weight: 1 }, { name: 'Express', weight: 1 }]),
            JSON.stringify([{ language: 'Inglés', level: 'intermedio' }]),
            '$4.000.000 - $6.000.000 COP',
          ]
        )
      ).rows[0];
    }

    let vacancy2 = (await client.query(`SELECT * FROM vacancies WHERE title = 'Analista de Datos' AND company_id = $1`, [company.id])).rows[0];
    if (!vacancy2) {
      vacancy2 = (
        await client.query(
          `INSERT INTO vacancies (company_id, created_by, title, description, required_education, min_experience_years,
             required_skills, required_languages, salary, modality, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'hibrido','active') RETURNING *`,
          [
            company.id, admin.id, 'Analista de Datos',
            'Análisis de datos comerciales y generación de reportes para la dirección.',
            'Ingeniería Industrial', 1,
            JSON.stringify([{ name: 'SQL', weight: 1 }, { name: 'Python', weight: 1 }, { name: 'Power BI', weight: 1 }]),
            JSON.stringify([{ language: 'Inglés', level: 'basico' }]),
            '$3.500.000 - $5.000.000 COP',
          ]
        )
      ).rows[0];
    }

    let vacancy3 = (await client.query(`SELECT * FROM vacancies WHERE title = 'Asesor de Ventas' AND company_id = $1`, [company2.id])).rows[0];
    if (!vacancy3) {
      vacancy3 = (
        await client.query(
          `INSERT INTO vacancies (company_id, created_by, title, description, required_education, min_experience_years,
             required_skills, required_languages, salary, modality, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'presencial','active') RETURNING *`,
          [
            company2.id, adminAndino.id, 'Asesor de Ventas',
            'Atención al cliente y ventas en punto físico dentro de nuestras tiendas.',
            'Bachiller', 0,
            JSON.stringify([{ name: 'Atención al cliente' }, { name: 'Ventas' }]),
            JSON.stringify([]),
            '$1.800.000 + comisiones',
          ]
        )
      ).rows[0];
    }

    // --- Candidatos ---
    const maria = await createCandidateWithResume(client, {
      fullName: 'María Fernanda Gómez Ríos', email: 'maria.gomez@correo.demo',
      headline: 'Desarrolladora Backend', location: 'Bucaramanga, Colombia',
      education: [{ institution: 'Universidad Industrial de Santander', degree: 'Ingeniería de Sistemas', fieldOfStudy: 'Ingeniería de Sistemas', year: 2021 }],
      experience: [{ companyName: 'Softserve S.A.', position: 'Desarrolladora Backend', years: 3, description: 'APIs REST con Node.js y PostgreSQL' }],
      skills: [{ name: 'Node.js' }, { name: 'Express' }, { name: 'PostgreSQL' }, { name: 'Docker' }],
      languages: [{ language: 'Inglés', level: 'intermedio' }, { language: 'Español', level: 'nativo' }],
      certifications: [{ name: 'AWS Cloud Practitioner', issuer: 'Amazon', year: 2022 }],
      resumeLines: [
        'Maria Fernanda Gomez Rios', 'Ingeniera de Sistemas - Universidad Industrial de Santander (2021)',
        'Experiencia: Desarrolladora Backend en Softserve S.A. - 3 anios',
        'APIs REST con Node.js, Express y PostgreSQL. Uso de Docker para despliegue.',
        'Habilidades: Node.js, Express, PostgreSQL, Docker, Git',
        'Idiomas: Ingles nivel intermedio, Espanol nativo',
        'Certificaciones: AWS Cloud Practitioner (2022)',
      ],
    });

    const carlos = await createCandidateWithResume(client, {
      fullName: 'Carlos Andrés Ruiz Peña', email: 'carlos.ruiz@correo.demo',
      headline: 'Técnico en soporte / desarrollo junior', location: 'Bogotá, Colombia',
      education: [{ institution: 'SENA', degree: 'Tecnólogo en Análisis y Desarrollo de Software', fieldOfStudy: 'Desarrollo de Software', year: 2023 }],
      experience: [{ companyName: 'Soporte Andino Ltda.', position: 'Soporte técnico', years: 1, description: 'Atención de incidentes de nivel 1' }],
      skills: [{ name: 'HTML' }, { name: 'CSS' }, { name: 'JavaScript' }],
      languages: [{ language: 'Español', level: 'nativo' }],
      certifications: [],
      resumeLines: [
        'Carlos Andres Ruiz Pena', 'Tecnologo en Analisis y Desarrollo de Software - SENA (2023)',
        'Experiencia: Soporte tecnico en Soporte Andino Ltda. - 1 anio',
        'Habilidades: HTML, CSS, JavaScript basico', 'Idiomas: Espanol nativo',
      ],
    });

    const laura = await createCandidateWithResume(client, {
      fullName: 'Laura Camila Torres Medina', email: 'laura.torres@correo.demo',
      headline: 'Analista de Datos', location: 'Bucaramanga, Colombia',
      education: [{ institution: 'Universidad de Santander', degree: 'Ingeniería Industrial', fieldOfStudy: 'Ingeniería Industrial', year: 2020 }],
      experience: [{ companyName: 'Grupo Éxito', position: 'Analista de Datos Junior', years: 2.5, description: 'Reportes comerciales y tableros de control' }],
      skills: [{ name: 'SQL' }, { name: 'Python' }, { name: 'Power BI' }, { name: 'Excel avanzado' }],
      languages: [{ language: 'Inglés', level: 'avanzado' }, { language: 'Español', level: 'nativo' }],
      certifications: [{ name: 'Data Analytics', issuer: 'Google', year: 2021 }],
      resumeLines: [
        'Laura Camila Torres Medina', 'Ingeniera Industrial - Universidad de Santander (2020)',
        'Experiencia: Analista de Datos Junior en Grupo Exito - 2.5 anios',
        'Reportes comerciales y tableros de control.',
        'Habilidades: SQL, Python, Power BI, Excel avanzado',
        'Idiomas: Ingles avanzado, Espanol nativo', 'Certificaciones: Data Analytics - Google (2021)',
      ],
    });

    // --- Vinculación candidato-empresa (modelo privado por código) ---
    // María queda vinculada a AMBAS empresas para demostrar el selector de
    // entornos y que sus postulaciones no se mezclan entre ellas.
    for (const companyId of [company.id, company2.id]) {
      const already = await client.query(
        'SELECT id FROM candidate_company_links WHERE candidate_id = $1 AND company_id = $2',
        [maria.profile.id, companyId]
      );
      if (already.rows.length === 0) {
        await client.query(
          'INSERT INTO candidate_company_links (candidate_id, company_id) VALUES ($1, $2)',
          [maria.profile.id, companyId]
        );
      }
    }
    for (const candidateId of [carlos.profile.id, laura.profile.id]) {
      const already = await client.query(
        'SELECT id FROM candidate_company_links WHERE candidate_id = $1 AND company_id = $2',
        [candidateId, company.id]
      );
      if (already.rows.length === 0) {
        await client.query(
          'INSERT INTO candidate_company_links (candidate_id, company_id) VALUES ($1, $2)',
          [candidateId, company.id]
        );
      }
    }

    // --- Postulaciones ---
    const app1 = await applyIfMissing(client, { vacancyId: vacancy1.id, candidateId: maria.profile.id, resumeId: maria.resume.id });
    const app2 = await applyIfMissing(client, { vacancyId: vacancy1.id, candidateId: carlos.profile.id, resumeId: carlos.resume.id });
    const app3 = await applyIfMissing(client, { vacancyId: vacancy2.id, candidateId: laura.profile.id, resumeId: laura.resume.id });

    console.log('Ejecutando análisis de IA (modo mock) sobre las postulaciones demo...');
    await compatibilityService.runAnalysis({ applicationId: app1.id });
    await compatibilityService.runAnalysis({ applicationId: app2.id });
    await compatibilityService.runAnalysis({ applicationId: app3.id });

    console.log('\n✅ Datos de demostración listos.\n');
    console.log('Credenciales de prueba (contraseña para todas: Demo1234!):');
    console.log('  Superadministrador          : superadmin@sifce.demo');
    console.log('  Administrador (TechNova)    : admin@technova.demo');
    console.log('  Reclutador (TechNova)       : reclutador@technova.demo');
    console.log('  Administrador (Andino)      : admin@andino.demo');
    console.log('  Candidatos                  : maria.gomez@correo.demo / carlos.ruiz@correo.demo / laura.torres@correo.demo');
    console.log('\nCódigos de acceso de empresa (para vincular un candidato nuevo):');
    console.log('  TechNova Soluciones S.A.S.  : TECHNOVA24');
    console.log('  Grupo Andino Retail S.A.S.  : ANDINO24');
    console.log('\nMaría ya está vinculada a AMBAS empresas (demuestra el selector de entornos');
    console.log('y que sus postulaciones no se mezclan). Carlos y Laura solo están vinculados a TechNova.');
  } finally {
    client.release();
    await db.pool.end();
  }
}

main().catch((err) => {
  console.error('Error sembrando datos demo:', err);
  process.exit(1);
});
