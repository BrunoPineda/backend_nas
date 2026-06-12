import { query } from '../connection';
import { r } from '../column';

export interface PoliticaSubidaRow {
  id: string;
  idUsuarioDueno: string;
  idCarpeta: string | null;
  permiteFotos: boolean;
  permiteVideos: boolean;
  permiteDocumentos: boolean;
  permiteOtros: boolean;
  permiteMultiples: boolean;
  maxPesoMb: number | null;
  extensionesPermitidas: string | null;
}

function mapPolitica(row: Record<string, unknown>): PoliticaSubidaRow {
  return {
    id: String(r(row, 'ID_POLITICA', 'id_politica')),
    idUsuarioDueno: String(r(row, 'ID_USUARIO_DUENO', 'id_usuario_dueno')),
    idCarpeta: (r(row, 'ID_CARPETA', 'id_carpeta') as string) ?? null,
    permiteFotos: Boolean(r(row, 'IN_PERMITE_FOTOS', 'in_permite_fotos')),
    permiteVideos: Boolean(r(row, 'IN_PERMITE_VIDEOS', 'in_permite_videos')),
    permiteDocumentos: Boolean(r(row, 'IN_PERMITE_DOCUMENTOS', 'in_permite_documentos')),
    permiteOtros: Boolean(r(row, 'IN_PERMITE_OTROS', 'in_permite_otros')),
    permiteMultiples: Boolean(r(row, 'IN_PERMITE_MULTIPLES', 'in_permite_multiples')),
    maxPesoMb: r(row, 'CA_MAX_PESO_MB', 'ca_max_peso_mb') != null ? parseInt(String(r(row, 'CA_MAX_PESO_MB', 'ca_max_peso_mb')), 10) : null,
    extensionesPermitidas: (r(row, 'DE_EXTENSIONES_PERMITIDAS', 'de_extensiones_permitidas') as string) ?? null
  };
}

export class PoliticaSubidaRepository {
  async findExact(idUsuarioDueño: string, idCarpeta: string | null): Promise<PoliticaSubidaRow | null> {
    const sql =
      idCarpeta === null
        ? `SELECT * FROM dbo.NASTM_CARPETA_POLITICA_SUBIDA
           WHERE ID_USUARIO_DUENO = $1 AND ID_CARPETA IS NULL`
        : `SELECT * FROM dbo.NASTM_CARPETA_POLITICA_SUBIDA
           WHERE ID_USUARIO_DUENO = $1 AND ID_CARPETA = $2`;
    const params = idCarpeta === null ? [idUsuarioDueño] : [idUsuarioDueño, idCarpeta];
    const result = await query(sql, params);
    if (result.rows.length === 0) return null;
    return mapPolitica(result.rows[0] as Record<string, unknown>);
  }

  /** Política más cercana: carpeta objetivo → padres … → política por defecto (ID_CARPETA NULL). Sin fila en ningún nivel => null (libre). */
  async resolveEffective(idUsuarioDueño: string, idCarpetaObjetivo: string | null): Promise<PoliticaSubidaRow | null> {
    let cur = idCarpetaObjetivo;
    while (cur) {
      const exact = await this.findExact(idUsuarioDueño, cur);
      if (exact) return exact;
      const pr = await query(
        `SELECT TOP 1 ID_CARPETA_PADRE AS p FROM dbo.NASTM_CARPETAS WHERE ID_CARPETA = $1 AND FE_BAJA IS NULL`,
        [cur]
      );
      if (pr.rows.length === 0) break;
      const p = pr.rows[0] as Record<string, unknown>;
      cur = (p.p as string) ?? null;
    }
    return this.findExact(idUsuarioDueño, null);
  }

  async upsertPolitica(data: Omit<PoliticaSubidaRow, 'id'> & { id?: string }): Promise<PoliticaSubidaRow> {
    const exists = await this.findExact(data.idUsuarioDueno, data.idCarpeta);
    if (exists) {
      await query(
        `UPDATE dbo.NASTM_CARPETA_POLITICA_SUBIDA SET
          IN_PERMITE_FOTOS = $2,
          IN_PERMITE_VIDEOS = $3,
          IN_PERMITE_DOCUMENTOS = $4,
          IN_PERMITE_OTROS = $5,
          IN_PERMITE_MULTIPLES = $6,
          CA_MAX_PESO_MB = $7,
          DE_EXTENSIONES_PERMITIDAS = $8,
          FE_ACTUALIZACION = SYSUTCDATETIME()
        WHERE ID_POLITICA = $1`,
        [
          exists.id,
          data.permiteFotos ? 1 : 0,
          data.permiteVideos ? 1 : 0,
          data.permiteDocumentos ? 1 : 0,
          data.permiteOtros ? 1 : 0,
          data.permiteMultiples ? 1 : 0,
          data.maxPesoMb,
          data.extensionesPermitidas
        ]
      );
      const refreshed = await this.findExact(data.idUsuarioDueno, data.idCarpeta);
      return refreshed!;
    }

    await query(
      `INSERT INTO dbo.NASTM_CARPETA_POLITICA_SUBIDA (
        ID_USUARIO_DUENO, ID_CARPETA,
        IN_PERMITE_FOTOS, IN_PERMITE_VIDEOS, IN_PERMITE_DOCUMENTOS, IN_PERMITE_OTROS,
        IN_PERMITE_MULTIPLES, CA_MAX_PESO_MB, DE_EXTENSIONES_PERMITIDAS
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        data.idUsuarioDueno,
        data.idCarpeta,
        data.permiteFotos ? 1 : 0,
        data.permiteVideos ? 1 : 0,
        data.permiteDocumentos ? 1 : 0,
        data.permiteOtros ? 1 : 0,
        data.permiteMultiples ? 1 : 0,
        data.maxPesoMb,
        data.extensionesPermitidas
      ]
    );
    const refreshedIns = await this.findExact(data.idUsuarioDueno, data.idCarpeta);
    return refreshedIns!;
  }

  async deletePolitica(idUsuarioDueño: string, idCarpeta: string | null): Promise<void> {
    const row = await this.findExact(idUsuarioDueño, idCarpeta);
    if (!row) return;
    await query(`DELETE FROM dbo.NASTM_CARPETA_POLITICA_SUBIDA WHERE ID_POLITICA = $1`, [row.id]);
  }

  async findExemptions(idPolitica: string): Promise<string[]> {
    const r1 = await query(
      `SELECT ID_USUARIO FROM dbo.NASTD_POLITICA_SUBIDA_EXENTOS WHERE ID_POLITICA = $1`,
      [idPolitica]
    );
    return r1.rows.map((row) => String((row as Record<string, unknown>).ID_USUARIO || r(row as Record<string, unknown>, 'ID_USUARIO', 'id_usuario')));
  }

  async replaceExemptions(idPolitica: string, userIds: string[]): Promise<void> {
    await query(`DELETE FROM dbo.NASTD_POLITICA_SUBIDA_EXENTOS WHERE ID_POLITICA = $1`, [idPolitica]);
    const unique = [...new Set(userIds.filter(Boolean))];
    for (const uid of unique) {
      await query(
        `INSERT INTO dbo.NASTD_POLITICA_SUBIDA_EXENTOS (ID_POLITICA, ID_USUARIO) VALUES ($1, $2)`,
        [idPolitica, uid]
      );
    }
  }
}
