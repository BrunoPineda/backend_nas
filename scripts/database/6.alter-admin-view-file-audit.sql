-- Permiso para consultar la auditoría de archivos (subidas y eliminaciones / "reemplazos" vía flujo técnico).
-- Ejecutar en bases ya desplegadas. Las instalaciones desde cero usan también 2.database-clean-sqlserver.sql.

IF NOT EXISTS (SELECT 1 FROM dbo.NASTM_PERMISOS WHERE CO_PERMISO = N'admin.view_file_audit')
BEGIN
    INSERT INTO dbo.NASTM_PERMISOS (CO_PERMISO, DE_PERMISO)
    VALUES (
        N'admin.view_file_audit',
        N'Consultar registros de auditoría de archivos (subidas y eliminaciones)'
    );
END
ELSE
BEGIN
    UPDATE dbo.NASTM_PERMISOS
    SET DE_PERMISO = N'Consultar registros de auditoría de archivos (subidas y eliminaciones)'
    WHERE CO_PERMISO = N'admin.view_file_audit';
END
GO

-- Asignar al rol ADMIN (idempotente)
INSERT INTO dbo.NASTD_ROLES_PERMISOS (ID_ROL, ID_PERMISO)
SELECT r.ID_ROL, p.ID_PERMISO
FROM dbo.NASTM_ROLES AS r
CROSS JOIN dbo.NASTM_PERMISOS AS p
WHERE r.NO_ROL = N'ADMIN'
  AND p.CO_PERMISO = N'admin.view_file_audit'
  AND NOT EXISTS (
        SELECT 1
        FROM dbo.NASTD_ROLES_PERMISOS AS rp
        WHERE rp.ID_ROL = r.ID_ROL AND rp.ID_PERMISO = p.ID_PERMISO
    );
GO
