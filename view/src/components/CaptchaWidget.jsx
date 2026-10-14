import { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://www.google.com/recaptcha/api.js?render=explicit';
let scriptLoadingPromise = null;

function loadRecaptchaScript() {
  if (window.grecaptcha) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar el verificador "no soy un robot".'));
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

// Widget "no soy un robot" (Google reCAPTCHA v2). Si no se pasa siteKey
// (CAPTCHA deshabilitado en el backend), este componente no renderiza nada y
// el formulario que lo use simplemente no exige un token — así el registro
// sigue funcionando sin depender de una clave de reCAPTCHA configurada.
export default function CaptchaWidget({ siteKey, onVerify, onExpire }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (!siteKey) return undefined;
    let cancelled = false;

    loadRecaptchaScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.grecaptcha.ready(() => {
          if (cancelled || !containerRef.current) return;
          widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token) => onVerify?.(token),
            'expired-callback': () => onExpire?.(),
            theme: 'dark',
          });
        });
      })
      .catch(() => {
        // Si el script no carga (red bloqueada, etc.), no se rompe el resto
        // del formulario; simplemente no habrá token y el backend lo exigirá.
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey, onVerify, onExpire]);

  if (!siteKey) return null;
  return <div ref={containerRef} style={{ margin: '12px 0' }} />;
}
