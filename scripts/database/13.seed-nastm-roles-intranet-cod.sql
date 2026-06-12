-- =============================================================================
-- DB_NAS — Vincular roles NAS con COD Intranet (BDJUNTOS.tbl_ctrl_usuarios_rol.iId)
-- =============================================================================
-- IMPORTANTE: la llave es NU_ID_ROL_INTRANET (= COD de la captura).
--   • Si el rol ya existe por ese COD → solo actualiza NO_ROL / DE_ROL.
--   • Si no existe → lo inserta con ese COD fijo.
--   • El COD (1072–1080) NO se pisa en updates; es lo que usa el módulo para
--     saber qué rol Intranet corresponde a cada NAS_* al login y en permisos.
--
-- Ejecutar en: DB_NAS (192.168.125.31)
-- =============================================================================

IF COL_LENGTH('dbo.NASTM_ROLES', 'NU_ID_ROL_INTRANET') IS NULL
BEGIN
  ALTER TABLE dbo.NASTM_ROLES ADD NU_ID_ROL_INTRANET INT NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'UX_NASTM_ROLES_INTRANET' AND object_id = OBJECT_ID(N'dbo.NASTM_ROLES')
)
BEGIN
  CREATE UNIQUE INDEX UX_NASTM_ROLES_INTRANET ON dbo.NASTM_ROLES (NU_ID_ROL_INTRANET)
  WHERE NU_ID_ROL_INTRANET IS NOT NULL;
END
GO

-- Datos iguales a ConectaJuntos / BDJUNTOS (COD, NOMBRE, DESCRIPCIÓN)
MERGE dbo.NASTM_ROLES AS t
USING (VALUES
  (1072, N'NAS_ADMIN', N'00 UTI - Admin NAS',           N'Usuario administrador para modulo de NAS'),
  (1073, N'NAS_UCI',   N'00 UCI - NAS',                 N'usuario para gestión de carga de archivos NAS'),
  (1074, N'NAS_UAS',   N'00 UAS - NAS',                 N'usuario para gestión de carga de archivos NAS'),
  (1075, N'NAS_UOP',   N'00 UOP - NAS',                 N'usuario para gestión de carga de archivos NAS'),
  (1076, N'NAS_UTI',   N'00 UTI - NAS',                 N'usuario para gestión de carga de archivos NAS'),
  (1077, N'NAS_UA',    N'00 UA - NAS',                  N'usuario para gestión de carga de archivos NAS'),
  (1078, N'NAS_UI',    N'00 UI - NAS',                  N'Personal de la Unidad de Integridad'),
  (1079, N'NAS_UPPM',  N'00 UPPM- NAS',                 N'usuario para gestión de carga de archivos NAS'),
  (1080, N'NAS_URH',   N'00 URH- NAS',                  N'usuario para gestión de carga de archivos NAS')
) AS s (NU_ID_ROL_INTRANET, NO_ROL, DE_ROL_INTRANET, DE_ROL)
ON t.NU_ID_ROL_INTRANET = s.NU_ID_ROL_INTRANET
WHEN MATCHED THEN
  UPDATE SET
    NO_ROL           = s.NO_ROL,
    DE_ROL           = s.DE_ROL_INTRANET,
    FE_ACTUALIZACION = SYSUTCDATETIME()
WHEN NOT MATCHED BY TARGET THEN
  INSERT (NO_ROL, DE_ROL, IN_ES_SISTEMA, NU_ID_ROL_INTRANET)
  VALUES (s.NO_ROL, s.DE_ROL_INTRANET, 1, s.NU_ID_ROL_INTRANET);
GO

-- Roles NAS_* creados antes sin COD: asignar NU_ID_ROL_INTRANET por NO_ROL (solo si falta)
UPDATE r
SET r.NU_ID_ROL_INTRANET = m.NU_ID_ROL_INTRANET,
    r.FE_ACTUALIZACION   = SYSUTCDATETIME()
FROM dbo.NASTM_ROLES AS r
INNER JOIN (VALUES
  (N'NAS_ADMIN', 1072),
  (N'NAS_UCI',   1073),
  (N'NAS_UAS',   1074),
  (N'NAS_UOP',   1075),
  (N'NAS_UTI',   1076),
  (N'NAS_UA',    1077),
  (N'NAS_UI',    1078),
  (N'NAS_UPPM',  1079),
  (N'NAS_URH',   1080)
) AS m (NO_ROL, NU_ID_ROL_INTRANET) ON m.NO_ROL = r.NO_ROL
WHERE r.NU_ID_ROL_INTRANET IS NULL;
GO

-- Verificación: COD Intranet ↔ rol NAS local
SELECT
  r.NU_ID_ROL_INTRANET AS COD_Intranet,
  r.NO_ROL             AS Rol_NAS,
  r.DE_ROL             AS Descripcion,
  r.ID_ROL             AS Id_UUID_DB_NAS
FROM dbo.NASTM_ROLES AS r
WHERE r.NU_ID_ROL_INTRANET BETWEEN 1072 AND 1080
ORDER BY r.NU_ID_ROL_INTRANET;
GO

-- Permisos base (NAS_ADMIN → ADMIN legacy; operativos → USER legacy)
INSERT INTO dbo.NASTD_ROLES_PERMISOS (ID_ROL, ID_PERMISO)
SELECT na.ID_ROL, rp.ID_PERMISO
FROM dbo.NASTM_ROLES AS na
INNER JOIN dbo.NASTM_ROLES AS leg ON leg.NO_ROL = N'ADMIN'
INNER JOIN dbo.NASTD_ROLES_PERMISOS AS rp ON rp.ID_ROL = leg.ID_ROL
WHERE na.NO_ROL = N'NAS_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.NASTD_ROLES_PERMISOS AS x
    WHERE x.ID_ROL = na.ID_ROL AND x.ID_PERMISO = rp.ID_PERMISO
  );
GO

INSERT INTO dbo.NASTD_ROLES_PERMISOS (ID_ROL, ID_PERMISO)
SELECT na.ID_ROL, rp.ID_PERMISO
FROM dbo.NASTM_ROLES AS na
INNER JOIN dbo.NASTM_ROLES AS leg ON leg.NO_ROL = N'USER'
INNER JOIN dbo.NASTD_ROLES_PERMISOS AS rp ON rp.ID_ROL = leg.ID_ROL
WHERE na.NO_ROL LIKE N'NAS_%' AND na.NO_ROL <> N'NAS_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.NASTD_ROLES_PERMISOS AS x
    WHERE x.ID_ROL = na.ID_ROL AND x.ID_PERMISO = rp.ID_PERMISO
  );
GO

-- Matriz roles × categorías (si ya existe NASTD_ROLES_CATEGORIAS)
IF OBJECT_ID(N'dbo.NASTD_ROLES_CATEGORIAS', N'U') IS NOT NULL
BEGIN
  INSERT INTO dbo.NASTD_ROLES_CATEGORIAS (ID_ROL, ID_CATEGORIA)
  SELECT r.ID_ROL, c.ID_CATEGORIA
  FROM dbo.NASTM_ROLES AS r
  INNER JOIN dbo.NASTM_CATEGORIAS AS c
    ON c.CO_CATEGORIA = REPLACE(r.NO_ROL, N'NAS_', N'')
  WHERE r.NO_ROL LIKE N'NAS_%' AND r.NO_ROL <> N'NAS_ADMIN'
    AND NOT EXISTS (
      SELECT 1 FROM dbo.NASTD_ROLES_CATEGORIAS AS x
      WHERE x.ID_ROL = r.ID_ROL AND x.ID_CATEGORIA = c.ID_CATEGORIA
    );

  INSERT INTO dbo.NASTD_ROLES_CATEGORIAS (ID_ROL, ID_CATEGORIA)
  SELECT r.ID_ROL, c.ID_CATEGORIA
  FROM dbo.NASTM_ROLES AS r
  CROSS JOIN dbo.NASTM_CATEGORIAS AS c
  WHERE r.NO_ROL = N'NAS_ADMIN'
    AND (c.ES_VIGENTE = 1 OR c.ES_VIGENTE IS NULL)
    AND NOT EXISTS (
      SELECT 1 FROM dbo.NASTD_ROLES_CATEGORIAS AS x
      WHERE x.ID_ROL = r.ID_ROL AND x.ID_CATEGORIA = c.ID_CATEGORIA
    );
END
GO
