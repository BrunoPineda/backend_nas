import { query } from '../connection';
import { r } from '../column';
import {
  AuditoriaArchivoListItem,
  IAuditoriaRepository,
  RegistrarAuditoriaParams,
} from '../../../../domain/repositories/IAuditoriaRepository';
import { AUDIT_ACCIONES_CONTENIDO } from '../../../../application/constants/fileAudit';

const ACCIONES_CONTENIDO = [...AUDIT_ACCIONES_CONTENIDO];
const ACCIONES_CONTENIDO_SQL = ACCIONES_CONTENIDO.map((a) => `'${a}'`).join(', ');

export class AuditoriaRepository implements IAuditoriaRepository {
  async registrar(p: RegistrarAuditoriaParams): Promise<void> {
    await query(
      `INSERT INTO dbo.NASTV_AUDITORIA (
        ID_USUARIO, TI_ACCION, ID_ARCHIVO, ID_CARPETA, ID_ENLACE, DE_DETALLE, DI_IP, DE_USER_AGENT
      ) VALUES ($1, $2, $3, $4, NULL, $5, $6, $7)`,
      [
        p.idUsuario,
        p.tipoAccion,
        p.idArchivo ?? null,
        p.idCarpeta ?? null,
        p.detalle ?? null,
        p.ip ?? null,
        p.userAgent ?? null,
      ]
    );
  }

  async listarEventosArchivo(params: {
    page: number;
    limit: number;
    tipoAccion?: string | null;
    buscar?: string | null;
  }): Promise<{ items: AuditoriaArchivoListItem[]; total: number }> {
    const page = Math.max(1, params.page);
    const limit = Math.min(100, Math.max(1, params.limit));
    const skip = (page - 1) * limit;

    const buscarTrim = params.buscar?.trim();

    let accionSql = '';
    const baseArgs: unknown[] = [];
    const filtroAccion = params.tipoAccion ?? '';
    if (filtroAccion && ACCIONES_CONTENIDO.includes(filtroAccion as (typeof ACCIONES_CONTENIDO)[number])) {
      accionSql = `AND a.TI_ACCION = $1`;
      baseArgs.push(filtroAccion);
    } else {
      accionSql = `AND a.TI_ACCION IN (${ACCIONES_CONTENIDO_SQL})`;
    }

    let buscarSql = '';
    let likeParam: unknown = null;
    if (buscarTrim) {
      const idx = baseArgs.length + 1;
      likeParam = `%${buscarTrim}%`;
      buscarSql = `AND (
          u.NO_COMPLETO LIKE $${idx}
          OR u.DI_CORREO LIKE $${idx}
          OR CAST(a.ID_AUDITORIA AS NVARCHAR(36)) LIKE $${idx}
          OR CAST(a.ID_ARCHIVO AS NVARCHAR(36)) LIKE $${idx}
          OR CAST(a.ID_CARPETA AS NVARCHAR(36)) LIKE $${idx}
          OR a.DE_DETALLE LIKE $${idx}
          OR a.DI_IP LIKE $${idx}
        )`;
    }

    const countArgs = likeParam !== null ? [...baseArgs, likeParam] : baseArgs;

    const countResult = await query(
      `
      SELECT COUNT(*) AS total
      FROM dbo.NASTV_AUDITORIA AS a
      LEFT JOIN dbo.NASTM_USUARIOS AS u ON u.ID_USUARIO = a.ID_USUARIO
      WHERE 1 = 1
      ${accionSql}
      ${buscarSql}
      `,
      countArgs
    );

    const total = parseInt(
      String(r(countResult.rows[0] as Record<string, unknown>, 'total')),
      10
    );

    const listArgs: unknown[] = [...countArgs, skip, limit];
    const offIdx = listArgs.length - 1;
    const fetchIdx = listArgs.length;

    const listResult = await query(
      `
      SELECT
        a.ID_AUDITORIA AS id_auditoria,
        a.ID_USUARIO AS id_usuario,
        u.NO_COMPLETO AS usuario_nombre,
        u.DI_CORREO AS usuario_email,
        a.TI_ACCION AS tipo_accion,
        a.ID_ARCHIVO AS id_archivo,
        a.ID_CARPETA AS id_carpeta,
        a.DE_DETALLE AS detalle,
        a.DI_IP AS ip,
        a.FE_REGISTRO AS fecha_registro
      FROM dbo.NASTV_AUDITORIA AS a
      LEFT JOIN dbo.NASTM_USUARIOS AS u ON u.ID_USUARIO = a.ID_USUARIO
      WHERE 1 = 1
      ${accionSql}
      ${buscarSql}
      ORDER BY a.FE_REGISTRO DESC
      OFFSET $${offIdx} ROWS FETCH NEXT $${fetchIdx} ROWS ONLY
      `,
      listArgs
    );

    const items: AuditoriaArchivoListItem[] = listResult.rows.map((raw) => {
      const row = raw as Record<string, unknown>;
      const idUsuarioVal = row['id_usuario'];
      return {
        idAuditoria: String(r(row, 'id_auditoria', 'ID_AUDITORIA')),
        idUsuario: idUsuarioVal != null ? String(idUsuarioVal) : null,
        usuarioNombre: row['usuario_nombre'] != null ? String(row['usuario_nombre']) : null,
        usuarioEmail: row['usuario_email'] != null ? String(row['usuario_email']) : null,
        tipoAccion: String(r(row, 'tipo_accion', 'TI_ACCION')),
        idArchivo: row['id_archivo'] != null ? String(row['id_archivo']) : null,
        idCarpeta: row['id_carpeta'] != null ? String(row['id_carpeta']) : null,
        detalle: row['detalle'] != null ? String(row['detalle']) : null,
        ip: row['ip'] != null ? String(row['ip']) : null,
        fechaRegistro: r(row, 'fecha_registro', 'FE_REGISTRO') as Date,
      };
    });

    return { items, total };
  }

  /** Listado hasta N filas (exportación Excel .xlsx); mismos filtros que la tabla. */
  async listarParaExportacion(params: {
    tipoAccion?: string | null;
    buscar?: string | null;
    maxFilas: number;
  }): Promise<AuditoriaArchivoListItem[]> {
    const maxFilas = Math.min(15_000, Math.max(1, params.maxFilas));
    const buscarTrim = params.buscar?.trim();

    let accionSql = '';
    const baseArgs: unknown[] = [];
    const filtroAccion = params.tipoAccion ?? '';
    if (filtroAccion && ACCIONES_CONTENIDO.includes(filtroAccion as (typeof ACCIONES_CONTENIDO)[number])) {
      accionSql = `AND a.TI_ACCION = $1`;
      baseArgs.push(filtroAccion);
    } else {
      accionSql = `AND a.TI_ACCION IN (${ACCIONES_CONTENIDO_SQL})`;
    }

    let buscarSql = '';
    let likeParam: unknown = null;
    if (buscarTrim) {
      const idx = baseArgs.length + 1;
      likeParam = `%${buscarTrim}%`;
      buscarSql = `AND (
          u.NO_COMPLETO LIKE $${idx}
          OR u.DI_CORREO LIKE $${idx}
          OR CAST(a.ID_AUDITORIA AS NVARCHAR(36)) LIKE $${idx}
          OR CAST(a.ID_ARCHIVO AS NVARCHAR(36)) LIKE $${idx}
          OR CAST(a.ID_CARPETA AS NVARCHAR(36)) LIKE $${idx}
          OR a.DE_DETALLE LIKE $${idx}
          OR a.DI_IP LIKE $${idx}
        )`;
    }

    const exportArgs = likeParam !== null ? [...baseArgs, likeParam, 0, maxFilas] : [...baseArgs, 0, maxFilas];

    const offIdx = exportArgs.length - 1;
    const fetchIdx = exportArgs.length;

    const listResult = await query(
      `
      SELECT
        a.ID_AUDITORIA AS id_auditoria,
        a.ID_USUARIO AS id_usuario,
        u.NO_COMPLETO AS usuario_nombre,
        u.DI_CORREO AS usuario_email,
        a.TI_ACCION AS tipo_accion,
        a.ID_ARCHIVO AS id_archivo,
        a.ID_CARPETA AS id_carpeta,
        a.DE_DETALLE AS detalle,
        a.DI_IP AS ip,
        a.FE_REGISTRO AS fecha_registro
      FROM dbo.NASTV_AUDITORIA AS a
      LEFT JOIN dbo.NASTM_USUARIOS AS u ON u.ID_USUARIO = a.ID_USUARIO
      WHERE 1 = 1
      ${accionSql}
      ${buscarSql}
      ORDER BY a.FE_REGISTRO DESC
      OFFSET $${offIdx} ROWS FETCH NEXT $${fetchIdx} ROWS ONLY
      `,
      exportArgs
    );

    return listResult.rows.map((raw) => {
      const row = raw as Record<string, unknown>;
      const idUsuarioVal = row['id_usuario'];
      return {
        idAuditoria: String(r(row, 'id_auditoria', 'ID_AUDITORIA')),
        idUsuario: idUsuarioVal != null ? String(idUsuarioVal) : null,
        usuarioNombre: row['usuario_nombre'] != null ? String(row['usuario_nombre']) : null,
        usuarioEmail: row['usuario_email'] != null ? String(row['usuario_email']) : null,
        tipoAccion: String(r(row, 'tipo_accion', 'TI_ACCION')),
        idArchivo: row['id_archivo'] != null ? String(row['id_archivo']) : null,
        idCarpeta: row['id_carpeta'] != null ? String(row['id_carpeta']) : null,
        detalle: row['detalle'] != null ? String(row['detalle']) : null,
        ip: row['ip'] != null ? String(row['ip']) : null,
        fechaRegistro: r(row, 'fecha_registro', 'FE_REGISTRO') as Date,
      };
    });
  }
}
