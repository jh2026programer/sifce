const fs = require('fs');
const path = require('path');
const resumeModel = require('../../model/resume.model.js');
const view = require('../presenters/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const microservicios = require('../services/microservicios');
const { getProfileIdForUser } = require('./candidates.controller.js');
const { logActivity } = require('../services/activityLogService');

// RF07 - Carga de Hoja de Vida
const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Debes adjuntar un archivo PDF.', 400);

  const candidateId = await getProfileIdForUser(req.user.id);

  const resume = await resumeModel.create(candidateId, {
    fileName: req.file.originalname,
    filePath: req.file.path,
    sizeBytes: req.file.size,
  });

  // Validación y extracción de texto en el microservicio validador-cv
  // (Sección 10): no bloquea la carga si falla, pero el resultado queda en el
  // propio registro para consulta posterior.
  const extraction = await microservicios.validarCv(fs.readFileSync(req.file.path));
  await resumeModel.saveExtraction(resume.id, extraction);

  await logActivity({ userId: req.user.id, action: 'upload_resume', entityType: 'resume', entityId: resume.id });

  view.created(res, {
    id: resume.id,
    fileName: resume.file_name,
    status: extraction.success ? 'extracted' : 'extraction_failed',
    extractionError: extraction.error,
    detectedData: extraction.datos,
  });
});

const listMyResumes = asyncHandler(async (req, res) => {
  const candidateId = await getProfileIdForUser(req.user.id);
  view.ok(res, await resumeModel.listByCandidate(candidateId));
});

const deleteResume = asyncHandler(async (req, res) => {
  const candidateId = await getProfileIdForUser(req.user.id);
  const removed = await resumeModel.removeOwned(req.params.id, candidateId);
  if (!removed) throw new AppError('Hoja de vida no encontrada.', 404);
  view.done(res);
});

// RNF-S4 - Protección de hojas de vida: solo el candidato dueño, o un
// reclutador/administrador cuya empresa tenga una postulación que use este
// resume_id, puede descargar el archivo original.
const downloadResume = asyncHandler(async (req, res) => {
  const resume = await resumeModel.findById(req.params.id);
  if (!resume) throw new AppError('Hoja de vida no encontrada.', 404);

  if (req.user.role === 'candidate') {
    const candidateId = await getProfileIdForUser(req.user.id);
    if (resume.candidate_id !== candidateId) throw new AppError('Hoja de vida no encontrada.', 404);
  } else if (['company_admin', 'recruiter'].includes(req.user.role)) {
    const allowed = await resumeModel.isUsedByCompany(resume.id, req.user.companyId);
    if (!allowed) throw new AppError('Hoja de vida no encontrada.', 404);
  } else {
    throw new AppError('No tienes permisos para acceder a este archivo.', 403);
  }

  await logActivity({ userId: req.user.id, action: 'download_resume', entityType: 'resume', entityId: resume.id });
  res.download(path.resolve(resume.file_path), resume.file_name);
});

module.exports = { uploadResume, listMyResumes, deleteResume, downloadResume };
