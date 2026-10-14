import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Loading from '../components/Loading.jsx';

// RNF-S2: protección de rutas por autenticación y por rol.
export default function ProtectedRoute({ roles, children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <Loading full />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
