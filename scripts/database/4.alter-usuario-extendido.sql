-- Añade columnas para sincronización por DNI y campos extendidos de ConectaJuntos.
-- Ejecutar una vez sobre DB_NAS si ya existe el esquema y no deseas borrar la base de datos.

USE [DB_NAS];
GO

-- 1. Agregar columnas si no existen
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.NASTM_USUARIOS') AND name = N'NU_DNI')
BEGIN
    ALTER TABLE dbo.NASTM_USUARIOS ADD
        NU_DNI VARCHAR(20) NULL,
        NO_NOMBRE VARCHAR(100) NULL,
        AP_PATERNO VARCHAR(100) NULL,
        AP_MATERNO VARCHAR(100) NULL,
        NO_USUARIO VARCHAR(100) NULL,
        NU_TELEFONO VARCHAR(50) NULL;
END
GO

-- 2. Crear índice único filtrado para DNI si no existe
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.NASTM_USUARIOS') AND name = N'UX_NASTM_USUARIOS_DNI')
BEGIN
    CREATE UNIQUE INDEX UX_NASTM_USUARIOS_DNI 
    ON dbo.NASTM_USUARIOS (NU_DNI) 
    WHERE NU_DNI IS NOT NULL;
END
GO
