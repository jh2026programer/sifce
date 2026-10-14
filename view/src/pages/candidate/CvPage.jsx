import { useEffect, useRef, useState } from 'react';
import * as resumesApi from '../../api/resumes';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

export default function CvPage() {
  const [resumes, setResumes] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toDelete, setToDelete] = useState(null);
  const inputRef = useRef();

  const load = () => resumesApi.listMyResumes().then(setResumes).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(''); setMessage(''); setUploading(true); setProgress(0);
    try {
      const result = await resumesApi.uploadResume(file, setProgress);
      if (result.status === 'extraction_failed') {
        setError(`El archivo se cargó, pero no pudo procesarse: ${result.extractionError}`);
      } else {
        setMessage('Hoja de vida cargada y procesada correctamente.');
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDownload = async (r) => {
    try {
      await resumesApi.downloadResumeFile(r.id, r.file_name);
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmDelete = async () => {
    try {
      await resumesApi.deleteResume(toDelete.id);
      setToDelete(null);
      load();
    } catch (err) {
      setError(err.message);
      setToDelete(null);
    }
  };

  if (!resumes) return <Loading />;

  return (
    <div>
      <h2>Mi hoja de vida</h2>
      <p className="muted">Solo se admiten archivos PDF, con un tamaño máximo de 5 MB.</p>
      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>

      <div className="card">
        <input ref={inputRef} type="file" accept="application/pdf" onChange={handleFileChange} disabled={uploading} />
        {uploading && (
          <div className="loading-inline"><span className="spinner" /> Procesando ({progress}%)...</div>
        )}
      </div>

      <div className="card">
        <h3>Hojas de vida cargadas</h3>
        {resumes.length === 0 ? (
          <p className="empty-state">Aún no has cargado una hoja de vida.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Archivo</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {resumes.map((r) => (
                  <tr key={r.id}>
                    <td>{r.file_name}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{new Date(r.uploaded_at).toLocaleString('es-CO')}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleDownload(r)}>Descargar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setToDelete(r)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!toDelete}
        title="Eliminar hoja de vida"
        message={`¿Confirmas que deseas eliminar "${toDelete?.file_name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
