import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { ICategoriaRepository } from '../../../domain/repositories/ICategoriaRepository';
import { IStorageService } from '../../../infrastructure/storage/IStorageService';
import { Archivo } from '../../../domain/entities/Archivo';
import { sanitizarCodigoParaCarpetaNas } from '../../services/NasCategoryFolderService';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import path from 'path';
import { FileValidator } from '../../../infrastructure/file-processing/FileValidator';
import { ValidationError } from '../../../shared/errors/AppError';
import { useTempStorageStaging } from '../../../shared/config/storageEnv';
import type { UploadVigenciaParsed } from '../../services/UploadVigenciaParser';

export interface UploadExecuteOptions {
  /** AUTO | * | ALL | codigo CSV (UOP,UTI…). Omitido ⇒ AUTO */
  areaDestino?: string | null;
  jwtRol?: string | null;
  vigencia?: UploadVigenciaParsed;
}

type NasLookup = {
  todosSegmentosSorted: string[];
  resolverTokenUpper: (tokenUpper: string) => string | undefined;
};

export class UploadFileUseCase {
  private fileValidator: FileValidator;

  constructor(
    private archivoRepository: IArchivoRepository,
    private tempStorageService: IStorageService,
    private permanentStorageService: IStorageService,
    maxFileSize: number,
    allowedMimeTypes: string[],
    private usuarioRepository?: IUsuarioRepository,
    private categoriaRepository?: ICategoriaRepository
  ) {
    this.fileValidator = new FileValidator(maxFileSize, allowedMimeTypes);
  }

  async execute(
    file: Express.Multer.File,
    idUsuario: string,
    idCarpeta: string | null,
    opts?: UploadExecuteOptions
  ): Promise<{ archivo: Archivo; areasNas: string[] }> {
    this.fileValidator.validate(file);

    const fecha = new Date();
    const areasNas = await this.resolverCodigosDestino(opts?.areaDestino, idUsuario, opts?.jwtRol ?? '');
    const rutasRelativas = areasNas.map((c) => this.generarRutaPorCategoriaYFecha(c, fecha));

    const rutaPrimary = rutasRelativas[0];
    const rutasMirror = rutasRelativas.length > 1 ? rutasRelativas.slice(1) : null;

    const nombreFisico = this.generarNombreCifrado(file.originalname);
    const hashSha256 = this.calcularHash(file.buffer);
    const vig =
      opts?.vigencia ??
      ({ esPermanente: true, fechaInicioVigencia: null, fechaFinVigencia: null } satisfies UploadVigenciaParsed);

    if (!useTempStorageStaging()) {
      await this.permanentStorageService.saveFile(rutaPrimary, nombreFisico, file.buffer);
      if (rutasMirror?.length) {
        for (const dirEsp of rutasMirror) {
          await this.permanentStorageService.saveFile(dirEsp, nombreFisico, file.buffer);
        }
      }

      const archivoDirecto = new Archivo(
        uuidv4(),
        idUsuario,
        idCarpeta,
        file.originalname,
        nombreFisico,
        rutaPrimary,
        file.mimetype,
        file.size,
        hashSha256,
        false,
        null,
        fecha,
        fecha,
        null,
        rutasMirror,
        vig.esPermanente,
        vig.fechaInicioVigencia,
        vig.fechaFinVigencia,
        null
      );

      try {
        const archivoGuardado = await this.archivoRepository.save(archivoDirecto);
        return { archivo: archivoGuardado, areasNas };
      } catch (e) {
        try {
          await this.permanentStorageService.deleteFile(rutaPrimary, nombreFisico);
          if (rutasMirror?.length) {
            for (const dirEsp of rutasMirror) {
              await this.permanentStorageService.deleteFile(dirEsp, nombreFisico);
            }
          }
        } catch {
          /* best effort */
        }
        throw e;
      }
    }

    const rutaTemporal = await this.tempStorageService.saveFile('', nombreFisico, file.buffer);

    const archivo = new Archivo(
      uuidv4(),
      idUsuario,
      idCarpeta,
      file.originalname,
      nombreFisico,
      rutaPrimary,
      file.mimetype,
      file.size,
      hashSha256,
      true,
      rutaTemporal,
      fecha,
      fecha,
      null,
      rutasMirror,
      vig.esPermanente,
      vig.fechaInicioVigencia,
      vig.fechaFinVigencia,
      null
    );

    const archivoGuardado = await this.archivoRepository.save(archivo);

    try {
      await this.permanentStorageService.saveFile(rutaPrimary, nombreFisico, file.buffer);
      if (rutasMirror?.length) {
        for (const dirEsp of rutasMirror) {
          await this.permanentStorageService.saveFile(dirEsp, nombreFisico, file.buffer);
        }
      }
    } catch (e) {
      console.warn(
        `[Upload] NAS permanente no disponible para ${nombreFisico}; queda solo en temp hasta el próximo ciclo.`,
        e
      );
      return { archivo: archivoGuardado, areasNas };
    }

    const promovido = new Archivo(
      archivoGuardado.id,
      archivoGuardado.idUsuario,
      archivoGuardado.idCarpeta,
      archivoGuardado.nombreOriginal,
      archivoGuardado.nombreFisico,
      archivoGuardado.rutaFisica,
      archivoGuardado.mimeType,
      archivoGuardado.tamanoBytes,
      archivoGuardado.hashSha256,
      false,
      null,
      archivoGuardado.createdAt,
      new Date(),
      archivoGuardado.lastDownloadAt,
      archivoGuardado.rutasEspejo,
      archivoGuardado.esPermanente,
      archivoGuardado.fechaInicioVigencia,
      archivoGuardado.fechaFinVigencia,
      archivoGuardado.deletedAt
    );
    const actualizado = await this.archivoRepository.update(promovido);
    await this.tempStorageService.deleteFile('', nombreFisico);

    return { archivo: actualizado, areasNas };
  }

  private async construirNasLookup(): Promise<NasLookup> {
    const list = await this.categoriaRepository!.findAllActivas();
    const byTok = new Map<string, string>();
    const unicos = new Set<string>();

    for (const c of list) {
      const seg = sanitizarCodigoParaCarpetaNas(c.codigo);
      if (!seg) continue;
      unicos.add(seg);
      byTok.set(seg.toUpperCase(), seg);
      byTok.set((c.codigo || '').trim().toUpperCase(), seg);
    }

    const todosSegmentosSorted = [...unicos].sort();
    return {
      todosSegmentosSorted,
      resolverTokenUpper: (tok: string) => byTok.get(String(tok ?? '').trim().toUpperCase()),
    };
  }

  private resolverTokensNasObligatorios(lookup: NasLookup, tokensUpper: string[]): string[] {
    const out: string[] = [];
    for (const tok of tokensUpper) {
      const seg = lookup.resolverTokenUpper(tok.trim().toUpperCase());
      if (!seg) {
        throw new ValidationError(`Código de área NAS desconocido: ${tok.trim()}`);
      }
      out.push(seg);
    }
    return [...new Set(out)].sort();
  }

  private async usuarioSegmentosPermitidos(idUsuario: string): Promise<Set<string>> {
    const perm = new Set<string>();
    if (!this.usuarioRepository || !this.categoriaRepository) return perm;

    const usuario = await this.usuarioRepository.findById(idUsuario);
    if (!usuario?.categoriaIds?.length) return perm;

    for (const idCat of usuario.categoriaIds) {
      const cat = await this.categoriaRepository.findById(idCat);
      if (!cat) continue;
      const seg = sanitizarCodigoParaCarpetaNas(cat.codigo);
      if (seg) perm.add(seg);
    }
    return perm;
  }

  private async validarUsuarioPuedeNasSegmentos(
    segmentos: string[],
    idUsuario: string,
    jwtRol: string
  ): Promise<void> {
    const isAdmin = (jwtRol || '').toUpperCase() === 'ADMIN';
    if (isAdmin) return;

    const allowed = await this.usuarioSegmentosPermitidos(idUsuario);
    const bad = segmentos.filter((s) => !allowed.has(s));
    if (bad.length) {
      throw new ValidationError(
        `No podés subir físicamente a: ${bad.join(', ')}. Solo a tus unidades asignadas.`
      );
    }
  }

  private async resolverCodigosDestino(
    areaDestinoRaw: string | undefined | null,
    idUsuario: string,
    jwtRol: string
  ): Promise<string[]> {
    if (!this.usuarioRepository || !this.categoriaRepository) {
      return ['SIN_CATEGORIA'];
    }

    const lookup = await this.construirNasLookup();
    const isAdmin = (jwtRol || '').toUpperCase() === 'ADMIN';
    const rawTrim = areaDestinoRaw?.trim();

    const validarMisSegmentosSiNoAdmin = async (segmentos: string[]) =>
      this.validarUsuarioPuedeNasSegmentos(segmentos, idUsuario, jwtRol);

    // AUTO
    if (!rawTrim || rawTrim.toUpperCase() === 'AUTO') {
      const usuario = await this.usuarioRepository.findById(idUsuario);
      if (!usuario?.categoriaIds?.length) {
        return ['SIN_CATEGORIA'];
      }
      const primera = await this.categoriaRepository.findById(usuario.categoriaIds[0]);
      const seg = primera ? sanitizarCodigoParaCarpetaNas(primera.codigo) : '';
      if (!seg) return ['SIN_CATEGORIA'];
      await validarMisSegmentosSiNoAdmin([seg]);
      return [seg];
    }

    const up = rawTrim.toUpperCase();
    if (up === '*' || up === 'ALL' || up === '__ALL__') {
      let targets: string[];
      if (isAdmin) {
        targets = [...lookup.todosSegmentosSorted];
        if (!targets.length) throw new ValidationError('No hay categorías (unidades) configuradas.');
      } else {
        const allowedSet = await this.usuarioSegmentosPermitidos(idUsuario);
        targets = [...allowedSet].sort();
        if (targets.length < 2) {
          throw new ValidationError(
            'Para replicar en varias carpetas físicas necesitás tener al menos dos unidades asignadas.'
          );
        }
      }
      await validarMisSegmentosSiNoAdmin(targets);
      return targets;
    }

    const csvTokensUpper = [...new Set(rawTrim.split(/[,;/]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
    if (!csvTokensUpper.length) {
      throw new ValidationError('Indica al menos una unidad o AUTO');
    }

    const resolved = this.resolverTokensNasObligatorios(lookup, csvTokensUpper);
    await validarMisSegmentosSiNoAdmin(resolved);
    return resolved;
  }

  /**
   * Ruta física relativa por área NAS: {segment}/YYYY/MM/DD (`segment` = sanitizado del código en BD).
   */
  private generarRutaPorCategoriaYFecha(segmentoNas: string, fecha: Date): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${segmentoNas}/${y}/${m}/${d}`;
  }

  private generarNombreCifrado(nombreOriginal: string): string {
    const extension = path.extname(nombreOriginal);
    const hash = createHash('sha256')
      .update(nombreOriginal + Date.now() + Math.random().toString())
      .digest('hex')
      .substring(0, 32);
    return `${hash}${extension}`;
  }

  private calcularHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
