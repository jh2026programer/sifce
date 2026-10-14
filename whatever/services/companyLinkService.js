const companyModel = require('../../model/company.model.js');
const companyLinkModel = require('../../model/companyLink.model.js');
const AppError = require('../utils/AppError');

// Usado tanto en el registro de candidato (código opcional en el mismo paso)
// como en la vinculación posterior desde la app ya autenticado. Recibe un
// "executor" con .query (puede ser el pool db o un client de transacción)
// para poder participar en una transacción más grande cuando haga falta.
async function linkCandidateByCode(executor, candidateId, rawCode) {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) throw new AppError('Debes indicar el código de la empresa.', 400);

  const company = await companyModel.findByAccessCode(executor, code);
  if (!company) throw new AppError('El código de empresa no es válido.', 404);
  if (company.status !== 'active') {
    throw new AppError('Esta empresa no se encuentra activa en la plataforma en este momento.', 403);
  }

  if (await companyLinkModel.exists(executor, candidateId, company.id)) {
    throw new AppError('Ya estás vinculado a esta empresa.', 409);
  }

  await companyLinkModel.create(executor, candidateId, company.id);

  return company;
}

module.exports = { linkCandidateByCode };
