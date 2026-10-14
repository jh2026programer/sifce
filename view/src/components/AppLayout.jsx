import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';

export default function AppLayout({ children }) {
  return (
    <div className="app-shell" style={{ flexDirection: 'column' }}>
      <Navbar />
      <div className="layout-body">
        <Sidebar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
