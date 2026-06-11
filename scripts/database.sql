-- ============================================
-- SISTEMA DE ALMACENAMIENTO DE ARCHIVOS
-- Base de datos: PostgreSQL (Neon)
-- ============================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLA: usuarios
-- ============================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'USER' CHECK (rol IN ('USER', 'POWER_USER', 'MODERATOR', 'ADMIN', 'API_CLIENT', 'SYSTEM')),
    activo BOOLEAN DEFAULT TRUE,
    limite_almacenamiento_bytes BIGINT DEFAULT 1073741824, -- 1GB por defecto
    max_tamano_archivo_bytes BIGINT DEFAULT 104857600, -- 100MB por defecto
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);

-- ============================================
-- TABLA: carpetas
-- ============================================
CREATE TABLE carpetas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    id_padre UUID REFERENCES carpetas(id) ON DELETE CASCADE,
    id_usuario UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete
    CONSTRAINT unique_folder_name_per_parent UNIQUE (nombre, id_padre, id_usuario, deleted_at)
);

-- Índices para carpetas
CREATE INDEX idx_carpetas_id_usuario ON carpetas(id_usuario);
CREATE INDEX idx_carpetas_id_padre ON carpetas(id_padre);
CREATE INDEX idx_carpetas_deleted_at ON carpetas(deleted_at);

-- ============================================
-- TABLA: archivos
-- ============================================
CREATE TABLE archivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_usuario UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    id_carpeta UUID REFERENCES carpetas(id) ON DELETE SET NULL,
    nombre_original VARCHAR(500) NOT NULL,
    nombre_fisico VARCHAR(500) NOT NULL, -- Nombre cifrado
    ruta_fisica VARCHAR(255) NOT NULL, -- 2025/12/26
    mime_type VARCHAR(100) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    hash_sha256 VARCHAR(64), -- Para detectar duplicados
    en_temporal BOOLEAN DEFAULT FALSE, -- Si está en carpeta temporal del backend
    ruta_temporal VARCHAR(500), -- Ruta en temporal si aplica
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_download_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Índices para archivos
CREATE INDEX idx_archivos_id_usuario ON archivos(id_usuario);
CREATE INDEX idx_archivos_id_carpeta ON archivos(id_carpeta);
CREATE INDEX idx_archivos_ruta_fisica ON archivos(ruta_fisica);
CREATE INDEX idx_archivos_en_temporal ON archivos(en_temporal);
CREATE INDEX idx_archivos_deleted_at ON archivos(deleted_at);
CREATE INDEX idx_archivos_hash_sha256 ON archivos(hash_sha256);
CREATE INDEX idx_archivos_created_at ON archivos(created_at);

-- ============================================
-- TABLA: enlaces
-- ============================================
CREATE TABLE enlaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_archivo UUID NOT NULL REFERENCES archivos(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL, -- Token seguro para acceso público
    es_temporal BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_expiracion TIMESTAMP WITH TIME ZONE,
    max_visitas INTEGER,
    visitas_actuales INTEGER DEFAULT 0,
    fecha_ultima_visita TIMESTAMP WITH TIME ZONE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES usuarios(id)
);

-- Índices para enlaces
CREATE INDEX idx_enlaces_token ON enlaces(token);
CREATE INDEX idx_enlaces_id_archivo ON enlaces(id_archivo);
CREATE INDEX idx_enlaces_activo ON enlaces(activo);
CREATE INDEX idx_enlaces_es_temporal ON enlaces(es_temporal);
CREATE INDEX idx_enlaces_fecha_expiracion ON enlaces(fecha_expiracion);

-- ============================================
-- TABLA: auditoria
-- ============================================
CREATE TABLE auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_usuario UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo_accion VARCHAR(50) NOT NULL, -- UPLOAD, DOWNLOAD, DELETE, CREATE_LINK, etc.
    id_archivo UUID REFERENCES archivos(id) ON DELETE SET NULL,
    id_carpeta UUID REFERENCES carpetas(id) ON DELETE SET NULL,
    id_enlace UUID REFERENCES enlaces(id) ON DELETE SET NULL,
    detalle JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para auditoria
CREATE INDEX idx_auditoria_id_usuario ON auditoria(id_usuario);
CREATE INDEX idx_auditoria_tipo_accion ON auditoria(tipo_accion);
CREATE INDEX idx_auditoria_id_archivo ON auditoria(id_archivo);
CREATE INDEX idx_auditoria_fecha ON auditoria(fecha);

-- ============================================
-- TABLA: permisos (sistema de permisos granular)
-- ============================================
CREATE TABLE permisos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL, -- file.upload, file.delete, etc.
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: roles_permisos (relación muchos a muchos)
-- ============================================
CREATE TABLE roles_permisos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rol VARCHAR(50) NOT NULL,
    id_permiso UUID REFERENCES permisos(id) ON DELETE CASCADE,
    UNIQUE(rol, id_permiso)
);

-- ============================================
-- TABLA: refresh_tokens (para JWT)
-- ============================================
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_usuario UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_refresh_tokens_id_usuario ON refresh_tokens(id_usuario);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- ============================================
-- FUNCIONES Y TRIGGERS
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carpetas_updated_at BEFORE UPDATE ON carpetas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_archivos_updated_at BEFORE UPDATE ON archivos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para calcular almacenamiento usado por usuario
CREATE OR REPLACE FUNCTION calcular_almacenamiento_usuario(p_id_usuario UUID)
RETURNS BIGINT AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(tamano_bytes) 
         FROM archivos 
         WHERE id_usuario = p_id_usuario 
         AND deleted_at IS NULL),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Vista para estadísticas de archivos por usuario
CREATE OR REPLACE VIEW vista_estadisticas_usuario AS
SELECT 
    u.id as usuario_id,
    u.nombre as usuario_nombre,
    u.email,
    u.rol,
    u.limite_almacenamiento_bytes,
    calcular_almacenamiento_usuario(u.id) as almacenamiento_usado_bytes,
    (u.limite_almacenamiento_bytes - calcular_almacenamiento_usuario(u.id)) as almacenamiento_disponible_bytes,
    COUNT(DISTINCT f.id) FILTER (WHERE f.deleted_at IS NULL) as total_archivos,
    COUNT(DISTINCT c.id) FILTER (WHERE c.deleted_at IS NULL) as total_carpetas,
    COUNT(DISTINCT l.id) FILTER (WHERE l.activo = TRUE) as total_enlaces_activos
FROM usuarios u
LEFT JOIN archivos f ON f.id_usuario = u.id
LEFT JOIN carpetas c ON c.id_usuario = u.id
LEFT JOIN enlaces l ON l.created_by = u.id
GROUP BY u.id, u.nombre, u.email, u.rol, u.limite_almacenamiento_bytes;

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Insertar permisos básicos
INSERT INTO permisos (nombre, descripcion) VALUES
('file.upload', 'Subir archivos'),
('file.view', 'Ver sus propios archivos'),
('file.view_all', 'Ver archivos de todos (solo admin)'),
('file.download', 'Descargar archivos'),
('file.delete', 'Eliminar sus propios archivos'),
('file.delete_any', 'Eliminar archivos de cualquiera (admin)'),
('file.rename', 'Renombrar archivos'),
('file.move', 'Mover archivos entre carpetas'),
('file.generate_link', 'Crear enlaces permanentes/temporales'),
('file.set_expiration', 'Cambiar expiración de enlaces'),
('folder.create', 'Crear carpetas'),
('folder.rename', 'Renombrar carpetas'),
('folder.delete', 'Eliminar carpetas'),
('folder.move', 'Mover carpetas'),
('folder.share', 'Compartir carpetas'),
('link.create', 'Crear enlace público / temporal'),
('link.disable', 'Revocar enlaces'),
('link.view_stats', 'Ver estadísticas de uso'),
('admin.manage_users', 'Gestionar usuarios'),
('admin.manage_roles', 'Cambiar roles'),
('admin.view_dashboard', 'Ver dashboard del sistema'),
('admin.view_all_files', 'Ver todos los archivos del sistema'),
('admin.backup', 'Generar respaldos'),
('admin.settings', 'Configuración general'),
('mod.review_reports', 'Revisar archivos reportados'),
('mod.hide_file', 'Ocultar un archivo público'),
('mod.delete_file', 'Eliminar archivo ofensivo'),
('mod.ban_user', 'Suspender usuario infractor'),
('system.tasks', 'Ejecutar tareas del sistema');

-- Asignar permisos a roles
-- ROLE_USER
INSERT INTO roles_permisos (rol, id_permiso)
SELECT 'USER', id FROM permisos WHERE nombre IN (
    'file.upload', 'file.view', 'file.download', 'file.delete', 
    'file.rename', 'file.move', 'file.generate_link',
    'folder.create', 'folder.rename', 'folder.delete', 'folder.move',
    'link.create', 'link.disable'
);

-- ROLE_POWER_USER (igual que USER + folder.share)
INSERT INTO roles_permisos (rol, id_permiso)
SELECT 'POWER_USER', id FROM permisos WHERE nombre IN (
    'file.upload', 'file.view', 'file.download', 'file.delete', 
    'file.rename', 'file.move', 'file.generate_link',
    'folder.create', 'folder.rename', 'folder.delete', 'folder.move', 'folder.share',
    'link.create', 'link.disable'
);

-- ROLE_MODERATOR
INSERT INTO roles_permisos (rol, id_permiso)
SELECT 'MODERATOR', id FROM permisos WHERE nombre IN (
    'file.upload', 'file.view', 'file.download', 'file.delete',
    'mod.review_reports', 'mod.hide_file', 'mod.delete_file', 'mod.ban_user'
);

-- ROLE_ADMIN (todos los permisos excepto system.tasks)
INSERT INTO roles_permisos (rol, id_permiso)
SELECT 'ADMIN', id FROM permisos WHERE nombre != 'system.tasks';

-- ROLE_SYSTEM (todos los permisos)
INSERT INTO roles_permisos (rol, id_permiso)
SELECT 'SYSTEM', id FROM permisos;

-- Crear usuario administrador por defecto (password: admin123 - cambiar en producción)
-- Hash generado con bcrypt para "admin123"
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
('Administrador', 'admin@example.com', '$2b$10$4PrkJ6wXGIRY8eXGO63Rm.JFlHtaGBUu87RQoDqO5T3.rc4vwfVUe', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- CONSULTAS ÚTILES
-- ============================================

-- Verificar enlaces expirados
-- SELECT * FROM enlaces 
-- WHERE es_temporal = TRUE 
-- AND (fecha_expiracion < NOW() OR (max_visitas IS NOT NULL AND visitas_actuales >= max_visitas))
-- AND activo = TRUE;

-- Limpiar archivos en temporal (más de 1 minuto)
-- SELECT * FROM archivos 
-- WHERE en_temporal = TRUE 
-- AND created_at < NOW() - INTERVAL '1 minute';

-- Estadísticas del sistema
-- SELECT * FROM vista_estadisticas_usuario;

