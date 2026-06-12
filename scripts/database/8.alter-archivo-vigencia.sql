-- Disponibilidad por fecha y hora al subir (permanente vs ventana inicio/fin).
-- Pasado FE_FIN_VIGENCIA el job marca FE_BAJA (inactivo automático).

IF COL_LENGTH(N'dbo.NASTM_ARCHIVOS', N'IN_ES_PERMANENTE') IS NULL
BEGIN
    ALTER TABLE dbo.NASTM_ARCHIVOS ADD
        IN_ES_PERMANENTE BIT NOT NULL CONSTRAINT DF_NASTM_ARCH_IN_PERM DEFAULT 1,
        FE_INICIO_VIGENCIA DATETIME2(7) NULL,
        FE_FIN_VIGENCIA DATETIME2(7) NULL;
END
GO

-- Si ya existían como DATE (versión anterior), ampliar a fecha+hora UTC.
IF EXISTS (
    SELECT 1
    FROM sys.columns AS c
    INNER JOIN sys.types AS t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.NASTM_ARCHIVOS')
      AND c.name = N'FE_FIN_VIGENCIA'
      AND t.name = N'date'
)
BEGIN
    ALTER TABLE dbo.NASTM_ARCHIVOS ALTER COLUMN FE_INICIO_VIGENCIA DATETIME2(7) NULL;
    ALTER TABLE dbo.NASTM_ARCHIVOS ALTER COLUMN FE_FIN_VIGENCIA DATETIME2(7) NULL;
END
GO
