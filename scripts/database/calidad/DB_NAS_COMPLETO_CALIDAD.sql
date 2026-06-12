-- =============================================================================
-- DB_NAS — Script ÚNICO CALIDAD (instalación limpia)
-- -----------------------------------------------------------------------------
-- Incluye: esquema de `database/2.database-clean-sqlserver.sql`,
-- políticas de subida (`database/5.alter-politica-subida-carpetas.sql`),
-- columna réplicas físicas DE_RUTAS_ESPEJO (`database/7.alter-archivo-rutas-espejo.sql`),
-- vigencia por fecha/hora IN_ES_PERMANENTE / FE_INICIO_VIGENCIA / FE_FIN_VIGENCIA (`database/8.alter-archivo-vigencia.sql`).
--
-- Los scripts `3`, `4`, `6` y `7`/`8` no se ejecutan aparte: todo queda en este CREATE.
--
-- Uso: ejecutar íntegro. Crea DB_NAS si no existe y elimina objetos del modelo previo.
-- Rutas físicas en app: STORAGE_ROOT/{AREA}/{YYYY}/{MM}/{DD}/<archivo>
-- =============================================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'DB_NAS')
BEGIN
    CREATE DATABASE DB_NAS;
END
GO

-- ============================================
-- SISTEMA NAS — Almacenamiento de archivos
-- Microsoft SQL Server
--
-- Convención (equivalente CHATBOT CB*, aplicada a NAS):
--   NASTC_  cabecera | NASTM_ maestra | NASTD_ detalle | NASTV_ movimiento
--   NASPK_  módulo/paquete lógico de rutinas (sin objeto en T-SQL; prefijo NASFU_ en funciones)
--   IDU_*   índice/constraint único | IDX_* índice estándar
--   NASFU_  función | NASVM_ vista maestra | NASVV_ vista movimiento
--
-- Conexión: USE [DB_NAS] después de ejecutar los bloques iniciales.
-- ============================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [DB_NAS];
GO

-- ---------------------------------------------------------------------------
-- Eliminación (dependencias primero)
-- ---------------------------------------------------------------------------

IF OBJECT_ID(N'dbo.NASVM_ESTADISTICAS_USUARIO', N'V') IS NOT NULL
    DROP VIEW dbo.NASVM_ESTADISTICAS_USUARIO;
GO

IF OBJECT_ID(N'dbo.NASFU_CALCULAR_ALMACENAMIENTO_USUARIO', N'FN') IS NOT NULL
    DROP FUNCTION dbo.NASFU_CALCULAR_ALMACENAMIENTO_USUARIO;
GO

IF OBJECT_ID(N'dbo.NASTV_REFRESH_TOKENS', N'U') IS NOT NULL
    DROP TABLE dbo.NASTV_REFRESH_TOKENS;
IF OBJECT_ID(N'dbo.NASTD_ROLES_PERMISOS', N'U') IS NOT NULL
    DROP TABLE dbo.NASTD_ROLES_PERMISOS;
IF OBJECT_ID(N'dbo.NASTM_PERMISOS', N'U') IS NOT NULL
    DROP TABLE dbo.NASTM_PERMISOS;
IF OBJECT_ID(N'dbo.NASTV_AUDITORIA', N'U') IS NOT NULL
    DROP TABLE dbo.NASTV_AUDITORIA;
IF OBJECT_ID(N'dbo.NASTM_ENLACES', N'U') IS NOT NULL
    DROP TABLE dbo.NASTM_ENLACES;
IF OBJECT_ID(N'dbo.NASTM_ARCHIVOS', N'U') IS NOT NULL
    DROP TABLE dbo.NASTM_ARCHIVOS;
IF OBJECT_ID(N'dbo.NASTD_POLITICA_SUBIDA_EXENTOS', N'U') IS NOT NULL
    DROP TABLE dbo.NASTD_POLITICA_SUBIDA_EXENTOS;
IF OBJECT_ID(N'dbo.NASTM_CARPETA_POLITICA_SUBIDA', N'U') IS NOT NULL
    DROP TABLE dbo.NASTM_CARPETA_POLITICA_SUBIDA;
IF OBJECT_ID(N'dbo.NASTD_CARPETAS_COMPARTIDAS', N'U') IS NOT NULL
    DROP TABLE dbo.NASTD_CARPETAS_COMPARTIDAS;
IF OBJECT_ID(N'dbo.NASTM_CARPETAS', N'U') IS NOT NULL
    DROP TABLE dbo.NASTM_CARPETAS;
IF OBJECT_ID(N'dbo.NASTD_USUARIO_CATEGORIAS', N'U') IS NOT NULL
    DROP TABLE dbo.NASTD_USUARIO_CATEGORIAS;
IF OBJECT_ID(N'dbo.NASTM_USUARIOS', N'U') IS NOT NULL
    DROP TABLE dbo.NASTM_USUARIOS;
IF OBJECT_ID(N'dbo.NASTM_CATEGORIAS', N'U') IS NOT NULL
    DROP TABLE dbo.NASTM_CATEGORIAS;
IF OBJECT_ID(N'dbo.NASTM_ROLES', N'U') IS NOT NULL
    DROP TABLE dbo.NASTM_ROLES;
GO

-- ---------------------------------------------------------------------------
-- NASTM_ROLES — maestra
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTM_ROLES (
    ID_ROL UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTM_ROLES PRIMARY KEY DEFAULT NEWID(),
    NO_ROL VARCHAR(100) NOT NULL,
    DE_ROL NVARCHAR(MAX) NULL,
    IN_ES_SISTEMA BIT NOT NULL CONSTRAINT DF_NASTM_ROLES_IN_ES_SISTEMA DEFAULT 0,
    FE_CREACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTM_ROLES_FE_CREACION DEFAULT SYSUTCDATETIME(),
    FE_ACTUALIZACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTM_ROLES_FE_ACTUALIZACION DEFAULT SYSUTCDATETIME(),
    CONSTRAINT IDU_NASTM_ROLES_NO_ROL UNIQUE (NO_ROL)
);
GO

-- ---------------------------------------------------------------------------
-- NASTM_CATEGORIAS — maestra (unidades / categorías de negocio)
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTM_CATEGORIAS (
    ID_CATEGORIA UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTM_CATEGORIAS PRIMARY KEY DEFAULT NEWID(),
    CO_CATEGORIA VARCHAR(32) NOT NULL,
    DE_CATEGORIA NVARCHAR(500) NOT NULL,
    FE_CREACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTM_CAT_FE_CREACION DEFAULT SYSUTCDATETIME(),
    ES_VIGENTE BIT NOT NULL CONSTRAINT DF_NASTM_CAT_ES_VIGENTE DEFAULT 1,
    CONSTRAINT IDU_NASTM_CATEGORIAS_CODIGO UNIQUE (CO_CATEGORIA)
);

CREATE INDEX IDX_NASTM_CATEGORIAS_CO ON dbo.NASTM_CATEGORIAS (CO_CATEGORIA);
GO

-- ---------------------------------------------------------------------------
-- NASTM_USUARIOS — maestra
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTM_USUARIOS (
    ID_USUARIO UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTM_USUARIOS PRIMARY KEY DEFAULT NEWID(),
    NO_COMPLETO VARCHAR(255) NOT NULL,
    DI_CORREO VARCHAR(255) NOT NULL,
    CO_PASSWORD_HASH VARCHAR(255) NOT NULL,
    ID_ROL UNIQUEIDENTIFIER NULL,
    ES_VIGENTE BIT NOT NULL CONSTRAINT DF_NASTM_USUARIOS_ES_VIGENTE DEFAULT 1,
    IN_ES_PRIVADO BIT NOT NULL CONSTRAINT DF_NASTM_USU_IN_PRIVADO DEFAULT 0,
    CA_LIMITE_ALMACENAMIENTO_BYTES BIGINT NOT NULL CONSTRAINT DF_NASTM_USUARIOS_LIMITE DEFAULT 1073741824,
    CA_MAX_ARCHIVO_BYTES BIGINT NOT NULL CONSTRAINT DF_NASTM_USUARIOS_MAX_ARCH DEFAULT 1073741824,
    FE_CREACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTM_USUARIOS_FE_CREACION DEFAULT SYSUTCDATETIME(),
    FE_ACTUALIZACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTM_USUARIOS_FE_ACTUALIZACION DEFAULT SYSUTCDATETIME(),
    FE_ULTIMO_LOGIN DATETIME2(7) NULL,
    NU_DNI VARCHAR(20) NULL,
    NU_NUMERO_DOCUMENTO VARCHAR(20) NOT NULL,
    NO_NOMBRE VARCHAR(100) NULL,
    AP_PATERNO VARCHAR(100) NULL,
    AP_MATERNO VARCHAR(100) NULL,
    NO_USUARIO VARCHAR(100) NULL,
    NU_TELEFONO VARCHAR(50) NULL,
    CONSTRAINT IDU_NASTM_USUARIOS_CORREO UNIQUE (DI_CORREO),
    CONSTRAINT CK_NASTM_USUARIOS_LIMITE_ALMACEN
        CHECK (
            CA_LIMITE_ALMACENAMIENTO_BYTES >= 1073741824
            AND CA_LIMITE_ALMACENAMIENTO_BYTES <= 53687091200
        ),
    CONSTRAINT FK_NASTM_USUARIOS_ROL FOREIGN KEY (ID_ROL) REFERENCES dbo.NASTM_ROLES (ID_ROL) ON DELETE SET NULL
);

CREATE INDEX IDX_NASTM_USUARIOS_ID_ROL ON dbo.NASTM_USUARIOS (ID_ROL);
CREATE INDEX IDX_NASTM_USUARIOS_ES_VIGENTE ON dbo.NASTM_USUARIOS (ES_VIGENTE);
CREATE UNIQUE INDEX UX_NASTM_USUARIOS_DNI ON dbo.NASTM_USUARIOS (NU_DNI) WHERE NU_DNI IS NOT NULL;
CREATE UNIQUE INDEX UX_NASTM_USUARIOS_NUMERO_DOCUMENTO ON dbo.NASTM_USUARIOS (NU_NUMERO_DOCUMENTO);
GO

-- ---------------------------------------------------------------------------
-- NASTD_USUARIO_CATEGORIAS — detalle (usuario ↔ categoría, N:M)
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTD_USUARIO_CATEGORIAS (
    ID_USUARIO_CATEGORIA UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTD_UC PRIMARY KEY DEFAULT NEWID(),
    ID_USUARIO UNIQUEIDENTIFIER NOT NULL,
    ID_CATEGORIA UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT IDU_NASTD_UC_USUARIO_CAT UNIQUE (ID_USUARIO, ID_CATEGORIA),
    CONSTRAINT FK_NASTD_UC_USUARIO FOREIGN KEY (ID_USUARIO) REFERENCES dbo.NASTM_USUARIOS (ID_USUARIO) ON DELETE CASCADE,
    CONSTRAINT FK_NASTD_UC_CATEGORIA FOREIGN KEY (ID_CATEGORIA) REFERENCES dbo.NASTM_CATEGORIAS (ID_CATEGORIA) ON DELETE CASCADE
);

CREATE INDEX IDX_NASTD_UC_USUARIO ON dbo.NASTD_USUARIO_CATEGORIAS (ID_USUARIO);
CREATE INDEX IDX_NASTD_UC_CATEGORIA ON dbo.NASTD_USUARIO_CATEGORIAS (ID_CATEGORIA);
GO

-- ---------------------------------------------------------------------------
-- NASTM_CARPETAS — maestra
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTM_CARPETAS (
    ID_CARPETA UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTM_CARPETAS PRIMARY KEY DEFAULT NEWID(),
    NO_CARPETA VARCHAR(255) NOT NULL,
    ID_CARPETA_PADRE UNIQUEIDENTIFIER NULL,
    ID_USUARIO UNIQUEIDENTIFIER NOT NULL,
    IN_ES_COMPARTIDA BIT NOT NULL CONSTRAINT DF_NASTM_CARP_IN_COMPARTIDA DEFAULT 0,
    IN_ES_PUBLICA BIT NOT NULL CONSTRAINT DF_NASTM_CARP_IN_PUBLICA DEFAULT 0,
    FE_CREACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTM_CARP_FE_CREACION DEFAULT SYSUTCDATETIME(),
    FE_ACTUALIZACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTM_CARP_FE_ACTUALIZACION DEFAULT SYSUTCDATETIME(),
    FE_BAJA DATETIME2(7) NULL,
    CONSTRAINT FK_NASTM_CARP_PADRE FOREIGN KEY (ID_CARPETA_PADRE) REFERENCES dbo.NASTM_CARPETAS (ID_CARPETA) ON DELETE NO ACTION,
    CONSTRAINT FK_NASTM_CARP_USUARIO FOREIGN KEY (ID_USUARIO) REFERENCES dbo.NASTM_USUARIOS (ID_USUARIO) ON DELETE CASCADE,
    CONSTRAINT IDU_NASTM_CARP_NOMBRE_CTX UNIQUE (NO_CARPETA, ID_CARPETA_PADRE, ID_USUARIO, FE_BAJA)
);

CREATE INDEX IDX_NASTM_CARP_ID_USUARIO ON dbo.NASTM_CARPETAS (ID_USUARIO);
CREATE INDEX IDX_NASTM_CARP_ID_PADRE ON dbo.NASTM_CARPETAS (ID_CARPETA_PADRE);
CREATE INDEX IDX_NASTM_CARP_FE_BAJA ON dbo.NASTM_CARPETAS (FE_BAJA);
CREATE INDEX IDX_NASTM_CARP_IN_COMPARTIDA ON dbo.NASTM_CARPETAS (IN_ES_COMPARTIDA);
GO

-- ---------------------------------------------------------------------------
-- NASTD_CARPETAS_COMPARTIDAS — detalle
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTD_CARPETAS_COMPARTIDAS (
    ID_CARPETA_COMPARTIDA UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTD_CC PRIMARY KEY DEFAULT NEWID(),
    ID_CARPETA UNIQUEIDENTIFIER NOT NULL,
    ID_USUARIO_COMPARTIDO UNIQUEIDENTIFIER NOT NULL,
    TI_PERMISO VARCHAR(20) NOT NULL CONSTRAINT DF_NASTD_CC_TI_PERMISO DEFAULT 'READ',
    FE_CREACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTD_CC_FE_CREACION DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_NASTD_CC_PERMISO CHECK (TI_PERMISO IN ('READ', 'WRITE', 'ADMIN')),
    CONSTRAINT FK_NASTD_CC_CARPETA FOREIGN KEY (ID_CARPETA) REFERENCES dbo.NASTM_CARPETAS (ID_CARPETA) ON DELETE CASCADE,
    CONSTRAINT FK_NASTD_CC_USUARIO FOREIGN KEY (ID_USUARIO_COMPARTIDO) REFERENCES dbo.NASTM_USUARIOS (ID_USUARIO) ON DELETE NO ACTION,
    CONSTRAINT IDU_NASTD_CC_CARPETA_USUARIO UNIQUE (ID_CARPETA, ID_USUARIO_COMPARTIDO)
);

CREATE INDEX IDX_NASTD_CC_CARPETA ON dbo.NASTD_CARPETAS_COMPARTIDAS (ID_CARPETA);
CREATE INDEX IDX_NASTD_CC_USUARIO ON dbo.NASTD_CARPETAS_COMPARTIDAS (ID_USUARIO_COMPARTIDO);
GO

-- ---------------------------------------------------------------------------
-- Política de subida por árbol de carpetas del propietario (equiv. script 5)
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTD_POLITICA_SUBIDA_EXENTOS (
    ID_POLITICA UNIQUEIDENTIFIER NOT NULL,
    ID_USUARIO   UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_POLITICA_EXENTO PRIMARY KEY (ID_POLITICA, ID_USUARIO)
);

CREATE TABLE dbo.NASTM_CARPETA_POLITICA_SUBIDA (
    ID_POLITICA                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_POL_ID DEFAULT NEWSEQUENTIALID(),
    CONSTRAINT PK_NASTM_CARPETA_POLITICA_SUBIDA PRIMARY KEY (ID_POLITICA),
    ID_USUARIO_DUENO               UNIQUEIDENTIFIER NOT NULL,
    ID_CARPETA                     UNIQUEIDENTIFIER NULL,
    IN_PERMITE_FOTOS               BIT NOT NULL CONSTRAINT DF_POL_FOT DEFAULT 1,
    IN_PERMITE_VIDEOS              BIT NOT NULL CONSTRAINT DF_POL_VID DEFAULT 1,
    IN_PERMITE_DOCUMENTOS          BIT NOT NULL CONSTRAINT DF_POL_DOC DEFAULT 1,
    IN_PERMITE_OTROS               BIT NOT NULL CONSTRAINT DF_POL_OTR DEFAULT 1,
    IN_PERMITE_MULTIPLES           BIT NOT NULL CONSTRAINT DF_POL_MUL DEFAULT 1,
    CA_MAX_PESO_MB                 INT NULL,
    DE_EXTENSIONES_PERMITIDAS      NVARCHAR(500) NULL,
    FE_CREACION                    DATETIME2 NOT NULL CONSTRAINT DF_POL_FC DEFAULT SYSUTCDATETIME(),
    FE_ACTUALIZACION               DATETIME2 NOT NULL CONSTRAINT DF_POL_FA DEFAULT SYSUTCDATETIME()
);

ALTER TABLE dbo.NASTD_POLITICA_SUBIDA_EXENTOS ADD CONSTRAINT FK_POL_EXENTOS_POLITICA
    FOREIGN KEY (ID_POLITICA) REFERENCES dbo.NASTM_CARPETA_POLITICA_SUBIDA (ID_POLITICA) ON DELETE CASCADE;

CREATE UNIQUE INDEX UX_POLITICA_SCOPE_CARPETA
    ON dbo.NASTM_CARPETA_POLITICA_SUBIDA (ID_USUARIO_DUENO, ID_CARPETA)
    WHERE ID_CARPETA IS NOT NULL;

CREATE UNIQUE INDEX UX_POLITICA_SCOPE_DEFECTO
    ON dbo.NASTM_CARPETA_POLITICA_SUBIDA (ID_USUARIO_DUENO)
    WHERE ID_CARPETA IS NULL;
GO

-- ---------------------------------------------------------------------------
-- NASTM_ARCHIVOS — maestra
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTM_ARCHIVOS (
    ID_ARCHIVO UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTM_ARCHIVOS PRIMARY KEY DEFAULT NEWID(),
    ID_USUARIO UNIQUEIDENTIFIER NOT NULL,
    ID_CARPETA UNIQUEIDENTIFIER NULL,
    NO_ARCHIVO_ORIGINAL VARCHAR(500) NOT NULL,
    NO_ARCHIVO_FISICO VARCHAR(500) NOT NULL,
    DE_RUTA_FISICA VARCHAR(255) NOT NULL,
    TI_MIME VARCHAR(100) NOT NULL,
    CA_TAMANO_BYTES BIGINT NOT NULL,
    CO_HASH_SHA256 VARCHAR(64) NULL,
    IN_EN_TEMPORAL BIT NOT NULL CONSTRAINT DF_NASTM_ARCH_IN_TEMP DEFAULT 0,
    DE_RUTA_TEMPORAL VARCHAR(500) NULL,
    IN_ES_PUBLICO BIT NOT NULL CONSTRAINT DF_NASTM_ARCH_IN_PUBLICO DEFAULT 0,
    FE_CREACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTM_ARCH_FE_CREACION DEFAULT SYSUTCDATETIME(),
    FE_ACTUALIZACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTM_ARCH_FE_ACTUALIZACION DEFAULT SYSUTCDATETIME(),
    FE_ULTIMA_DESCARGA DATETIME2(7) NULL,
    FE_BAJA DATETIME2(7) NULL,
    DE_RUTAS_ESPEJO NVARCHAR(MAX) NULL,
    IN_ES_PERMANENTE BIT NOT NULL CONSTRAINT DF_NASTM_ARCH_IN_PERM DEFAULT 1,
    FE_INICIO_VIGENCIA DATETIME2(7) NULL,
    FE_FIN_VIGENCIA DATETIME2(7) NULL,
    CONSTRAINT FK_NASTM_ARCH_USUARIO FOREIGN KEY (ID_USUARIO) REFERENCES dbo.NASTM_USUARIOS (ID_USUARIO) ON DELETE CASCADE,
    CONSTRAINT FK_NASTM_ARCH_CARPETA FOREIGN KEY (ID_CARPETA) REFERENCES dbo.NASTM_CARPETAS (ID_CARPETA) ON DELETE NO ACTION
);

CREATE INDEX IDX_NASTM_ARCH_ID_USUARIO ON dbo.NASTM_ARCHIVOS (ID_USUARIO);
CREATE INDEX IDX_NASTM_ARCH_ID_CARPETA ON dbo.NASTM_ARCHIVOS (ID_CARPETA);
CREATE INDEX IDX_NASTM_ARCH_DE_RUTA ON dbo.NASTM_ARCHIVOS (DE_RUTA_FISICA);
CREATE INDEX IDX_NASTM_ARCH_IN_TEMP ON dbo.NASTM_ARCHIVOS (IN_EN_TEMPORAL);
CREATE INDEX IDX_NASTM_ARCH_FE_BAJA ON dbo.NASTM_ARCHIVOS (FE_BAJA);
CREATE INDEX IDX_NASTM_ARCH_CO_HASH ON dbo.NASTM_ARCHIVOS (CO_HASH_SHA256);
CREATE INDEX IDX_NASTM_ARCH_FE_CREACION ON dbo.NASTM_ARCHIVOS (FE_CREACION);
CREATE INDEX IDX_NASTM_ARCH_IN_PUBLICO ON dbo.NASTM_ARCHIVOS (IN_ES_PUBLICO);
GO

-- ---------------------------------------------------------------------------
-- NASTM_ENLACES — maestra
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTM_ENLACES (
    ID_ENLACE UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTM_ENLACES PRIMARY KEY DEFAULT NEWID(),
    ID_ARCHIVO UNIQUEIDENTIFIER NOT NULL,
    CO_TOKEN VARCHAR(64) NOT NULL,
    IN_ES_TEMPORAL BIT NOT NULL CONSTRAINT DF_NASTM_ENL_IN_TEMP DEFAULT 0,
    FE_EXPIRACION DATETIME2(7) NULL,
    CA_MAX_VISITAS INT NULL,
    CA_VISITAS INT NOT NULL CONSTRAINT DF_NASTM_ENL_VISITAS DEFAULT 0,
    FE_ULTIMA_VISITA DATETIME2(7) NULL,
    ES_VIGENTE BIT NOT NULL CONSTRAINT DF_NASTM_ENL_ES_VIGENTE DEFAULT 1,
    FE_CREACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTM_ENL_FE_CREACION DEFAULT SYSUTCDATETIME(),
    ID_USUARIO_CREADOR UNIQUEIDENTIFIER NULL,
    CONSTRAINT IDU_NASTM_ENLACES_TOKEN UNIQUE (CO_TOKEN),
    CONSTRAINT FK_NASTM_ENL_ARCHIVO FOREIGN KEY (ID_ARCHIVO) REFERENCES dbo.NASTM_ARCHIVOS (ID_ARCHIVO) ON DELETE CASCADE,
    CONSTRAINT FK_NASTM_ENL_CREADOR FOREIGN KEY (ID_USUARIO_CREADOR) REFERENCES dbo.NASTM_USUARIOS (ID_USUARIO)
);

CREATE INDEX IDX_NASTM_ENL_CO_TOKEN ON dbo.NASTM_ENLACES (CO_TOKEN);
CREATE INDEX IDX_NASTM_ENL_ID_ARCHIVO ON dbo.NASTM_ENLACES (ID_ARCHIVO);
CREATE INDEX IDX_NASTM_ENL_ES_VIGENTE ON dbo.NASTM_ENLACES (ES_VIGENTE);
CREATE INDEX IDX_NASTM_ENL_IN_TEMP ON dbo.NASTM_ENLACES (IN_ES_TEMPORAL);
CREATE INDEX IDX_NASTM_ENL_FE_EXPIR ON dbo.NASTM_ENLACES (FE_EXPIRACION);
GO

-- ---------------------------------------------------------------------------
-- NASTV_AUDITORIA — movimiento
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTV_AUDITORIA (
    ID_AUDITORIA UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTV_AUD PRIMARY KEY DEFAULT NEWID(),
    ID_USUARIO UNIQUEIDENTIFIER NULL,
    TI_ACCION VARCHAR(50) NOT NULL,
    ID_ARCHIVO UNIQUEIDENTIFIER NULL,
    ID_CARPETA UNIQUEIDENTIFIER NULL,
    ID_ENLACE UNIQUEIDENTIFIER NULL,
    DE_DETALLE NVARCHAR(MAX) NULL,
    DI_IP VARCHAR(45) NULL,
    DE_USER_AGENT NVARCHAR(MAX) NULL,
    FE_REGISTRO DATETIME2(7) NOT NULL CONSTRAINT DF_NASTV_AUD_FE DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_NASTV_AUD_USUARIO FOREIGN KEY (ID_USUARIO) REFERENCES dbo.NASTM_USUARIOS (ID_USUARIO) ON DELETE NO ACTION,
    CONSTRAINT FK_NASTV_AUD_ARCHIVO FOREIGN KEY (ID_ARCHIVO) REFERENCES dbo.NASTM_ARCHIVOS (ID_ARCHIVO) ON DELETE NO ACTION,
    CONSTRAINT FK_NASTV_AUD_CARPETA FOREIGN KEY (ID_CARPETA) REFERENCES dbo.NASTM_CARPETAS (ID_CARPETA) ON DELETE NO ACTION,
    CONSTRAINT FK_NASTV_AUD_ENLACE FOREIGN KEY (ID_ENLACE) REFERENCES dbo.NASTM_ENLACES (ID_ENLACE) ON DELETE NO ACTION
);

CREATE INDEX IDX_NASTV_AUD_ID_USUARIO ON dbo.NASTV_AUDITORIA (ID_USUARIO);
CREATE INDEX IDX_NASTV_AUD_TI_ACCION ON dbo.NASTV_AUDITORIA (TI_ACCION);
CREATE INDEX IDX_NASTV_AUD_ID_ARCHIVO ON dbo.NASTV_AUDITORIA (ID_ARCHIVO);
CREATE INDEX IDX_NASTV_AUD_FE ON dbo.NASTV_AUDITORIA (FE_REGISTRO);
GO

-- ---------------------------------------------------------------------------
-- NASTM_PERMISOS — maestra
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTM_PERMISOS (
    ID_PERMISO UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTM_PERMISOS PRIMARY KEY DEFAULT NEWID(),
    CO_PERMISO VARCHAR(100) NOT NULL,
    DE_PERMISO NVARCHAR(MAX) NULL,
    FE_CREACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTM_PERM_FE_CREACION DEFAULT SYSUTCDATETIME(),
    CONSTRAINT IDU_NASTM_PERM_CODIGO UNIQUE (CO_PERMISO)
);
GO

-- ---------------------------------------------------------------------------
-- NASTD_ROLES_PERMISOS — detalle
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTD_ROLES_PERMISOS (
    ID_ROL_PERMISO UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTD_RP PRIMARY KEY DEFAULT NEWID(),
    ID_ROL UNIQUEIDENTIFIER NOT NULL,
    ID_PERMISO UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT IDU_NASTD_RP_ROL_PERM UNIQUE (ID_ROL, ID_PERMISO),
    CONSTRAINT FK_NASTD_RP_ROL FOREIGN KEY (ID_ROL) REFERENCES dbo.NASTM_ROLES (ID_ROL) ON DELETE CASCADE,
    CONSTRAINT FK_NASTD_RP_PERM FOREIGN KEY (ID_PERMISO) REFERENCES dbo.NASTM_PERMISOS (ID_PERMISO) ON DELETE CASCADE
);

CREATE INDEX IDX_NASTD_RP_ID_ROL ON dbo.NASTD_ROLES_PERMISOS (ID_ROL);
CREATE INDEX IDX_NASTD_RP_ID_PERMISO ON dbo.NASTD_ROLES_PERMISOS (ID_PERMISO);
GO

-- ---------------------------------------------------------------------------
-- NASTV_REFRESH_TOKENS — movimiento
-- ---------------------------------------------------------------------------

CREATE TABLE dbo.NASTV_REFRESH_TOKENS (
    ID_REFRESH_TOKEN UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NASTV_RT PRIMARY KEY DEFAULT NEWID(),
    ID_USUARIO UNIQUEIDENTIFIER NOT NULL,
    CO_TOKEN VARCHAR(500) NOT NULL,
    FE_EXPIRACION DATETIME2(7) NOT NULL,
    FE_CREACION DATETIME2(7) NOT NULL CONSTRAINT DF_NASTV_RT_FE_CREACION DEFAULT SYSUTCDATETIME(),
    FE_REVOCACION DATETIME2(7) NULL,
    CONSTRAINT IDU_NASTV_RT_TOKEN UNIQUE (CO_TOKEN),
    CONSTRAINT FK_NASTV_RT_USUARIO FOREIGN KEY (ID_USUARIO) REFERENCES dbo.NASTM_USUARIOS (ID_USUARIO) ON DELETE CASCADE
);

CREATE INDEX IDX_NASTV_RT_ID_USUARIO ON dbo.NASTV_REFRESH_TOKENS (ID_USUARIO);
CREATE INDEX IDX_NASTV_RT_CO_TOKEN ON dbo.NASTV_REFRESH_TOKENS (CO_TOKEN);
CREATE INDEX IDX_NASTV_RT_FE_EXP ON dbo.NASTV_REFRESH_TOKENS (FE_EXPIRACION);
GO

-- ---------------------------------------------------------------------------
-- Comentarios de columna (MS_Description) — catálogo en SSMS / herramientas
-- ---------------------------------------------------------------------------

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador único del rol.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ROLES',
    @level2type = N'COLUMN', @level2name = N'ID_ROL';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Código corto del rol (único), p. ej. USER, ADMIN.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ROLES',
    @level2type = N'COLUMN', @level2name = N'NO_ROL';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Descripción legible del rol.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ROLES',
    @level2type = N'COLUMN', @level2name = N'DE_ROL';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'1 = rol definido por el sistema; no debe eliminarse de forma arbitraria.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ROLES',
    @level2type = N'COLUMN', @level2name = N'IN_ES_SISTEMA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Fecha y hora UTC de creación del registro.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ROLES',
    @level2type = N'COLUMN', @level2name = N'FE_CREACION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Última actualización UTC del registro.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ROLES',
    @level2type = N'COLUMN', @level2name = N'FE_ACTUALIZACION';

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador único de la categoría de negocio.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CATEGORIAS',
    @level2type = N'COLUMN', @level2name = N'ID_CATEGORIA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Código estable de la categoría (UAS, UOP, UTI, etc.).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CATEGORIAS',
    @level2type = N'COLUMN', @level2name = N'CO_CATEGORIA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Nombre o descripción extendida de la categoría.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CATEGORIAS',
    @level2type = N'COLUMN', @level2name = N'DE_CATEGORIA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Fecha y hora UTC de creación del registro.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CATEGORIAS',
    @level2type = N'COLUMN', @level2name = N'FE_CREACION';

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador único del usuario.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'ID_USUARIO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Nombre completo o mostrado del usuario.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'NO_COMPLETO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Dirección de correo única (login).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'DI_CORREO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Hash de contraseña (p. ej. BCrypt); nunca texto plano.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'CO_PASSWORD_HASH';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Rol asignado; NULL si aún no tiene rol.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'ID_ROL';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'1 = cuenta activa; 0 = deshabilitada.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'ES_VIGENTE';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Cuota total de almacenamiento en bytes (entre 1 GiB y 50 GiB por regla de negocio).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'CA_LIMITE_ALMACENAMIENTO_BYTES';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Tamaño máximo permitido por archivo individual en bytes.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'CA_MAX_ARCHIVO_BYTES';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Fecha y hora UTC de alta del usuario.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'FE_CREACION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Última modificación UTC de datos del usuario.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'FE_ACTUALIZACION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Último inicio de sesión exitoso (UTC); NULL si nunca ingresó.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'FE_ULTIMO_LOGIN';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'1 = usuario en modo Privado: sin visibilidad cruzada por categoría; solo enlaces públicos a archivos para terceros.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_USUARIOS',
    @level2type = N'COLUMN', @level2name = N'IN_ES_PRIVADO';

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador de la fila de relación usuario–categoría.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTD_USUARIO_CATEGORIAS',
    @level2type = N'COLUMN', @level2name = N'ID_USUARIO_CATEGORIA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Usuario asociado a la categoría.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTD_USUARIO_CATEGORIAS',
    @level2type = N'COLUMN', @level2name = N'ID_USUARIO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Categoría de negocio asignada al usuario.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTD_USUARIO_CATEGORIAS',
    @level2type = N'COLUMN', @level2name = N'ID_CATEGORIA';

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador único de la carpeta.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CARPETAS',
    @level2type = N'COLUMN', @level2name = N'ID_CARPETA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Nombre visible de la carpeta dentro del mismo padre y usuario.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CARPETAS',
    @level2type = N'COLUMN', @level2name = N'NO_CARPETA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Carpeta contenedora; NULL = raíz del usuario.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CARPETAS',
    @level2type = N'COLUMN', @level2name = N'ID_CARPETA_PADRE';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Propietario de la carpeta.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CARPETAS',
    @level2type = N'COLUMN', @level2name = N'ID_USUARIO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'1 = compartida con otros usuarios (detalle en NASTD_CARPETAS_COMPARTIDAS).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CARPETAS',
    @level2type = N'COLUMN', @level2name = N'IN_ES_COMPARTIDA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'1 = carpeta visible o accesible en contexto público según reglas de la app.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CARPETAS',
    @level2type = N'COLUMN', @level2name = N'IN_ES_PUBLICA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Fecha y hora UTC de creación.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CARPETAS',
    @level2type = N'COLUMN', @level2name = N'FE_CREACION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Última actualización UTC.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CARPETAS',
    @level2type = N'COLUMN', @level2name = N'FE_ACTUALIZACION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Soft delete: fecha de baja lógica; NULL = activa.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_CARPETAS',
    @level2type = N'COLUMN', @level2name = N'FE_BAJA';

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador del permiso de compartición.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTD_CARPETAS_COMPARTIDAS',
    @level2type = N'COLUMN', @level2name = N'ID_CARPETA_COMPARTIDA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Carpeta que se comparte.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTD_CARPETAS_COMPARTIDAS',
    @level2type = N'COLUMN', @level2name = N'ID_CARPETA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Usuario con quien se comparte (beneficiario).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTD_CARPETAS_COMPARTIDAS',
    @level2type = N'COLUMN', @level2name = N'ID_USUARIO_COMPARTIDO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Nivel de permiso: READ, WRITE o ADMIN.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTD_CARPETAS_COMPARTIDAS',
    @level2type = N'COLUMN', @level2name = N'TI_PERMISO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Fecha UTC en que se otorgó el acceso compartido.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTD_CARPETAS_COMPARTIDAS',
    @level2type = N'COLUMN', @level2name = N'FE_CREACION';

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador único del archivo.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'ID_ARCHIVO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Propietario del archivo.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'ID_USUARIO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Carpeta contenedora; NULL si está en raíz o fuera de jerarquía según modelo.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'ID_CARPETA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Nombre original entregado por el cliente al subir.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'NO_ARCHIVO_ORIGINAL';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Nombre del archivo en disco (únicos, puede incluir UUID).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'NO_ARCHIVO_FISICO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Ruta relativa o clave de almacenamiento en el volumen NAS.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'DE_RUTA_FISICA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Tipo MIME del contenido.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'TI_MIME';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Tamaño del archivo en bytes.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'CA_TAMANO_BYTES';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Hash SHA-256 del contenido para deduplicación o integridad.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'CO_HASH_SHA256';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'1 = archivo en zona temporal antes de confirmar.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'IN_EN_TEMPORAL';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Ruta alternativa mientras está en temporal.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'DE_RUTA_TEMPORAL';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'1 = marcado como accesible vía enlace público según reglas.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'IN_ES_PUBLICO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Fecha UTC de registro del archivo.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'FE_CREACION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Última actualización de metadatos UTC.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'FE_ACTUALIZACION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Última vez que se sirvió una descarga (UTC).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'FE_ULTIMA_DESCARGA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Soft delete: baja lógica; NULL = activo.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'FE_BAJA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'JSON array de rutas relativas adicionales (sin nombre de archivo) donde existe copia física NAS;',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'DE_RUTAS_ESPEJO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'1 = sin ventana (siempre disponible hasta baja manual); 0 = aplica FE_INICIO_VIGENCIA / FE_FIN_VIGENCIA (UTC).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'IN_ES_PERMANENTE';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Inicio inclusive de disponibilidad UTC (solo si IN_ES_PERMANENTE = 0); NULL con permanente o default al subir.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'FE_INICIO_VIGENCIA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Fin inclusive de disponibilidad UTC; tras este instante el job marca FE_BAJA (inactivo automático).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ARCHIVOS',
    @level2type = N'COLUMN', @level2name = N'FE_FIN_VIGENCIA';

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador único del enlace de descarga.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ENLACES',
    @level2type = N'COLUMN', @level2name = N'ID_ENLACE';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Archivo asociado al enlace.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ENLACES',
    @level2type = N'COLUMN', @level2name = N'ID_ARCHIVO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Token opaco único para URL pública o firmada.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ENLACES',
    @level2type = N'COLUMN', @level2name = N'CO_TOKEN';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'1 = enlace de un solo uso / temporal según política.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ENLACES',
    @level2type = N'COLUMN', @level2name = N'IN_ES_TEMPORAL';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Caducidad del enlace (UTC); NULL = sin expiración configurada.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ENLACES',
    @level2type = N'COLUMN', @level2name = N'FE_EXPIRACION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Máximo de accesos permitidos; NULL = ilimitado.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ENLACES',
    @level2type = N'COLUMN', @level2name = N'CA_MAX_VISITAS';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Contador de visitas o descargas realizadas.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ENLACES',
    @level2type = N'COLUMN', @level2name = N'CA_VISITAS';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Último acceso al enlace (UTC).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ENLACES',
    @level2type = N'COLUMN', @level2name = N'FE_ULTIMA_VISITA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'1 = enlace usable; 0 = revocado o agotado.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ENLACES',
    @level2type = N'COLUMN', @level2name = N'ES_VIGENTE';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Fecha UTC de creación del enlace.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ENLACES',
    @level2type = N'COLUMN', @level2name = N'FE_CREACION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Usuario que generó el enlace; NULL si es proceso sistema.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_ENLACES',
    @level2type = N'COLUMN', @level2name = N'ID_USUARIO_CREADOR';

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador único del evento de auditoría.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_AUDITORIA',
    @level2type = N'COLUMN', @level2name = N'ID_AUDITORIA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Usuario que originó la acción; NULL = anónimo o sistema.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_AUDITORIA',
    @level2type = N'COLUMN', @level2name = N'ID_USUARIO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Código de acción (p. ej. LOGIN, UPLOAD, DELETE).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_AUDITORIA',
    @level2type = N'COLUMN', @level2name = N'TI_ACCION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Archivo afectado, si aplica.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_AUDITORIA',
    @level2type = N'COLUMN', @level2name = N'ID_ARCHIVO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Carpeta afectada, si aplica.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_AUDITORIA',
    @level2type = N'COLUMN', @level2name = N'ID_CARPETA';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Enlace afectado, si aplica.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_AUDITORIA',
    @level2type = N'COLUMN', @level2name = N'ID_ENLACE';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'JSON o texto con detalle adicional del evento.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_AUDITORIA',
    @level2type = N'COLUMN', @level2name = N'DE_DETALLE';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Dirección IP de origen (IPv4/IPv6 acotada a 45 chars).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_AUDITORIA',
    @level2type = N'COLUMN', @level2name = N'DI_IP';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'User-Agent HTTP del cliente.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_AUDITORIA',
    @level2type = N'COLUMN', @level2name = N'DE_USER_AGENT';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Marca temporal UTC del evento.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_AUDITORIA',
    @level2type = N'COLUMN', @level2name = N'FE_REGISTRO';

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador único del permiso lógico.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_PERMISOS',
    @level2type = N'COLUMN', @level2name = N'ID_PERMISO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Código estable del permiso (p. ej. file.upload).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_PERMISOS',
    @level2type = N'COLUMN', @level2name = N'CO_PERMISO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Descripción legible del permiso.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_PERMISOS',
    @level2type = N'COLUMN', @level2name = N'DE_PERMISO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Fecha UTC de alta del permiso en catálogo.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTM_PERMISOS',
    @level2type = N'COLUMN', @level2name = N'FE_CREACION';

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador de la asignación rol–permiso.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTD_ROLES_PERMISOS',
    @level2type = N'COLUMN', @level2name = N'ID_ROL_PERMISO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Rol que recibe el permiso.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTD_ROLES_PERMISOS',
    @level2type = N'COLUMN', @level2name = N'ID_ROL';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Permiso concedido al rol.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTD_ROLES_PERMISOS',
    @level2type = N'COLUMN', @level2name = N'ID_PERMISO';

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador único del refresh token.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_REFRESH_TOKENS',
    @level2type = N'COLUMN', @level2name = N'ID_REFRESH_TOKEN';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Usuario titular del token de refresco.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_REFRESH_TOKENS',
    @level2type = N'COLUMN', @level2name = N'ID_USUARIO';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Valor del refresh token (hash o token opaco según implementación).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_REFRESH_TOKENS',
    @level2type = N'COLUMN', @level2name = N'CO_TOKEN';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Caducidad del token (UTC).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_REFRESH_TOKENS',
    @level2type = N'COLUMN', @level2name = N'FE_EXPIRACION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Fecha UTC de emisión.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_REFRESH_TOKENS',
    @level2type = N'COLUMN', @level2name = N'FE_CREACION';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Revocación: fecha UTC; NULL = aún válido si no expiró.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'NASTV_REFRESH_TOKENS',
    @level2type = N'COLUMN', @level2name = N'FE_REVOCACION';
GO

-- ---------------------------------------------------------------------------
-- NASFU_ — función (módulo NASPK alineado a rutinas de negocio en BD)
-- ---------------------------------------------------------------------------

CREATE FUNCTION dbo.NASFU_CALCULAR_ALMACENAMIENTO_USUARIO (@p_id_usuario UNIQUEIDENTIFIER)
RETURNS BIGINT
AS
BEGIN
    DECLARE @total BIGINT;

    SELECT @total = ISNULL(SUM(f.CA_TAMANO_BYTES), 0)
    FROM dbo.NASTM_ARCHIVOS AS f
    WHERE f.ID_USUARIO = @p_id_usuario
      AND f.FE_BAJA IS NULL;

    RETURN ISNULL(@total, 0);
END;
GO

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Usuario para el que se suman los bytes de archivos activos (sin baja).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'FUNCTION', @level1name = N'NASFU_CALCULAR_ALMACENAMIENTO_USUARIO',
    @level2type = N'PARAMETER', @level2name = N'@p_id_usuario';
GO

-- ---------------------------------------------------------------------------
-- Triggers legacy (si existían)
-- ---------------------------------------------------------------------------

IF EXISTS (
    SELECT 1 FROM sys.triggers
    WHERE name = N'trg_usuarios_updated_at' AND parent_id = OBJECT_ID(N'dbo.NASTM_USUARIOS', N'U')
) EXEC (N'DROP TRIGGER trg_usuarios_updated_at ON dbo.NASTM_USUARIOS');

IF EXISTS (
    SELECT 1 FROM sys.triggers
    WHERE name = N'trg_roles_updated_at' AND parent_id = OBJECT_ID(N'dbo.NASTM_ROLES', N'U')
) EXEC (N'DROP TRIGGER trg_roles_updated_at ON dbo.NASTM_ROLES');

IF EXISTS (
    SELECT 1 FROM sys.triggers
    WHERE name = N'trg_carpetas_updated_at' AND parent_id = OBJECT_ID(N'dbo.NASTM_CARPETAS', N'U')
) EXEC (N'DROP TRIGGER trg_carpetas_updated_at ON dbo.NASTM_CARPETAS');

IF EXISTS (
    SELECT 1 FROM sys.triggers
    WHERE name = N'trg_archivos_updated_at' AND parent_id = OBJECT_ID(N'dbo.NASTM_ARCHIVOS', N'U')
) EXEC (N'DROP TRIGGER trg_archivos_updated_at ON dbo.NASTM_ARCHIVOS');
GO

-- ---------------------------------------------------------------------------
-- NASVM_ — vista maestra
-- ---------------------------------------------------------------------------

CREATE VIEW dbo.NASVM_ESTADISTICAS_USUARIO
AS
SELECT
    u.ID_USUARIO AS usuario_id,
    u.NO_COMPLETO AS usuario_nombre,
    u.DI_CORREO AS email,
    r.NO_ROL AS rol,
    u.CA_LIMITE_ALMACENAMIENTO_BYTES AS limite_almacenamiento_bytes,
    uso.almacenamiento_usado_bytes,
    u.CA_LIMITE_ALMACENAMIENTO_BYTES - uso.almacenamiento_usado_bytes AS almacenamiento_disponible_bytes,
    COUNT(DISTINCT CASE WHEN f.FE_BAJA IS NULL THEN f.ID_ARCHIVO END) AS total_archivos,
    COUNT(DISTINCT CASE WHEN c.FE_BAJA IS NULL THEN c.ID_CARPETA END) AS total_carpetas,
    COUNT(DISTINCT CASE WHEN l.ES_VIGENTE = 1 THEN l.ID_ENLACE END) AS total_enlaces_activos
FROM dbo.NASTM_USUARIOS AS u
LEFT JOIN dbo.NASTM_ROLES AS r ON r.ID_ROL = u.ID_ROL
CROSS APPLY (
    SELECT dbo.NASFU_CALCULAR_ALMACENAMIENTO_USUARIO(u.ID_USUARIO) AS almacenamiento_usado_bytes
) AS uso
LEFT JOIN dbo.NASTM_ARCHIVOS AS f ON f.ID_USUARIO = u.ID_USUARIO
LEFT JOIN dbo.NASTM_CARPETAS AS c ON c.ID_USUARIO = u.ID_USUARIO
LEFT JOIN dbo.NASTM_ENLACES AS l ON l.ID_USUARIO_CREADOR = u.ID_USUARIO
GROUP BY
    u.ID_USUARIO,
    u.NO_COMPLETO,
    u.DI_CORREO,
    r.NO_ROL,
    u.CA_LIMITE_ALMACENAMIENTO_BYTES,
    uso.almacenamiento_usado_bytes;
GO

EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Identificador del usuario (alias en vista).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW', @level1name = N'NASVM_ESTADISTICAS_USUARIO',
    @level2type = N'COLUMN', @level2name = N'usuario_id';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Nombre completo del usuario.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW', @level1name = N'NASVM_ESTADISTICAS_USUARIO',
    @level2type = N'COLUMN', @level2name = N'usuario_nombre';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Correo del usuario.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW', @level1name = N'NASVM_ESTADISTICAS_USUARIO',
    @level2type = N'COLUMN', @level2name = N'email';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Nombre del rol asignado.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW', @level1name = N'NASVM_ESTADISTICAS_USUARIO',
    @level2type = N'COLUMN', @level2name = N'rol';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Cuota máxima de almacenamiento en bytes.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW', @level1name = N'NASVM_ESTADISTICAS_USUARIO',
    @level2type = N'COLUMN', @level2name = N'limite_almacenamiento_bytes';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Suma de tamaños de archivos activos del usuario (función NASFU).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW', @level1name = N'NASVM_ESTADISTICAS_USUARIO',
    @level2type = N'COLUMN', @level2name = N'almacenamiento_usado_bytes';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Diferencia entre cuota y uso (bytes).',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW', @level1name = N'NASVM_ESTADISTICAS_USUARIO',
    @level2type = N'COLUMN', @level2name = N'almacenamiento_disponible_bytes';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Cantidad de archivos no dados de baja.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW', @level1name = N'NASVM_ESTADISTICAS_USUARIO',
    @level2type = N'COLUMN', @level2name = N'total_archivos';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Cantidad de carpetas no dadas de baja.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW', @level1name = N'NASVM_ESTADISTICAS_USUARIO',
    @level2type = N'COLUMN', @level2name = N'total_carpetas';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Enlaces vigentes creados por el usuario.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW', @level1name = N'NASVM_ESTADISTICAS_USUARIO',
    @level2type = N'COLUMN', @level2name = N'total_enlaces_activos';
GO

-- ---------------------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------------------

INSERT INTO dbo.NASTM_ROLES (NO_ROL, DE_ROL, IN_ES_SISTEMA)
SELECT v.NO_ROL, v.DE_ROL, v.IN_ES_SISTEMA
FROM (
    VALUES
        (N'USER',        N'Usuario estándar',       1),
        (N'POWER_USER',  N'Usuario avanzado',        1),
        (N'MODERATOR',   N'Moderador del sistema',   1),
        (N'ADMIN',       N'Administrador del sistema', 1),
        (N'API_CLIENT',  N'Cliente de API',         1),
        (N'SYSTEM',      N'Sistema interno',        1)
) AS v (NO_ROL, DE_ROL, IN_ES_SISTEMA)
WHERE NOT EXISTS (SELECT 1 FROM dbo.NASTM_ROLES AS r WHERE r.NO_ROL = v.NO_ROL);
GO

INSERT INTO dbo.NASTM_CATEGORIAS (CO_CATEGORIA, DE_CATEGORIA)
SELECT v.CO, v.DE
FROM (
    VALUES
        (N'UAS', N'Unidad de Acompañamiento y Servicios Complementarios'),
        (N'UOP', N'Unidad de Operaciones'),
        (N'UTI', N'Unidad de Tecnologías')
) AS v (CO, DE)
WHERE NOT EXISTS (SELECT 1 FROM dbo.NASTM_CATEGORIAS AS c WHERE c.CO_CATEGORIA = v.CO);
GO

CREATE TABLE #permisos_seed (
    CO_PERMISO VARCHAR(100) NOT NULL,
    DE_PERMISO NVARCHAR(MAX) NOT NULL
);

INSERT INTO #permisos_seed (CO_PERMISO, DE_PERMISO)
VALUES
    (N'file.upload',           N'Subir archivos'),
    (N'file.view',             N'Ver sus propios archivos'),
    (N'file.view_all',         N'Ver archivos de todos (solo admin)'),
    (N'file.download',         N'Descargar archivos'),
    (N'file.delete',           N'Eliminar sus propios archivos'),
    (N'file.delete_any',       N'Eliminar archivos de cualquiera (admin)'),
    (N'file.rename',           N'Renombrar archivos'),
    (N'file.move',             N'Mover archivos entre carpetas'),
    (N'file.generate_link',    N'Crear enlaces permanentes/temporales'),
    (N'file.set_expiration',   N'Cambiar expiración de enlaces'),
    (N'folder.create',         N'Crear carpetas'),
    (N'folder.rename',         N'Renombrar carpetas'),
    (N'folder.delete',         N'Inactivar carpetas propias (vacías)'),
    (N'folder.delete_any',     N'Inactivar carpetas de cualquiera, incluso con contenido (admin)'),
    (N'folder.move',           N'Mover carpetas'),
    (N'folder.share',          N'Compartir carpetas'),
    (N'link.create',           N'Crear enlace público / temporal'),
    (N'link.disable',          N'Revocar enlaces'),
    (N'link.view_stats',       N'Ver estadísticas de uso'),
    (N'admin.manage_users',    N'Gestionar usuarios'),
    (N'admin.manage_roles',    N'Cambiar roles'),
    (N'admin.view_dashboard',  N'Ver dashboard del sistema'),
    (N'admin.view_all_files',  N'Ver todos los archivos del sistema'),
    (N'admin.backup',          N'Generar respaldos'),
    (N'admin.view_file_audit', N'Consultar registros de auditoría de archivos (subidas y eliminaciones)'),
    (N'admin.settings',        N'Configuración general'),
    (N'mod.review_reports',    N'Revisar archivos reportados'),
    (N'mod.hide_file',         N'Ocultar un archivo público'),
    (N'mod.delete_file',       N'Eliminar archivo ofensivo'),
    (N'mod.ban_user',          N'Suspender usuario infractor'),
    (N'system.tasks',          N'Ejecutar tareas del sistema');

UPDATE p
SET p.DE_PERMISO = s.DE_PERMISO
FROM dbo.NASTM_PERMISOS AS p
INNER JOIN #permisos_seed AS s ON p.CO_PERMISO = s.CO_PERMISO;

INSERT INTO dbo.NASTM_PERMISOS (CO_PERMISO, DE_PERMISO)
SELECT s.CO_PERMISO, s.DE_PERMISO
FROM #permisos_seed AS s
WHERE NOT EXISTS (SELECT 1 FROM dbo.NASTM_PERMISOS AS p WHERE p.CO_PERMISO = s.CO_PERMISO);

DROP TABLE #permisos_seed;
GO

INSERT INTO dbo.NASTD_ROLES_PERMISOS (ID_ROL, ID_PERMISO)
SELECT r.ID_ROL, p.ID_PERMISO
FROM dbo.NASTM_ROLES AS r
CROSS JOIN dbo.NASTM_PERMISOS AS p
WHERE r.NO_ROL = N'USER'
  AND p.CO_PERMISO IN (
      N'file.upload', N'file.view', N'file.download', N'file.delete',
      N'file.rename', N'file.move', N'file.generate_link',
      N'folder.create', N'folder.rename', N'folder.delete', N'folder.move',
      N'link.create', N'link.disable'
  )
  AND NOT EXISTS (
        SELECT 1 FROM dbo.NASTD_ROLES_PERMISOS AS rp
        WHERE rp.ID_ROL = r.ID_ROL AND rp.ID_PERMISO = p.ID_PERMISO
  );
GO

INSERT INTO dbo.NASTD_ROLES_PERMISOS (ID_ROL, ID_PERMISO)
SELECT r.ID_ROL, p.ID_PERMISO
FROM dbo.NASTM_ROLES AS r
CROSS JOIN dbo.NASTM_PERMISOS AS p
WHERE r.NO_ROL = N'POWER_USER'
  AND p.CO_PERMISO IN (
      N'file.upload', N'file.view', N'file.download', N'file.delete',
      N'file.rename', N'file.move', N'file.generate_link',
      N'folder.create', N'folder.rename', N'folder.delete', N'folder.move', N'folder.share',
      N'link.create', N'link.disable'
  )
  AND NOT EXISTS (
        SELECT 1 FROM dbo.NASTD_ROLES_PERMISOS AS rp
        WHERE rp.ID_ROL = r.ID_ROL AND rp.ID_PERMISO = p.ID_PERMISO
  );
GO

INSERT INTO dbo.NASTD_ROLES_PERMISOS (ID_ROL, ID_PERMISO)
SELECT r.ID_ROL, p.ID_PERMISO
FROM dbo.NASTM_ROLES AS r
CROSS JOIN dbo.NASTM_PERMISOS AS p
WHERE r.NO_ROL = N'MODERATOR'
  AND p.CO_PERMISO IN (
      N'file.upload', N'file.view', N'file.download', N'file.delete',
      N'mod.review_reports', N'mod.hide_file', N'mod.delete_file', N'mod.ban_user'
  )
  AND NOT EXISTS (
        SELECT 1 FROM dbo.NASTD_ROLES_PERMISOS AS rp
        WHERE rp.ID_ROL = r.ID_ROL AND rp.ID_PERMISO = p.ID_PERMISO
  );
GO

INSERT INTO dbo.NASTD_ROLES_PERMISOS (ID_ROL, ID_PERMISO)
SELECT r.ID_ROL, p.ID_PERMISO
FROM dbo.NASTM_ROLES AS r
CROSS JOIN dbo.NASTM_PERMISOS AS p
WHERE r.NO_ROL = N'ADMIN'
  AND p.CO_PERMISO <> N'system.tasks'
  AND NOT EXISTS (
        SELECT 1 FROM dbo.NASTD_ROLES_PERMISOS AS rp
        WHERE rp.ID_ROL = r.ID_ROL AND rp.ID_PERMISO = p.ID_PERMISO
  );
GO

INSERT INTO dbo.NASTD_ROLES_PERMISOS (ID_ROL, ID_PERMISO)
SELECT r.ID_ROL, p.ID_PERMISO
FROM dbo.NASTM_ROLES AS r
CROSS JOIN dbo.NASTM_PERMISOS AS p
WHERE r.NO_ROL = N'SYSTEM'
  AND NOT EXISTS (
        SELECT 1 FROM dbo.NASTD_ROLES_PERMISOS AS rp
        WHERE rp.ID_ROL = r.ID_ROL AND rp.ID_PERMISO = p.ID_PERMISO
  );
GO

INSERT INTO dbo.NASTM_USUARIOS (NO_COMPLETO, DI_CORREO, CO_PASSWORD_HASH, ID_ROL, NU_DNI, NU_NUMERO_DOCUMENTO)
SELECT N'Administrador', N'admin@example.com', N'$2b$10$4PrkJ6wXGIRY8eXGO63Rm.JFlHtaGBUu87RQoDqO5T3.rc4vwfVUe', r.ID_ROL, N'00000000', N'00000000'
FROM dbo.NASTM_ROLES AS r
WHERE r.NO_ROL = N'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM dbo.NASTM_USUARIOS AS u WHERE u.DI_CORREO = N'admin@example.com');
GO

INSERT INTO dbo.NASTD_USUARIO_CATEGORIAS (ID_USUARIO, ID_CATEGORIA)
SELECT u.ID_USUARIO, c.ID_CATEGORIA
FROM dbo.NASTM_USUARIOS AS u
CROSS JOIN dbo.NASTM_CATEGORIAS AS c
WHERE u.DI_CORREO = N'admin@example.com'
  AND NOT EXISTS (
        SELECT 1
        FROM dbo.NASTD_USUARIO_CATEGORIAS AS x
        WHERE x.ID_USUARIO = u.ID_USUARIO AND x.ID_CATEGORIA = c.ID_CATEGORIA
    );
GO

-- ---------------------------------------------------------------------------
-- Seed: Ronnier Melendez Garate (SuperAdmin ConectaJuntos → rol ADMIN en NAS)
-- Contraseña offline: Maestro2025  →  bcrypt hash generado con 10 rounds
-- ---------------------------------------------------------------------------

INSERT INTO dbo.NASTM_USUARIOS (
    NO_COMPLETO,
    DI_CORREO,
    CO_PASSWORD_HASH,
    ID_ROL,
    NU_DNI,
    NU_NUMERO_DOCUMENTO,
    NO_NOMBRE,
    AP_PATERNO,
    AP_MATERNO,
    NO_USUARIO,
    NU_TELEFONO,
    IN_ES_PRIVADO
)
SELECT
    N'RONNIER MELENDEZ GARATE',
    N'ronniermelendezgarate@gmail.com',
    N'$2b$10$4PrkJ6wXGIRY8eXGO63Rm.JFlHtaGBUu87RQoDqO5T3.rc4vwfVUe',
    r.ID_ROL,
    N'70761499',
    N'70761499',
    N'RONNIER',
    N'MELENDEZ',
    N'GARATE',
    N'RONNIER MELENDEZ GARATE',
    N'987654321',
    0
FROM dbo.NASTM_ROLES AS r
WHERE r.NO_ROL = N'ADMIN'
  AND NOT EXISTS (
        SELECT 1 FROM dbo.NASTM_USUARIOS AS u
        WHERE u.DI_CORREO = N'ronniermelendezgarate@gmail.com'
           OR u.NU_DNI    = N'70761499'
  );
GO

-- Asignar TODAS las categorías a Ronnier (igual que admin)
INSERT INTO dbo.NASTD_USUARIO_CATEGORIAS (ID_USUARIO, ID_CATEGORIA)
SELECT u.ID_USUARIO, c.ID_CATEGORIA
FROM dbo.NASTM_USUARIOS AS u
CROSS JOIN dbo.NASTM_CATEGORIAS AS c
WHERE u.NU_DNI = N'70761499'
  AND NOT EXISTS (
        SELECT 1
        FROM dbo.NASTD_USUARIO_CATEGORIAS AS x
        WHERE x.ID_USUARIO = u.ID_USUARIO AND x.ID_CATEGORIA = c.ID_CATEGORIA
    );
GO
