import { query } from '../connection';

/** Columna ES_VIGENTE en NASTM_CATEGORIAS (inactivar categoría sin borrar). */
export async function ensureCategoriaEsVigenteColumn(): Promise<void> {
  await query(
    `
IF COL_LENGTH(N'dbo.NASTM_CATEGORIAS', N'ES_VIGENTE') IS NULL
BEGIN
  ALTER TABLE dbo.NASTM_CATEGORIAS ADD
    ES_VIGENTE BIT NOT NULL CONSTRAINT DF_NASTM_CAT_ES_VIGENTE DEFAULT 1;
END
`,
    []
  );
}
