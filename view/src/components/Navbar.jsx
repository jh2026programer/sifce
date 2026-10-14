import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { roleLabel } from '../constants/roles.js';
import { IconBuilding, IconLogOut, IconUserCircle } from './Icons.jsx';

// "María Gómez Pérez" -> "MG"; "admin" -> "A".
function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '?').concat(parts[1]?.[0] || '').toUpperCase();
}

const Caret = () => (
  <svg className="user-menu-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Cierra el menú al hacer clic fuera o al presionar Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">{initials(user.fullName)}</span>
        <span className="user-menu-name">
          <strong>{user.fullName}</strong>
          <span>{roleLabel(user.role)}</span>
        </span>
        <Caret />
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-header">
            <span className="avatar avatar-lg" aria-hidden="true">{initials(user.fullName)}</span>
            <div style={{ minWidth: 0 }}>
              <strong>{user.fullName}</strong>
              <span className="user-menu-email">{user.email}</span>
              <span className="user-menu-role">{roleLabel(user.role)}</span>
            </div>
          </div>
          <Link to="/account" className="user-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <IconUserCircle size={17} /> Mi cuenta
          </Link>
          <button type="button" className="user-menu-item danger" role="menuitem" onClick={onLogout}>
            <IconLogOut size={17} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, activeCompany, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <Link to="/dashboard" className="navbar-brand">
        <img src="/sifce-logo.png" alt="SIFCE" className="navbar-logo-img" />
      </Link>
      {user && (
        <div className="navbar-right">
          {user.role === 'candidate' && activeCompany && (
            <span className="navbar-company-chip" title="Empresa en la que estás operando">
              <IconBuilding size={14} /> {activeCompany.name}
            </span>
          )}
          <UserMenu user={user} onLogout={handleLogout} />
        </div>
      )}
    </header>
  );
}
