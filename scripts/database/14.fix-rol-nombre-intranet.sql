-- Corrige DE_ROL: debe guardar el NOMBRE ConectaJuntos (vNombre), no la descripción larga.
UPDATE r
SET r.DE_ROL = m.NOMBRE,
    r.FE_ACTUALIZACION = SYSUTCDATETIME()
FROM dbo.NASTM_ROLES AS r
INNER JOIN (VALUES
  (1072, N'00 UTI - Admin NAS'),
  (1073, N'00 UCI - NAS'),
  (1074, N'00 UAS - NAS'),
  (1075, N'00 UOP - NAS'),
  (1076, N'00 UTI - NAS'),
  (1077, N'00 UA - NAS'),
  (1078, N'00 UI - NAS'),
  (1079, N'00 UPPM- NAS'),
  (1080, N'00 URH- NAS')
) AS m (COD, NOMBRE) ON m.COD = r.NU_ID_ROL_INTRANET;
GO
