import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as candidatesApi from '../../api/candidates';
import { useAuth } from '../../context/AuthContext.jsx';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';

// Pantalla central del modelo privado por empresa: aquí el candidato ve
// únicamente las empresas a las que YA está vinculado (nunca una lista
// pública de empresas), puede vincularse a una nueva mediante su código
// único, y elige en cuál entorno quiere operar en esta sesión.
export default function CompanyEnvironmentsPage() {
  const { activeCompany, setActiveCompany } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);

  const load = () => candidatesApi.listMyLinkedCompanies().then(setCompanies).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const handleLink = async (e) => {
    e.preventDefault();
    setError('');
    setLinking(true);
    try {
      const company = await candidatesApi.linkCompanyByCode(code);
      setCode('');
      await load();
      enter(company);
    } catch (err) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  };

  const enter = (company) => {
    setActiveCompany({ id: company.id, name: company.name, status: company.status });
    navigate('/dashboard');
  };

  if (!companies) return error ? <Alert type="error">{error}</Alert> : <Loading />;

  return (
    <div>
      <h2>Mis empresas</h2>
      <p className="muted">
        Cada empresa es un entorno privado e independiente: solo ves sus vacantes y postulaciones cuando entras a
        ella. Para vincularte a una nueva empresa necesitas el código único que ella te entregue.
      </p>
      <Alert type="error">{error}</Alert>

      {companies.length > 0 && (
        <div className="card">
          <h3>Entrar a un entorno</h3>
          <div className="card-grid">
            {companies.map((c) => (
              <div className="card" key={c.id} style={{ margin: 0 }}>
                <h4 style={{ marginBottom: 4 }}>{c.name}</h4>
                <p className="muted" style={{ marginBottom: 10 }}>{c.sector || 'Sin sector especificado'}</p>
                {c.status === 'active' ? (
                  <button
                    className={activeCompany?.id === c.id ? 'btn btn-outline btn-sm' : 'btn btn-accent btn-sm'}
                    onClick={() => enter(c)}
                  >
                    {activeCompany?.id === c.id ? 'Entorno actual' : 'Entrar'}
                  </button>
                ) : (
                  <span className="badge badge-inactive">Empresa inactiva</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: 420 }}>
        <h3>Vincular una nueva empresa</h3>
        {companies.length === 0 && (
          <p className="muted">Aún no estás vinculado a ninguna empresa. Ingresa el código que te compartieron.</p>
        )}
        <form onSubmit={handleLink}>
          <div className="form-group">
            <label className="form-label">Código de la empresa</label>
            <input
              className="form-control" required value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ej. TECHNOVA24"
            />
          </div>
          <button className="btn btn-primary" disabled={linking}>{linking ? 'Vinculando...' : 'Vincularme'}</button>
        </form>
      </div>
    </div>
  );
}
