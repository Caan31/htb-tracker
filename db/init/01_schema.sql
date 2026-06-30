-- ============================================================
--  HTB TRACKER · Esquema de base de datos (PostgreSQL)
--  Se ejecuta automáticamente al crear el contenedor de la BD.
-- ============================================================
-- Relaciones:
--   certificaciones 1───∞ niveles
--   maquinas ∞───∞ certificaciones   (vía maquina_certificacion)
--   maquinas 1───∞ vulnerabilidades
-- ============================================================

-- Función reutilizable: pone updated_at = ahora en cada UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 1) CERTIFICACIONES
-- ------------------------------------------------------------
CREATE TABLE certificaciones (
  id                 SERIAL PRIMARY KEY,
  nombre             VARCHAR(50)  NOT NULL UNIQUE,   -- eJPT, eCPPT...
  descripcion        TEXT,
  objetivo           TEXT,
  requisitos_previos TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_certificaciones_updated
  BEFORE UPDATE ON certificaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 2) NIVELES  (3 por certificación: Fundamentals/Intermediate/Advanced)
-- ------------------------------------------------------------
CREATE TABLE niveles (
  id               SERIAL PRIMARY KEY,
  certificacion_id INT NOT NULL REFERENCES certificaciones(id) ON DELETE CASCADE,
  numero_nivel     SMALLINT NOT NULL,               -- 1, 2, 3
  nombre           VARCHAR(50) NOT NULL,            -- Fundamentals...
  descripcion      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (certificacion_id, numero_nivel)
);

CREATE TRIGGER trg_niveles_updated
  BEFORE UPDATE ON niveles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 3) MAQUINAS  (291 únicas; el nivel es global y consistente)
-- ------------------------------------------------------------
CREATE TABLE maquinas (
  id               SERIAL PRIMARY KEY,
  nombre           VARCHAR(100) NOT NULL UNIQUE,
  nivel            VARCHAR(20)  NOT NULL
                     CHECK (nivel IN ('Fundamentals','Intermediate','Advanced')),
  dificultad       VARCHAR(10)
                     CHECK (dificultad IN ('Easy','Medium','Hard','Insane')),  -- NULL = aún sin saber
  estado           VARCHAR(15)  NOT NULL DEFAULT 'Pendiente'
                     CHECK (estado IN ('Pendiente','En Progreso','Completada')),
  url_htb          VARCHAR(255),
  htb_machine_id   INT,                             -- para vincular con la API de HTB
  tecnicas         TEXT,                            -- etiquetas separadas por comas
  notas            TEXT,
  fecha_inicio     TIMESTAMPTZ,
  fecha_completada TIMESTAMPTZ,
  tiempo_invertido INT,                             -- minutos
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_maquinas_updated
  BEFORE UPDATE ON maquinas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 4) MAQUINA_CERTIFICACION  (tabla puente: relación muchos-a-muchos)
--    Una máquina puede servir para varias certificaciones.
-- ------------------------------------------------------------
CREATE TABLE maquina_certificacion (
  maquina_id       INT NOT NULL REFERENCES maquinas(id)        ON DELETE CASCADE,
  certificacion_id INT NOT NULL REFERENCES certificaciones(id) ON DELETE CASCADE,
  PRIMARY KEY (maquina_id, certificacion_id)        -- evita duplicados del mismo par
);

CREATE INDEX idx_mc_certificacion ON maquina_certificacion(certificacion_id);

-- ------------------------------------------------------------
-- 5) VULNERABILIDADES  (las irás creando desde la app)
-- ------------------------------------------------------------
CREATE TABLE vulnerabilidades (
  id          SERIAL PRIMARY KEY,
  maquina_id  INT NOT NULL REFERENCES maquinas(id) ON DELETE CASCADE,
  cve         VARCHAR(30),
  titulo      VARCHAR(150) NOT NULL,
  tipo        VARCHAR(40),                          -- SQLi, RCE, LFI, XSS...
  criticidad  VARCHAR(10)
                CHECK (criticidad IN ('Baja','Media','Alta','Crítica')),
  cvss        NUMERIC(3,1),                         -- 0.0 a 10.0
  descripcion TEXT,
  anotaciones TEXT,                                 -- markdown
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vuln_maquina ON vulnerabilidades(maquina_id);

CREATE TRIGGER trg_vulnerabilidades_updated
  BEFORE UPDATE ON vulnerabilidades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 6) SINCRONIZACION_HTB  (registro de cada sync con la API de HTB)
-- ------------------------------------------------------------
CREATE TABLE sincronizacion_htb (
  id                 SERIAL PRIMARY KEY,
  usuario_htb_id     INT,
  ultimo_sync        TIMESTAMPTZ,
  maquinas_resueltas INT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_sincronizacion_updated
  BEFORE UPDATE ON sincronizacion_htb
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
