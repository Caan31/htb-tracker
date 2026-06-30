# Scripts de inicialización de la base de datos

Todo archivo `.sql` o `.sh` que pongas en esta carpeta se ejecuta **automáticamente
y en orden alfabético** la PRIMERA vez que se crea el contenedor de PostgreSQL
(cuando el volumen `db_data` está vacío).

Por eso los nombramos con números:

- `01_schema.sql`  → crea las tablas (Fase 2)
- `02_seed.sql`    → carga las 291 máquinas, certificaciones y niveles (Fase 2)

> Si ya levantaste la BD y cambias estos scripts, tienes que recrearla para que
> se vuelvan a ejecutar: `docker compose down -v && docker compose up -d db`
> (¡`-v` borra los datos!).
