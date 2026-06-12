-- Permiso folder.delete_any para inactivar carpetas ajenas o con contenido (admin).
-- Ejecutar sobre una BD ya desplegada.

IF NOT EXISTS (SELECT 1 FROM dbo.NASTM_PERMISOS WHERE CO_PERMISO = N'folder.delete_any')
BEGIN
  INSERT INTO dbo.NASTM_PERMISOS (CO_PERMISO, DE_PERMISO)
  VALUES (N'folder.delete_any', N'Inactivar carpetas de cualquiera, incluso con contenido (admin)');
END
ELSE
BEGIN
  UPDATE dbo.NASTM_PERMISOS
  SET DE_PERMISO = N'Inactivar carpetas de cualquiera, incluso con contenido (admin)'
  WHERE CO_PERMISO = N'folder.delete_any';
END
GO

UPDATE dbo.NASTM_PERMISOS
SET DE_PERMISO = N'Inactivar carpetas propias (vacías)'
WHERE CO_PERMISO = N'folder.delete';
GO

INSERT INTO dbo.NASTD_ROLES_PERMISOS (ID_ROL, ID_PERMISO)
SELECT r.ID_ROL, p.ID_PERMISO
FROM dbo.NASTM_ROLES AS r
CROSS JOIN dbo.NASTM_PERMISOS AS p
WHERE r.NO_ROL = N'ADMIN'
  AND p.CO_PERMISO = N'folder.delete_any'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.NASTD_ROLES_PERMISOS AS rp
    WHERE rp.ID_ROL = r.ID_ROL AND rp.ID_PERMISO = p.ID_PERMISO
  );
GO
