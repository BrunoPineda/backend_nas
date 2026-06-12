# Calidad — base de datos DB_NAS (script único)

## Archivo principal

Ejecutá **`DB_NAS_COMPLETO_CALIDAD.sql`** en una sola corrida en SQL Server (SSMS / Azure Data Studio).

Incluye, en orden lógico:

| Origen consolidado | Contenido |
|--------------------|-----------|
| `../1.init.sql` | Creación de base `DB_NAS` si no existe |
| `../2.database-clean-sqlserver.sql` | Esquema completo: tablas maestras, índices, función, vista, datos iniciales |
| `../5.alter-politica-subida-carpetas.sql` | `NASTM_CARPETA_POLITICA_SUBIDA` y `NASTD_POLITICA_SUBIDA_EXENTOS` |
| `../7.alter-archivo-rutas-espejo.sql` | Columna `DE_RUTAS_ESPEJO` en `NASTM_ARCHIVOS` (ya dentro del `CREATE TABLE`) |
| `../8.alter-archivo-vigencia.sql` | `IN_ES_PERMANENTE`, `FE_INICIO_VIGENCIA`, `FE_FIN_VIGENCIA` (`DATETIME2`, inactivación automática al vencer) |

Ya **no hace falta** ejecutar por separado `3`, `4`, `6`, `7` ni `8`: esas mejoras están en este script único.

## Advertencias

1. Este script es un **fresh install**: al inicio elimina vistas, función, tablas del modelo anterior y las vuelve a crear.
2. Tras ejecutarlo, configurá **`backend/.env`** con el mismo servidor y base **`DB_NAS`**.
3. En disco, el backend guarda bajo **`STORAGE_ROOT/{AREA}/{YYYY}/{MM}/{DD}/`** según la app Node actual.
