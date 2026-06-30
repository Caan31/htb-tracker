// ------------------------------------------------------------
//  Cliente para hablar con la API.
//  Rutas relativas (/api/...) -> Vite las reenvía al backend (proxy).
// ------------------------------------------------------------
const BASE = '/api';

async function req(path, options) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    // Intentamos leer el mensaje de error que devuelve la API
    let msg = `Error ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch (_) { /* sin cuerpo */ }
    throw new Error(msg);
  }
  if (res.status === 204) return null; // DELETE sin contenido
  return res.json();
}

const json = (body) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const getJSON   = (path)        => req(path);
export const postJSON  = (path, body)  => req(path, { method: 'POST',  ...json(body) });
export const putJSON   = (path, body)  => req(path, { method: 'PUT',   ...json(body) });
export const patchJSON = (path, body)  => req(path, { method: 'PATCH', ...json(body) });
export const del       = (path)        => req(path, { method: 'DELETE' });
