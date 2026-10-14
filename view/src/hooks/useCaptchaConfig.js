import { useEffect, useState } from 'react';
import * as authApi from '../api/auth';

// Consulta si el backend tiene el CAPTCHA habilitado y con qué clave de
// sitio mostrar el widget. Si el endpoint falla por cualquier razón, se
// asume deshabilitado (nunca bloquea el registro por un error de red aquí).
export function useCaptchaConfig() {
  const [siteKey, setSiteKey] = useState(null);

  useEffect(() => {
    authApi.getPublicConfig()
      .then((cfg) => setSiteKey(cfg.captchaEnabled ? cfg.captchaSiteKey : null))
      .catch(() => setSiteKey(null));
  }, []);

  return siteKey;
}
