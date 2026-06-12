-- Añade modo Privado al usuario (solo enlaces públicos visibles para terceros).
-- Ejecutar una vez sobre DB_NAS si ya existía el esquema sin esta columna.

USE [DB_NAS];
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.NASTM_USUARIOS') AND name = N'IN_ES_PRIVADO'
)
BEGIN
  ALTER TABLE dbo.NASTM_USUARIOS ADD
    IN_ES_PRIVADO BIT NOT NULL CONSTRAINT DF_NASTM_USU_IN_PRIVADO DEFAULT 0;
END
GO
