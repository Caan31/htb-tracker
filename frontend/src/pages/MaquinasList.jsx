import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJSON } from '../api';

// Colores de badge según estado
function EstadoBadge({ estado }) {
  const color = estado === 'Completada' ? '#9fef00'
    : estado === 'En Progreso' ? '#ffb000' : '#5a6b85';
  return <span className="htb-badge" style={{ borderColor: color, color }}>{estado}</span>;
}

const NIVELES = ['Fundamentals', 'Intermediate', 'Advanced'];
const DIFICULTADES = ['Easy', 'Medium', 'Hard', 'Insane'];
const ESTADOS = ['Pendiente', 'En Progreso', 'Completada'];

export default function MaquinasList() {
  const [certificaciones, setCertificaciones] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [filtros, setFiltros] = useState({ certificacion_id: '', nivel: '', estado: '', dificultad: '' });
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState(null);

  // Cargamos las certificaciones una vez (para el desplegable de filtro)
  useEffect(() => {
    getJSON('/certificaciones').then(setCertificaciones).catch((e) => setError(e.message));
  }, []);

  // Cada vez que cambian los filtros, recargamos las máquinas desde la API
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v) params.append(k, v); });
    const qs = params.toString();
    getJSON(`/maquinas${qs ? `?${qs}` : ''}`).then(setMaquinas).catch((e) => setError(e.message));
  }, [filtros]);

  const setFiltro = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value });
  const limpiar = () => { setFiltros({ certificacion_id: '', nivel: '', estado: '', dificultad: '' }); setBusqueda(''); };

  // La búsqueda por nombre se aplica en el cliente (instantánea)
  const visibles = maquinas.filter((m) =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  if (error) return <div className="alert alert-danger">Error: {error}</div>;

  return (
    <div className="pb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Máquinas <span className="text-secondary">({visibles.length})</span></h5>
      </div>

      {/* ---- Filtros ---- */}
      <div className="htb-card p-3 mb-3">
        <div className="row g-2">
          <div className="col-12 col-md">
            <input className="form-control bg-dark text-light border-secondary"
              placeholder="Buscar por nombre…" value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select bg-dark text-light border-secondary"
              value={filtros.certificacion_id} onChange={setFiltro('certificacion_id')}>
              <option value="">Certificación</option>
              {certificaciones.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select bg-dark text-light border-secondary"
              value={filtros.nivel} onChange={setFiltro('nivel')}>
              <option value="">Nivel</option>
              {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select bg-dark text-light border-secondary"
              value={filtros.dificultad} onChange={setFiltro('dificultad')}>
              <option value="">Dificultad</option>
              {DIFICULTADES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select bg-dark text-light border-secondary"
              value={filtros.estado} onChange={setFiltro('estado')}>
              <option value="">Estado</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="col-auto">
            <button className="btn btn-outline-secondary" onClick={limpiar}>Limpiar</button>
          </div>
        </div>
      </div>

      {/* ---- Tabla ---- */}
      <div className="htb-card p-0">
        <table className="table table-dark table-hover mb-0 align-middle">
          <thead>
            <tr>
              <th>Nombre</th><th>Certificaciones</th><th>Nivel</th>
              <th>Dificultad</th><th>Estado</th><th>Vulns</th><th>HTB</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((m) => (
              <tr key={m.id}>
                <td><Link to={`/maquinas/${m.id}`} className="htb-accent text-decoration-none">{m.nombre}</Link></td>
                <td>{m.certificaciones.map((c) => <span key={c} className="htb-badge">{c}</span>)}</td>
                <td className="text-secondary">{m.nivel}</td>
                <td>{m.dificultad || <span className="text-secondary">—</span>}</td>
                <td><EstadoBadge estado={m.estado} /></td>
                <td>{m.num_vulnerabilidades > 0 ? m.num_vulnerabilidades : <span className="text-secondary">0</span>}</td>
                <td>{m.url_htb && <a href={m.url_htb} target="_blank" rel="noreferrer" className="text-secondary">↗</a>}</td>
                <td><Link to={`/maquinas/${m.id}`} className="btn btn-sm btn-outline-secondary">Ver</Link></td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan="8" className="text-center text-secondary py-4">No hay máquinas con esos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
