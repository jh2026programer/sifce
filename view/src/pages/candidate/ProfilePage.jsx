import { useEffect, useState } from 'react';
import * as candidatesApi from '../../api/candidates';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';

function SectionList({ title, items, renderItem, onRemove, addForm }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {items.length === 0 && <p className="muted">Sin registros todavía.</p>}
      {items.map((item) => (
        <div className="list-item-row" key={item.id}>
          <div>{renderItem(item)}</div>
          <button className="btn btn-danger btn-sm" onClick={() => onRemove(item.id)}>Eliminar</button>
        </div>
      ))}
      <div style={{ marginTop: 14 }}>{addForm}</div>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [basic, setBasic] = useState({ headline: '', location: '', phone: '', summary: '' });
  const [education, setEducation] = useState({ institution: '', degree: '', fieldOfStudy: '', yearCompleted: '' });
  const [experience, setExperience] = useState({ companyName: '', position: '', years: '', description: '' });
  const [skill, setSkill] = useState({ name: '', type: 'tecnica' });
  const [language, setLanguage] = useState({ language: '', level: 'basico' });
  const [certification, setCertification] = useState({ name: '', issuer: '', year: '' });

  const load = () =>
    candidatesApi.getMyCandidateProfile().then((p) => {
      setProfile(p);
      setBasic({ headline: p.headline || '', location: p.location || '', phone: p.phone || '', summary: p.summary || '' });
    }).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const saveBasic = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      await candidatesApi.updateMyCandidateProfile(basic);
      setMessage('Perfil actualizado.');
      load();
    } catch (err) { setError(err.message); }
  };

  const handleAdd = (apiFn, resetState, currentState) => async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiFn(currentState);
      resetState();
      load();
    } catch (err) { setError(err.message); }
  };

  const handleRemove = (apiFn) => async (id) => {
    try { await apiFn(id); load(); } catch (err) { setError(err.message); }
  };

  if (!profile) return error ? <Alert type="error">{error}</Alert> : <Loading />;

  return (
    <div>
      <h2>Mi perfil profesional</h2>
      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>

      <div className="card">
        <h3>Información básica</h3>
        <form onSubmit={saveBasic}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Titular profesional</label>
              <input className="form-control" value={basic.headline} onChange={(e) => setBasic({ ...basic, headline: e.target.value })} placeholder="Ej. Desarrollador Backend" />
            </div>
            <div className="form-group">
              <label className="form-label">Ubicación</label>
              <input className="form-control" value={basic.location} onChange={(e) => setBasic({ ...basic, location: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input className="form-control" value={basic.phone} onChange={(e) => setBasic({ ...basic, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Resumen profesional</label>
            <textarea className="form-control" value={basic.summary} onChange={(e) => setBasic({ ...basic, summary: e.target.value })} />
          </div>
          <button className="btn btn-primary">Guardar</button>
        </form>
      </div>

      <SectionList
        title="Formación académica"
        items={profile.education}
        renderItem={(e) => <span>{e.degree} — {e.institution} {e.year_completed ? `(${e.year_completed})` : ''}</span>}
        onRemove={handleRemove(candidatesApi.removeEducation)}
        addForm={
          <form
            onSubmit={handleAdd(candidatesApi.addEducation, () => setEducation({ institution: '', degree: '', fieldOfStudy: '', yearCompleted: '' }), education)}
          >
            <div className="form-row">
              <input className="form-control" required placeholder="Institución" value={education.institution} onChange={(e) => setEducation({ ...education, institution: e.target.value })} />
              <input className="form-control" required placeholder="Título / Grado" value={education.degree} onChange={(e) => setEducation({ ...education, degree: e.target.value })} />
            </div>
            <div className="form-row" style={{ marginTop: 10 }}>
              <input className="form-control" placeholder="Área de estudio" value={education.fieldOfStudy} onChange={(e) => setEducation({ ...education, fieldOfStudy: e.target.value })} />
              <input className="form-control" type="number" placeholder="Año de finalización" value={education.yearCompleted} onChange={(e) => setEducation({ ...education, yearCompleted: e.target.value })} />
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>+ Agregar formación</button>
          </form>
        }
      />

      <SectionList
        title="Experiencia laboral"
        items={profile.experience}
        renderItem={(e) => <span>{e.position} — {e.company_name} ({e.years} años)</span>}
        onRemove={handleRemove(candidatesApi.removeExperience)}
        addForm={
          <form onSubmit={handleAdd(candidatesApi.addExperience, () => setExperience({ companyName: '', position: '', years: '', description: '' }), experience)}>
            <div className="form-row">
              <input className="form-control" required placeholder="Empresa" value={experience.companyName} onChange={(e) => setExperience({ ...experience, companyName: e.target.value })} />
              <input className="form-control" required placeholder="Cargo" value={experience.position} onChange={(e) => setExperience({ ...experience, position: e.target.value })} />
            </div>
            <div className="form-row" style={{ marginTop: 10 }}>
              <input className="form-control" type="number" step="0.5" placeholder="Años de experiencia" value={experience.years} onChange={(e) => setExperience({ ...experience, years: e.target.value })} />
              <input className="form-control" placeholder="Descripción breve" value={experience.description} onChange={(e) => setExperience({ ...experience, description: e.target.value })} />
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>+ Agregar experiencia</button>
          </form>
        }
      />

      <SectionList
        title="Habilidades"
        items={profile.skills}
        renderItem={(s) => <span>{s.name} <span className="muted">({s.type === 'tecnica' ? 'técnica' : 'blanda'})</span></span>}
        onRemove={handleRemove(candidatesApi.removeSkill)}
        addForm={
          <form onSubmit={handleAdd(candidatesApi.addSkill, () => setSkill({ name: '', type: 'tecnica' }), skill)}>
            <div className="form-row">
              <input className="form-control" required placeholder="Ej. Node.js" value={skill.name} onChange={(e) => setSkill({ ...skill, name: e.target.value })} />
              <select className="form-control" value={skill.type} onChange={(e) => setSkill({ ...skill, type: e.target.value })}>
                <option value="tecnica">Técnica</option>
                <option value="blanda">Blanda</option>
              </select>
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>+ Agregar habilidad</button>
          </form>
        }
      />

      <SectionList
        title="Idiomas"
        items={profile.languages}
        renderItem={(l) => <span>{l.language} — {l.level}</span>}
        onRemove={handleRemove(candidatesApi.removeLanguage)}
        addForm={
          <form onSubmit={handleAdd(candidatesApi.addLanguage, () => setLanguage({ language: '', level: 'basico' }), language)}>
            <div className="form-row">
              <input className="form-control" required placeholder="Ej. Inglés" value={language.language} onChange={(e) => setLanguage({ ...language, language: e.target.value })} />
              <select className="form-control" value={language.level} onChange={(e) => setLanguage({ ...language, level: e.target.value })}>
                <option value="basico">Básico</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzado">Avanzado</option>
                <option value="nativo">Nativo</option>
              </select>
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>+ Agregar idioma</button>
          </form>
        }
      />

      <SectionList
        title="Certificaciones"
        items={profile.certifications}
        renderItem={(c) => <span>{c.name} — {c.issuer} {c.year ? `(${c.year})` : ''}</span>}
        onRemove={handleRemove(candidatesApi.removeCertification)}
        addForm={
          <form onSubmit={handleAdd(candidatesApi.addCertification, () => setCertification({ name: '', issuer: '', year: '' }), certification)}>
            <div className="form-row">
              <input className="form-control" required placeholder="Nombre de la certificación" value={certification.name} onChange={(e) => setCertification({ ...certification, name: e.target.value })} />
              <input className="form-control" placeholder="Entidad emisora" value={certification.issuer} onChange={(e) => setCertification({ ...certification, issuer: e.target.value })} />
            </div>
            <input className="form-control" type="number" style={{ marginTop: 10 }} placeholder="Año" value={certification.year} onChange={(e) => setCertification({ ...certification, year: e.target.value })} />
            <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>+ Agregar certificación</button>
          </form>
        }
      />
    </div>
  );
}
