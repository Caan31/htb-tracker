import { useEffect, useState } from 'react';
import { getJSON, postJSON, del } from '../api';

export default function HtbConfig() {
  const [status, setStatus] = useState(null);
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [sync, setSync] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargarStatus = () => getJSON('/htb/status').then(setStatus).catch((e) => setError(e.message));
  useEffect(() => { cargarStatus(); }, []);

  async function guardar(e) {
    e.preventDefault();
    setError(null); setMsg(null); setCargando(true);
    try {
      const r = await postJSON('/htb/authenticate', { app_token: token });
      setMsg(`Token guardado. Conectado como ${r.usuario}.`);
      setToken('');
      await cargarStatus();
    } catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }

  async function sincronizar() {
    setError(null); setSync(null); setCargando(true);
    try {
      const r = await postJSON('/htb/sync', {});
      setSync(r);
      await cargarStatus();
    } catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }

  async function eliminar() {
    if (!window.confirm('¿Eliminar la API key guardada?')) return;
    setError(null); setMsg(null); setSync(null);
    try { await del('/htb/api-key'); await cargarStatus(); }
    catch (err) { setError(err.message); }
  }

  const input = 'form-control bg-dark text-light border-secondary';

  return (
    <div className="pb-5" style={{ maxWidth: 720 }}>
      <h5 className="mb-3">Integración con HackTheBox</h5>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {msg && <div className="alert alert-success py-2">{msg}</div>}

      {/* ---- Configuración del token ---- */}
      <div className="htb-card p-3 mb-3">
        <h6>API Key (App Token)</h6>
        <p className="small text-secondary">
          Genera tu token en HackTheBox → Profile Settings → <strong>App Tokens</strong> → Create App Token,
          y pégalo aquí.
        </p>
        <form onSubmit={guardar} className="d-flex gap-2">
          <input className={input} type="password" placeholder="Pega tu App Token…"
            value={token} onChange={(e) => setToken(e.target.value)} required />
          <button className="btn btn-success" disabled={cargando}>Guardar y verificar</button>
        </form>
      </div>

      {/* ---- Estado y sincronización ---- */}
      {status?.configurado ? (
        <div className="htb-card p-3 mb-3">
          <h6>Estado</h6>
          <div className="small">
            <div>Usuario HTB: <span className="htb-accent">{status.usuario}</span></div>
            <div className="text-secondary">
              Última sincronización: {status.ultimo_sync ? new Date(status.ultimo_sync).toLocaleString() : 'nunca'}
            </div>
            {status.maquinas_resueltas != null && (
              <div className="text-secondary">Máquinas resueltas en HTB (último sync): {status.maquinas_resueltas}</div>
            )}
          </div>
          <div className="mt-3 d-flex gap-2">
            <button className="btn btn-success btn-sm" onClick={sincronizar} disabled={cargando}>
              {cargando ? 'Sincronizando…' : '🔄 Sincronizar ahora'}
            </button>
            <button className="btn btn-outline-danger btn-sm" onClick={eliminar}>Eliminar API key</button>
          </div>
        </div>
      ) : (
        <p className="text-secondary small">Aún no has configurado tu API key.</p>
      )}

      {/* ---- Resultado del sync ---- */}
      {sync && (
        <div className="htb-card p-3">
          <h6>Resultado de la sincronización</h6>
          <div className="small">
            <div>Resueltas detectadas en HTB: {sync.total_resueltas_htb}</div>
            <div className="htb-accent">Nuevas marcadas como completadas: {sync.nuevas_completadas.length}</div>
            {sync.nuevas_completadas.length > 0 && (
              <div className="mt-1">
                {sync.nuevas_completadas.map((n) => <span key={n} className="htb-badge">{n}</span>)}
              </div>
            )}
            <div className="text-secondary mt-2">Ya estaban completadas: {sync.ya_estaban}</div>
            {sync.no_encontradas.length > 0 && (
              <div className="text-secondary mt-2">
                Resueltas en HTB que no están en tu lista ({sync.no_encontradas.length}):{' '}
                {sync.no_encontradas.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
