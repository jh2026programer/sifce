import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

const TOKEN_KEY = 'sifce_token';
const USER_KEY = 'sifce_user';
const ACTIVE_COMPANY_KEY = 'sifce_active_company'; // objeto {id, name} en JSON
const ACTIVE_COMPANY_ID_KEY = 'sifce_active_company_id'; // leído por api/client.js (header)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [activeCompany, setActiveCompanyState] = useState(() => {
    const stored = localStorage.getItem(ACTIVE_COMPANY_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setInitializing(false);
      return;
    }
    // Revalida la sesión contra el backend (por si el usuario fue desactivado
    // o la empresa fue desactivada desde la última visita).
    authApi
      .fetchMe()
      .then((me) => {
        setUser((prev) => ({ ...prev, ...me, id: me.id, role: me.role, companyId: me.company_id, fullName: me.full_name }));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setInitializing(false));
  }, []);

  const persistSession = useCallback((token, userData) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    // Cambiar de cuenta siempre limpia el entorno de empresa activo de la
    // sesión anterior (nunca debe "arrastrarse" entre candidatos distintos).
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
    localStorage.removeItem(ACTIVE_COMPANY_ID_KEY);
    setActiveCompanyState(null);
    setUser(userData);
  }, []);

  // Selecciona el entorno de empresa en el que el candidato quiere operar
  // (modelo privado por empresa: sin esto, las rutas de vacantes/postulaciones
  // no funcionan). Se persiste para no tener que reseleccionar en cada visita.
  const setActiveCompany = useCallback((company) => {
    if (!company) {
      localStorage.removeItem(ACTIVE_COMPANY_KEY);
      localStorage.removeItem(ACTIVE_COMPANY_ID_KEY);
      setActiveCompanyState(null);
      return;
    }
    localStorage.setItem(ACTIVE_COMPANY_KEY, JSON.stringify(company));
    localStorage.setItem(ACTIVE_COMPANY_ID_KEY, company.id);
    setActiveCompanyState(company);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const result = await authApi.login(email, password);
      if (result.requiresOtp) {
        // No se persiste ninguna sesión todavía: falta el segundo factor.
        return { requiresOtp: true, otpId: result.otpId, maskedEmail: result.maskedEmail };
      }
      persistSession(result.token, result.user);
      return { requiresOtp: false, user: result.user };
    },
    [persistSession]
  );

  // Segundo paso del login: recién aquí se emite y persiste la sesión real.
  const verifyOtp = useCallback(
    async (otpId, code) => {
      const { token, user: userData } = await authApi.verifyLoginOtp(otpId, code);
      persistSession(token, userData);
      return userData;
    },
    [persistSession]
  );

  const resendOtp = useCallback(async (otpId) => {
    const { otpId: newOtpId } = await authApi.resendLoginOtp(otpId);
    return newOtpId;
  }, []);

  const registerCandidate = useCallback(
    async (payload) => {
      const { token, user: userData, linkedCompany } = await authApi.registerCandidate(payload);
      persistSession(token, userData);
      // Si se registró con un código de empresa, entra directo a ese entorno.
      if (linkedCompany) setActiveCompany(linkedCompany);
      return userData;
    },
    [persistSession, setActiveCompany]
  );

  const registerCompany = useCallback(
    async (payload) => {
      const { token, user: userData } = await authApi.registerCompany(payload);
      persistSession(token, userData);
      return userData;
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
    localStorage.removeItem(ACTIVE_COMPANY_ID_KEY);
    setActiveCompanyState(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user, activeCompany, setActiveCompany, initializing,
      login, verifyOtp, resendOtp, registerCandidate, registerCompany, logout,
    }),
    [user, activeCompany, setActiveCompany, initializing, login, verifyOtp, resendOtp, registerCandidate, registerCompany, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
}
