import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

export default function HomePage() {
  const { user, initializing } = useAuth();
  if (!initializing && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="landing-hero">
      <img src="/sifce-logo.png" alt="SIFCE" className="landing-logo-img" />
      <h1>Sistema Inteligente de Filtro y Contratación Empresarial</h1>
      <p>
        SIFCE es la plataforma central de nuestro servicio: cada empresa cliente opera su propio entorno privado
        e independiente para gestionar vacantes, candidatos y procesos de selección. Los candidatos tienen una
        única cuenta y acceden solo a las empresas con las que se vinculan mediante un código único — nunca hay
        un listado público ni cruzado entre empresas. Un módulo de inteligencia artificial analiza hojas de vida
        y calcula compatibilidad dentro de cada entorno, siempre como apoyo a la decisión del reclutador, nunca
        como una contratación automática.
      </p>
      <div className="landing-actions">
        <Link to="/login" className="btn btn-primary">Iniciar sesión</Link>
        <Link to="/register/candidate" className="btn btn-outline-invert">
          Soy candidato
        </Link>
        <Link to="/register/company" className="btn btn-outline-invert">
          Registrar mi empresa
        </Link>
      </div>

      <div className="landing-features">
        <div className="landing-feature">
          <h4>Entornos privados por empresa</h4>
          <p>Ninguna empresa ve vacantes, candidatos ni procesos de otra. Aislamiento real, no solo visual.</p>
        </div>
        <div className="landing-feature">
          <h4>Vinculación por código único</h4>
          <p>Un candidato solo entra al entorno de una empresa si esta le compartió su código de acceso.</p>
        </div>
        <div className="landing-feature">
          <h4>Análisis con IA</h4>
          <p>Compatibilidad, fortalezas y brechas de cada candidato frente a los requisitos de la vacante.</p>
        </div>
      </div>
    </div>
  );
}
