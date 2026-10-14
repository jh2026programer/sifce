const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

// RNF-S3: las contraseñas nunca se almacenan en texto plano.
function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptSaltRounds);
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, companyId: user.company_id },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

module.exports = { hashPassword, comparePassword, generateToken };
