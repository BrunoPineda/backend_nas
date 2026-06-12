import { query } from '../connection';

export async function ensureRolIntranetIdColumn(): Promise<void> {
  await query(
    `IF COL_LENGTH('dbo.NASTM_ROLES', 'NU_ID_ROL_INTRANET') IS NULL
     ALTER TABLE dbo.NASTM_ROLES ADD NU_ID_ROL_INTRANET INT NULL`,
    []
  );
}
