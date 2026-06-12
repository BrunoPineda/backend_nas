import { query } from '../connection';

/**
 * Garantiza la columna DE_RUTAS_ESPEJO en NASTM_ARCHIVOS (réplicas físicas NAS).
 * Evita tener que ejecutar manualmente database/7.alter-archivo-rutas-espejo.sql en cada entorno.
 */
export async function ensureArchivoRutasEspejoColumn(): Promise<void> {
  await query(
    `
IF COL_LENGTH(N'dbo.NASTM_ARCHIVOS', N'DE_RUTAS_ESPEJO') IS NULL
BEGIN
  ALTER TABLE dbo.NASTM_ARCHIVOS ADD DE_RUTAS_ESPEJO NVARCHAR(MAX) NULL;
END
`,
    []
  );
}
