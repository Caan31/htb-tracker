import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { getJSON } from '../api';

// Barra de progreso reutilizable
function Barra({ valor, total }) {
  const pct = total ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="htb-progress my-1">
      <div className="htb-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

// Tarjeta de resumen (un número grande con etiqueta)
function StatCard({ etiqueta, valor, sub }) {
  return (
    <div className="htb-card p-3 h-100">
      <div className="text-secondary small text-uppercase">{etiqueta}</div>
      <div className="h2 mb-0 htb-accent">{valor}</div>
      {sub && <div className="small text-secondary">{sub}</div>}
    </div>
  );
}

const COLORES_DIFICULTAD = {
  Easy: '#9fef00', Medium: '#ffb000', Hard: '#ff3e3e', Insane: '#a371f7', 'Sin asignar': '#5a6b85',
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getJSON('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div className="alert alert-danger">No se pudo cargar el dashboard: {error}</div>;
  }
  if (!data) {
    return <div className="text-secondary">Cargando dashboard…</div>;
  }

  const { general, por_certificacion, por_dificultad, vulnerabilidades } = data;

  return (
    <div className="pb-5">
      {/* ---- RESUMEN GENERAL ---- */}
      <h5 className="mb-3">Resumen general</h5>
      <div className="row g-3 mb-2">
        <div className="col-6 col-md-3">
          <StatCard etiqueta="Máquinas" valor={general.total} sub="total" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard etiqueta="Completadas" valor={general.completadas} sub={`${general.porcentaje}%`} />
        </div>
        <div className="col-6 col-md-3">
          <StatCard etiqueta="En progreso" valor={general.en_progreso} />
        </div>
        <div className="col-6 col-md-3">
          <StatCard etiqueta="Pendientes" valor={general.pendientes} />
        </div>
      </div>

      <div className="htb-card p-3 mb-4">
        <div className="d-flex justify-content-between small mb-1">
          <span>Progreso general</span>
          <span>{general.completadas}/{general.total} ({general.porcentaje}%)</span>
        </div>
        <Barra valor={general.completadas} total={general.total} />
      </div>

      {/* ---- PROGRESO POR CERTIFICACIÓN ---- */}
      <h5 className="mb-3">Progreso por certificación</h5>
      <div className="row g-3 mb-4">
        {por_certificacion.map((c) => (
          <div className="col-12 col-lg-6" key={c.id}>
            <div className="htb-card p-3 h-100">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <strong>{c.nombre}</strong>
                <span className="small text-secondary">
                  {c.completadas}/{c.total} ({c.porcentaje}%)
                </span>
              </div>
              <Barra valor={c.completadas} total={c.total} />
              <div className="mt-2">
                <span className="htb-badge">F: {c.niveles.Fundamentals.completadas}/{c.niveles.Fundamentals.total}</span>
                <span className="htb-badge">I: {c.niveles.Intermediate.completadas}/{c.niveles.Intermediate.total}</span>
                <span className="htb-badge">A: {c.niveles.Advanced.completadas}/{c.niveles.Advanced.total}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ---- GRÁFICOS ---- */}
      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <div className="htb-card p-3 h-100">
            <h6 className="mb-3">Máquinas por dificultad</h6>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={por_dificultad}>
                <XAxis dataKey="dificultad" stroke="#9aa7bd" />
                <YAxis stroke="#9aa7bd" allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0b1120', border: '1px solid #2a3b52' }} />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#5a6b85" />
                <Bar dataKey="completadas" name="Completadas">
                  {por_dificultad.map((d) => (
                    <Cell key={d.dificultad} fill={COLORES_DIFICULTAD[d.dificultad] || '#9fef00'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="htb-card p-3 h-100">
            <h6 className="mb-3">
              Vulnerabilidades documentadas <span className="htb-accent">({vulnerabilidades.total})</span>
            </h6>
            {vulnerabilidades.total === 0 ? (
              <p className="text-secondary small mb-0">
                Aún no has documentado vulnerabilidades. Aparecerán aquí cuando las añadas a tus máquinas.
              </p>
            ) : (
              <>
                <div className="small text-secondary mb-1">Por tipo</div>
                {vulnerabilidades.por_tipo.map((t) => (
                  <span className="htb-badge mb-1" key={t.tipo}>{t.tipo}: {t.total}</span>
                ))}
                <div className="small text-secondary mt-3 mb-1">Por criticidad</div>
                {vulnerabilidades.por_criticidad.map((c) => (
                  <span className="htb-badge mb-1" key={c.criticidad}>{c.criticidad}: {c.total}</span>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
