-- Réplicas físicas NAS: misma clave física en varios directorios relativos al STORAGE_ROOT_PATH
-- Ej. UAS/2026/05/20/, UOP/2026/05/20/, UTI/2026/05/20/ con el mismo NO_ARCHIVO_FISICO
IF COL_LENGTH(N'dbo.NASTM_ARCHIVOS', N'DE_RUTAS_ESPEJO') IS NULL
BEGIN
    ALTER TABLE dbo.NASTM_ARCHIVOS ADD DE_RUTAS_ESPEJO NVARCHAR(MAX) NULL;
    EXEC sys.sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'JSON array de rutas relativas adicionales (sin nombre de archivo) donde existe copia física;',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
        @level2type = N'COLUMN', @level2name = N'DE_RUTAS_ESPEJO';
END
GO
