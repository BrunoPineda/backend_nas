import dotenv from 'dotenv';
import { app } from './infrastructure/http/express/app';
import { CleanTemporaryFilesJob } from './infrastructure/jobs/CleanTemporaryFilesJob';
import { ArchivoRepository } from './infrastructure/database/sqlserver/repositories/ArchivoRepository';
import { CategoriaRepository } from './infrastructure/database/sqlserver/repositories/CategoriaRepository';
import { LocalStorageService } from './infrastructure/storage/local/LocalStorageService';
import { TemporaryStorageService } from './infrastructure/storage/local/TemporaryStorageService';
import { ensureNasFoldersForCategories, resolveStorageRootAbsolute } from './application/services/NasCategoryFolderService';
import { ensureArchivoRutasEspejoColumn } from './infrastructure/database/sqlserver/migrations/ensureArchivoRutasEspejoColumn';
import { ensureArchivoVigenciaColumns } from './infrastructure/database/sqlserver/migrations/ensureArchivoVigenciaColumns';
import { ensureCategoriaEsVigenteColumn } from './infrastructure/database/sqlserver/migrations/ensureCategoriaEsVigenteColumn';
import { ensureRolIntranetIdColumn } from './infrastructure/database/sqlserver/migrations/ensureRolIntranetIdColumn';
import { useTempStorageStaging } from './shared/config/storageEnv';
import { ExpireArchivoVigenciaJob } from './infrastructure/jobs/ExpireArchivoVigenciaJob';

dotenv.config();

// Parsear URL: puede ser http://localhost:3000 o una URL completa
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
let PORT = 3000;
let DISPLAY_URL = SERVER_URL;

// Extraer el puerto de la URL
try {
  const url = new URL(SERVER_URL);
  PORT = parseInt(url.port || '3000', 10);
  DISPLAY_URL = SERVER_URL;
} catch (e) {
  // Si no es una URL válida, intentar extraer el puerto manualmente
  const portMatch = SERVER_URL.match(/:(\d+)/);
  if (portMatch) {
    PORT = parseInt(portMatch[1], 10);
  }
  // Si no tiene protocolo, agregarlo
  if (!SERVER_URL.startsWith('http://') && !SERVER_URL.startsWith('https://')) {
    DISPLAY_URL = `http://${SERVER_URL}`;
  } else {
    DISPLAY_URL = SERVER_URL;
  }
}

const TEMP_STORAGE_PATH = process.env.TEMP_STORAGE_PATH || './temp';
const STORAGE_ROOT_PATH = process.env.STORAGE_ROOT_PATH || '../storage';

const STORAGE_ROOT_ABS = resolveStorageRootAbsolute();

// Validar que las rutas estén definidas
if (!process.env.TEMP_STORAGE_PATH || !process.env.STORAGE_ROOT_PATH) {
  console.warn('Advertencia: Variables de entorno no definidas, usando valores por defecto');
  console.warn(`   TEMP_STORAGE_PATH: ${TEMP_STORAGE_PATH}`);
  console.warn(`   STORAGE_ROOT_PATH: ${STORAGE_ROOT_PATH}`);
}

// Inicializar servicios
const archivoRepository = new ArchivoRepository();
const tempStorageService = new TemporaryStorageService(TEMP_STORAGE_PATH);
const permanentStorageService = new LocalStorageService(STORAGE_ROOT_ABS);

// Iniciar job de limpieza de archivos temporales
const cleanJob = new CleanTemporaryFilesJob(
  archivoRepository,
  tempStorageService,
  permanentStorageService
);
cleanJob.start();

const expireVigenciaJob = new ExpireArchivoVigenciaJob(archivoRepository);
expireVigenciaJob.start();

void (async () => {
  try {
    await ensureArchivoRutasEspejoColumn();
    console.log('[DB] Columna DE_RUTAS_ESPEJO en NASTM_ARCHIVOS lista.');
  } catch (e) {
    console.error(
      '[DB] No se pudo crear DE_RUTAS_ESPEJO (¿usuario SQL sin ALTER TABLE?). Ejecutá database/7.alter-archivo-rutas-espejo.sql manualmente.'
    );
    throw e;
  }

  try {
    await ensureArchivoVigenciaColumns();
    console.log('[DB] Columnas de vigencia (IN_ES_PERMANENTE, FE_INICIO/FIN) listas.');
  } catch (e) {
    console.error(
      '[DB] No se pudieron crear columnas de vigencia. Ejecutá database/8.alter-archivo-vigencia.sql manualmente.'
    );
    throw e;
  }

  try {
    await ensureCategoriaEsVigenteColumn();
    console.log('[DB] Columna ES_VIGENTE en NASTM_CATEGORIAS lista.');
  } catch (e) {
    console.error(
      '[DB] No se pudo crear ES_VIGENTE en categorías. Ejecutá database/9.alter-categoria-es-vigente.sql manualmente.'
    );
    throw e;
  }

  try {
    await ensureRolIntranetIdColumn();
    console.log('[DB] Columna NU_ID_ROL_INTRANET en NASTM_ROLES lista.');
  } catch (e) {
    console.error(
      '[DB] No se pudo crear NU_ID_ROL_INTRANET. Ejecutá database/10.alter-rol-intranet-id.sql manualmente.'
    );
  }

  try {
    const categoriaRepository = new CategoriaRepository();
    const categorias = await categoriaRepository.findAllActivas();
    await ensureNasFoldersForCategories(STORAGE_ROOT_ABS, categorias);
    console.log(
      `[NAS] Carpetas de categorías OK en "${STORAGE_ROOT_ABS}" (${categorias.length} categorías activas)`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[NAS] No se pudieron garantizar carpetas de categorías al arrancar:', msg);
  }

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en ${DISPLAY_URL}`);
    console.log(
      useTempStorageStaging()
        ? `Almacenamiento temporal (staging): ${TEMP_STORAGE_PATH}`
        : 'Almacenamiento temporal deshabilitado en subidas (USE_TEMP_STORAGE=false); job sigue por archivos legacy.'
    );
    console.log(`Almacenamiento permanente (absoluto): ${STORAGE_ROOT_ABS}`);
    console.log(`STORAGE_ROOT_PATH (.env): ${STORAGE_ROOT_PATH}`);
  });
})();

