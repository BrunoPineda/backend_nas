-- Script para verificar que los roles y permisos se insertaron correctamente

-- Verificar roles
SELECT 'ROLES' as tipo, COUNT(*) as total FROM roles;
SELECT nombre, descripcion, es_sistema FROM roles ORDER BY nombre;

-- Verificar permisos
SELECT 'PERMISOS' as tipo, COUNT(*) as total FROM permisos;
SELECT nombre, descripcion FROM permisos ORDER BY nombre;

-- Verificar asignación de permisos a roles
SELECT 
    r.nombre as rol,
    COUNT(rp.id_permiso) as total_permisos
FROM roles r
LEFT JOIN roles_permisos rp ON rp.id_rol = r.id
GROUP BY r.id, r.nombre
ORDER BY r.nombre;

-- Ver detalle de permisos por rol
SELECT 
    r.nombre as rol,
    p.nombre as permiso,
    p.descripcion
FROM roles r
JOIN roles_permisos rp ON rp.id_rol = r.id
JOIN permisos p ON p.id = rp.id_permiso
ORDER BY r.nombre, p.nombre;

