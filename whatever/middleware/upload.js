const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config/env');
const AppError = require('../utils/AppError');

const { uploadDir } = config.resume;
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${unique}.pdf`);
  },
});

function fileFilter(req, file, cb) {
  const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';
  if (!isPdf) {
    return cb(new AppError('Solo se permiten archivos en formato PDF.', 400));
  }
  return cb(null, true);
}

const resumeUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.resume.maxSizeMb * 1024 * 1024 },
});

// Traduce el error de tamaño de multer a un mensaje claro (Sección 21).
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return next(new AppError(`El archivo supera el tamaño máximo permitido (${config.resume.maxSizeMb} MB).`, 400));
  }
  if (err) return next(err);
  return next();
}

module.exports = { resumeUpload, handleUploadErrors, uploadDir };
