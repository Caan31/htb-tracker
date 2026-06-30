import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './components/Dashboard.jsx';
import MaquinasList from './pages/MaquinasList.jsx';
import MaquinaDetalle from './pages/MaquinaDetalle.jsx';
import HtbConfig from './pages/HtbConfig.jsx';

export default function App() {
  // Estilo del enlace activo en la navbar
  const linkClass = ({ isActive }) =>
    'me-3 text-decoration-none ' + (isActive ? 'htb-accent fw-bold' : 'text-light');

  return (
    <BrowserRouter>
      {/* Barra superior con navegación */}
      <nav className="htb-navbar px-4 py-3 mb-4 d-flex align-items-center">
        <span className="h4 mb-0 me-4">
          <span className="htb-accent">HTB</span> Tracker
        </span>
        <NavLink to="/" className={linkClass} end>Dashboard</NavLink>
        <NavLink to="/maquinas" className={linkClass}>Máquinas</NavLink>
        <NavLink to="/htb" className={linkClass}>HTB Sync</NavLink>
      </nav>

      <div className="container-fluid px-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/maquinas" element={<MaquinasList />} />
          <Route path="/maquinas/:id" element={<MaquinaDetalle />} />
          <Route path="/htb" element={<HtbConfig />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
