-- Eleva el límite por archivo de 100 MB a 1 GiB (usuarios existentes y default de columna).
USE DB_NAS;
GO

IF EXISTS (
  SELECT 1
  FROM sys.default_constraints dc
  INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
  INNER JOIN sys.tables t ON t.object_id = c.object_id
  WHERE t.name = N'NASTM_USUARIOS' AND c.name = N'CA_MAX_ARCHIVO_BYTES'
)
BEGIN
  DECLARE @dfName SYSNAME;
  SELECT @dfName = dc.name
  FROM sys.default_constraints dc
  INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
  INNER JOIN sys.tables t ON t.object_id = c.object_id
  WHERE t.name = N'NASTM_USUARIOS' AND c.name = N'CA_MAX_ARCHIVO_BYTES';

  EXEC(N'ALTER TABLE dbo.NASTM_USUARIOS DROP CONSTRAINT [' + @dfName + N']');
END
GO

ALTER TABLE dbo.NASTM_USUARIOS
  ADD CONSTRAINT DF_NASTM_USUARIOS_MAX_ARCH DEFAULT (1073741824) FOR CA_MAX_ARCHIVO_BYTES;
GO

UPDATE dbo.NASTM_USUARIOS
SET CA_MAX_ARCHIVO_BYTES = 1073741824
WHERE CA_MAX_ARCHIVO_BYTES = 104857600;
GO
