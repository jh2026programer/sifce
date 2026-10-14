// Constantes del dominio (frontend) — estados del dominio y su nombre visible. Deben coincidir
// con los enums de model/schema.sql.

// Etapas del proceso de selección que puede asignar la empresa (RF13).
// "retirado" no está aquí: solo lo decide el candidato.
export const STAGE_LABELS = {
  postulado: 'Postulado',
  en_revision: 'En revisión',
  preseleccionado: 'Preseleccionado',
  entrevista: 'Entrevista',
  seleccionado: 'Seleccionado',
  rechazado: 'Rechazado',
};

export const STAGE_OPTIONS = Object.entries(STAGE_LABELS);

// Todos los estados que pueden mostrarse en una insignia (StatusBadge).
export const STATUS_LABELS = {
  // empresas y vacantes
  active: 'Activa', inactive: 'Inactiva', draft: 'Borrador', closed: 'Cerrada',
  // postulaciones
  ...STAGE_LABELS, retirado: 'Retirado',
  // análisis de IA
  pending: 'Pendiente', processing: 'Procesando', completed: 'Completado', failed: 'Falló',
  // hojas de vida
  extracted: 'Procesado', extraction_failed: 'Error al procesar', uploaded: 'Cargado',
};
