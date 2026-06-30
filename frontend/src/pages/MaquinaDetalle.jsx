import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getJSON, putJSON, patchJSON, postJSON, del } from '../api';

const ESTADOS = ['Pendiente', 'En Progreso', 'Completada'];
const CRITICIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];
const TIPOS = ['SQLi', 'RCE', 'LFI', 'XSS', 'CSRF', 'Escalada', 'InfoDisc', 'Otra'];

// ---- Formulario para crear o editar una vulnerabilidad ----
function VulnForm({ maquinaId, vuln, onGuardado, onCancelar }) {
  const vacio = { titulo: '', cve: '', tipo: '', criticidad: '', cvss: '', descripcion: '', anotaciones: '' };
  const [f, setF] = useState(vuln ? { ...vacio, ...vuln, cvss: vuln.cvss ?? '' } : vacio);
  const [error, setError] = useState(null);
  const set = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const payload = { ...f, cvss: f.cvss === '' ? null : Number(f.cvss) };
    try {
      if (vuln) await putJSON(`/vulnerabilidades/${vuln.id}`, payload);
      else await postJSON(`/maquinas/${maquinaId}/vulnerabilidades`, payload);
      onGuardado();
    } catch (err) { setError(err.message); }
  }

  const input = 'form-control bg-dark text-light border-secondary';
  return (
    <form onSubmit={submit} className="htb-card p-3 mb-3">
      <h6 className="mb-3">{vuln ? 'Editar vulnerabilidad' : 'Nueva vulnerabilidad'}</h6>
      {error && <div className="alert alert-danger py-1">{error}</div>}
      <div className="row g-2">
        <div className="col-md-6">
          <label className="small text-secondary">Título *</label>
          <input className={input} value={f.titulo} onChange={set('titulo')} required />
        </div>
        <div className="col-md-3">
          <label className="small text-secondary">CVE</label>
          <input className={input} value={f.cve || ''} onChange={set('cve')} placeholder="CVE-2007-4573" />
        </div>
        <div className="col-md-3">
          <label className="small text-secondary">Tipo</label>
          <input className={input} list="tipos" value={f.tipo || ''} onChange={set('tipo')} />
          <datalist id="tipos">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        <div className="col-md-3">
          <label className="small text-secondary">Criticidad</label>
          <select className={input} value={f.criticidad || ''} onChange={set('criticidad')}>
            <option value="">—</option>
            {CRITICIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-md-3">
          <label className="small text-secondary">CVSS (0-10)</label>
          <input className={input} type="number" step="0.1" min="0" max="10" value={f.cvss} onChange={set('cvss')} />
        </div>
        <div className="col-12">
          <label className="small text-secondary">Descripción</label>
          <textarea className={input} rows="2" value={f.descripcion || ''} onChange={set('descripcion')} />
        </div>
        <div className="col-12">
          <label className="small text-secondary">Anotaciones (markdown)</label>
          <textarea className={input} rows="4" value={f.anotaciones || ''} onChange={set('anotaciones')}
            placeholder="## Pasos: 1. ..." style={{ fontFamily: 'monospace' }} />
        </div>
      </div>
      <div className="mt-3">
        <button type="submit" className="btn btn-success btn-sm me-2">Guardar</button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

export default function MaquinaDetalle() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  const [formVuln, setFormVuln] = useState(undefined); // undefined=cerrado | null=nueva | obj=editar
  const [notas, setNotas] = useState('');
  const [tiempo, setTiempo] = useState('');

  function cargar() {
    getJSON(`/maquinas/${id}`).then((data) => {
      setM(data);
      setNotas(data.notas || '');
      setTiempo(data.tiempo_invertido ?? '');
    }).catch((e) => setError(e.message));
  }
  useEffect(cargar, [id]);

  async function cambiarEstado(e) {
    try { await patchJSON(`/maquinas/${id}/estado`, { estado: e.target.value }); cargar(); }
    catch (err) { setError(err.message); }
  }
  async function guardarNotas() {
    try { await putJSON(`/maquinas/${id}`, { notas, tiempo_invertido: tiempo === '' ? null : Number(tiempo) }); cargar(); }
    catch (err) { setError(err.message); }
  }
  async function borrarVuln(vid) {
    if (!window.confirm('¿Borrar esta vulnerabilidad?')) return;
    try { await del(`/vulnerabilidades/${vid}`); cargar(); }
    catch (err) { setError(err.message); }
  }
  const guardadoVuln = () => { setFormVuln(undefined); cargar(); };

  if (error) return <div className="alert alert-danger">Error: {error}</div>;
  if (!m) return <div className="text-secondary">Cargando…</div>;

  const input = 'form-control bg-dark text-light border-secondary';
  return (
    <div className="pb-5">
      <Link to="/maquinas" className="text-secondary text-decoration-none small">← Volver al listado</Link>

      {/* ---- Cabecera ---- */}
      <div className="d-flex align-items-center gap-3 my-2">
        <h4 className="mb-0">{m.nombre}</h4>
        {m.url_htb && <a href={m.url_htb} target="_blank" rel="noreferrer" className="htb-accent small">Abrir en HTB ↗</a>}
      </div>

      {/* ---- Datos de la máquina ---- */}
      <div className="htb-card p-3 mb-3">
        <div className="mb-2">
          {m.certificaciones.map((c) => <span key={c.id} className="htb-badge">{c.nombre}</span>)}
        </div>
        <div className="row g-3">
          <div className="col-auto"><span className="text-secondary small">Nivel:</span> {m.nivel}</div>
          <div className="col-auto"><span className="text-secondary small">Dificultad:</span> {m.dificultad || '—'}</div>
          <div className="col-auto d-flex align-items-center gap-2">
            <span className="text-secondary small">Estado:</span>
            <select className="form-select form-select-sm bg-dark text-light border-secondary"
              value={m.estado} onChange={cambiarEstado} style={{ width: 'auto' }}>
              {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
        {m.tecnicas && <div className="mt-2 small text-secondary">Técnicas: {m.tecnicas}</div>}
        {(m.fecha_inicio || m.fecha_completada) && (
          <div className="mt-2 small text-secondary">
            {m.fecha_inicio && <>Inicio: {new Date(m.fecha_inicio).toLocaleDateString()} </>}
            {m.fecha_completada && <>· Completada: {new Date(m.fecha_completada).toLocaleDateString()}</>}
          </div>
        )}
      </div>

      {/* ---- Notas y tiempo ---- */}
      <div className="htb-card p-3 mb-3">
        <h6>Notas y tiempo</h6>
        <textarea className={input} rows="3" value={notas} onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas generales de la máquina…" />
        <div className="d-flex align-items-center gap-2 mt-2">
          <span className="text-secondary small">Tiempo (min):</span>
          <input className={input} type="number" min="0" style={{ width: 120 }}
            value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
          <button className="btn btn-success btn-sm" onClick={guardarNotas}>Guardar</button>
        </div>
      </div>

      {/* ---- Vulnerabilidades ---- */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">Vulnerabilidades ({m.vulnerabilidades.length})</h6>
        {formVuln === undefined && (
          <button className="btn btn-success btn-sm" onClick={() => setFormVuln(null)}>+ Agregar</button>
        )}
      </div>

      {formVuln !== undefined && (
        <VulnForm key={formVuln ? formVuln.id : 'nueva'} maquinaId={id} vuln={formVuln}
          onGuardado={guardadoVuln} onCancelar={() => setFormVuln(undefined)} />
      )}

      {m.vulnerabilidades.map((v) => (
        <div key={v.id} className="htb-card p-3 mb-2">
          <div className="d-flex justify-content-between">
            <strong>{v.titulo}</strong>
            <div>
              <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setFormVuln(v)}>Editar</button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => borrarVuln(v.id)}>Eliminar</button>
            </div>
          </div>
          <div className="small text-secondary mt-1">
            {v.tipo && <span className="me-2">Tipo: {v.tipo}</span>}
            {v.cve && <span className="me-2">CVE: {v.cve}</span>}
            {v.criticidad && <span className="me-2">Criticidad: {v.criticidad}</span>}
            {v.cvss && <span>CVSS: {v.cvss}</span>}
          </div>
          {v.anotaciones && (
            <pre className="mt-2 mb-0 small" style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1' }}>{v.anotaciones}</pre>
          )}
        </div>
      ))}
      {m.vulnerabilidades.length === 0 && formVuln === undefined && (
        <p className="text-secondary small">Aún no hay vulnerabilidades documentadas.</p>
      )}
    </div>
  );
}
