import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as vacanciesApi from '../../api/vacancies';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';

const emptyForm = {
  title: '', description: '', requiredEducation: '', minExperienceYears: 0,
  salary: '', modality: 'presencial', status: 'draft',
};

export default function VacancyFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [languages, setLanguages] = useState([]);
  const [langInput, setLangInput] = useState({ language: '', level: 'basico' });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    vacanciesApi.getVacancy(id).then((v) => {
      setForm({
        title: v.title, description: v.description || '', requiredEducation: v.required_education || '',
        minExperienceYears: v.min_experience_years, salary: v.salary || '', modality: v.modality, status: v.status,
      });
      setSkills((v.required_skills || []).map((s) => (typeof s === 'string' ? s : s.name)));
      setLanguages(v.required_languages || []);
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, [id, isEdit]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const addSkill = () => {
    if (!skillInput.trim()) return;
    setSkills([...skills, skillInput.trim()]);
    setSkillInput('');
  };
  const removeSkill = (i) => setSkills(skills.filter((_, idx) => idx !== i));

  const addLanguage = () => {
    if (!langInput.language.trim()) return;
    setLanguages([...languages, { ...langInput }]);
    setLangInput({ language: '', level: 'basico' });
  };
  const removeLanguage = (i) => setLanguages(languages.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      minExperienceYears: Number(form.minExperienceYears) || 0,
      requiredSkills: skills,
      requiredLanguages: languages,
    };
    try {
      if (isEdit) {
        await vacanciesApi.updateVacancy(id, payload);
        navigate(`/vacancies/${id}`);
      } else {
        const created = await vacanciesApi.createVacancy(payload);
        navigate(`/vacancies/${created.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h2>{isEdit ? 'Editar vacante' : 'Nueva vacante'}</h2>
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 720 }}>
        <div className="form-group">
          <label className="form-label">Título del cargo</label>
          <input className="form-control" required value={form.title} onChange={update('title')} />
        </div>
        <div className="form-group">
          <label className="form-label">Descripción</label>
          <textarea className="form-control" value={form.description} onChange={update('description')} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Formación requerida</label>
            <input className="form-control" value={form.requiredEducation} onChange={update('requiredEducation')} placeholder="Ej. Ingeniería de Sistemas" />
          </div>
          <div className="form-group">
            <label className="form-label">Experiencia mínima (años)</label>
            <input className="form-control" type="number" min={0} step={0.5} value={form.minExperienceYears} onChange={update('minExperienceYears')} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Habilidades requeridas</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="form-control" value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
              placeholder="Ej. Node.js" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
            />
            <button type="button" className="btn btn-outline" onClick={addSkill}>Agregar</button>
          </div>
          <div className="tag-list">
            {skills.map((s, i) => (
              <span className="tag" key={i}>{s}<button type="button" className="tag-remove" onClick={() => removeSkill(i)}>×</button></span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Idiomas requeridos</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="form-control" value={langInput.language}
              onChange={(e) => setLangInput({ ...langInput, language: e.target.value })} placeholder="Ej. Inglés"
            />
            <select className="form-control" style={{ maxWidth: 160 }} value={langInput.level} onChange={(e) => setLangInput({ ...langInput, level: e.target.value })}>
              <option value="basico">Básico</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
              <option value="nativo">Nativo</option>
            </select>
            <button type="button" className="btn btn-outline" onClick={addLanguage}>Agregar</button>
          </div>
          <div className="tag-list">
            {languages.map((l, i) => (
              <span className="tag" key={i}>{l.language} ({l.level})<button type="button" className="tag-remove" onClick={() => removeLanguage(i)}>×</button></span>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Salario</label>
            <input className="form-control" value={form.salary} onChange={update('salary')} placeholder="Ej. $3.000.000 - $4.000.000 COP" />
          </div>
          <div className="form-group">
            <label className="form-label">Modalidad</label>
            <select className="form-control" value={form.modality} onChange={update('modality')}>
              <option value="presencial">Presencial</option>
              <option value="remoto">Remoto</option>
              <option value="hibrido">Híbrido</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Estado</label>
          <select className="form-control" value={form.status} onChange={update('status')}>
            <option value="draft">Borrador</option>
            <option value="active">Activa</option>
            <option value="closed">Cerrada</option>
          </select>
        </div>

        <button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar vacante'}</button>
      </form>
    </div>
  );
}
