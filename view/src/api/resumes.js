import client from './client';

export const listMyResumes = () => client.get('/resumes').then((r) => r.data.data);

export const uploadResume = (file, onProgress) => {
  const form = new FormData();
  form.append('resume', file);
  return client
    .post('/resumes', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) onProgress(Math.round((evt.loaded * 100) / evt.total));
      },
    })
    .then((r) => r.data.data);
};

export const deleteResume = (id) => client.delete(`/resumes/${id}`);

// Descarga autenticada: el archivo requiere el token JWT, así que no puede
// enlazarse como <a href> directo; se trae como blob y se dispara la
// descarga en el navegador.
export const downloadResumeFile = async (id, suggestedName) => {
  const res = await client.get(`/resumes/${id}/file`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName || 'hoja-de-vida.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
