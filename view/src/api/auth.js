import client from './client';

export const login = (email, password) => client.post('/auth/login', { email, password }).then((r) => r.data.data);

export const verifyLoginOtp = (otpId, code) =>
  client.post('/auth/login/verify-otp', { otpId, code }).then((r) => r.data.data);

export const resendLoginOtp = (otpId) =>
  client.post('/auth/login/resend-otp', { otpId }).then((r) => r.data.data);

export const registerCandidate = (payload) =>
  client.post('/auth/register/candidate', payload).then((r) => r.data.data);

export const registerCompany = (payload) =>
  client.post('/auth/register/company', payload).then((r) => r.data.data);

export const fetchMe = () => client.get('/auth/me').then((r) => r.data.data);

export const updateMyAccount = (payload) => client.patch('/users/me', payload).then((r) => r.data.data);

// Config pública (sin sesión): le dice al frontend si debe mostrar el widget
// de CAPTCHA (Cloudflare Turnstile) y con qué clave de sitio.
export const getPublicConfig = () => client.get('/auth/public-config').then((r) => r.data.data);
