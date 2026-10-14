import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Modelo privado por empresa: estas rutas no tienen sentido sin un entorno
// de empresa seleccionado (no existe una vista "de todas las empresas").
export default function RequireActiveCompany({ children }) {
  const { activeCompany } = useAuth();
  if (!activeCompany) return <Navigate to="/candidate/companies" replace />;
  return children;
}
