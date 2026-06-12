import { IArchivoRepository } from '../../../domain/repositories/IArchivoRepository';
import { IUsuarioRepository } from '../../../domain/repositories/IUsuarioRepository';
import { NotFoundError } from '../../../shared/errors/AppError';

export type StorageMimeBucket = 'documents' | 'images' | 'videos' | 'audio' | 'other';

export type StorageBreakdownItem = {
  tipo: StorageMimeBucket;
  cantidad: number;
  bytes: number;
};

export type UserStorageSummary = {
  totalFiles: number;
  totalBytes: number;
  limitBytes: number;
  porTipo: StorageBreakdownItem[];
};

const BUCKETS: StorageMimeBucket[] = ['documents', 'images', 'videos', 'audio', 'other'];

function esBucketValido(t: string): t is StorageMimeBucket {
  return (BUCKETS as string[]).includes(t);
}

export class GetUserStorageSummaryUseCase {
  constructor(
    private archivoRepository: IArchivoRepository,
    private usuarioRepository: IUsuarioRepository
  ) {}

  async execute(idUsuario: string): Promise<UserStorageSummary> {
    const usuario = await this.usuarioRepository.findById(idUsuario);
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const [totalFiles, totalBytes, rows] = await Promise.all([
      this.archivoRepository.countByUsuario(idUsuario),
      this.archivoRepository.getTotalSizeByUsuario(idUsuario),
      this.archivoRepository.getStorageBreakdownByUsuario(idUsuario),
    ]);

    const porMap = new Map<StorageMimeBucket, StorageBreakdownItem>();
    for (const b of BUCKETS) {
      porMap.set(b, { tipo: b, cantidad: 0, bytes: 0 });
    }
    for (const row of rows) {
      const tipo = esBucketValido(row.tipo) ? row.tipo : 'other';
      const prev = porMap.get(tipo)!;
      porMap.set(tipo, {
        tipo,
        cantidad: prev.cantidad + row.cantidad,
        bytes: prev.bytes + row.bytes,
      });
    }

    return {
      totalFiles,
      totalBytes,
      limitBytes: usuario.limiteAlmacenamientoBytes,
      porTipo: BUCKETS.map((b) => porMap.get(b)!),
    };
  }
}
