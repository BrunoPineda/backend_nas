import dotenv from 'dotenv';
import { app } from './infrastructure/http/express/app';
import { CleanTemporaryFilesJob } from './infrastructure/jobs/CleanTemporaryFilesJob';
import { ArchivoRepository } from './infrastructure/database/sqlserver/repositories/ArchivoRepository';
import { LocalStorageService } from './infrastructure/storage/local/LocalStorageService';
import { TemporaryStorageService } from './infrastructure/storage/local/TemporaryStorageService';

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

// Validar que las rutas estén definidas
if (!process.env.TEMP_STORAGE_PATH || !process.env.STORAGE_ROOT_PATH) {
  console.warn('Advertencia: Variables de entorno no definidas, usando valores por defecto');
  console.warn(`   TEMP_STORAGE_PATH: ${TEMP_STORAGE_PATH}`);
  console.warn(`   STORAGE_ROOT_PATH: ${STORAGE_ROOT_PATH}`);
}

// Inicializar servicios
const archivoRepository = new ArchivoRepository();
const tempStorageService = new TemporaryStorageService(TEMP_STORAGE_PATH);
const permanentStorageService = new LocalStorageService(STORAGE_ROOT_PATH);

// Iniciar job de limpieza de archivos temporales
const cleanJob = new CleanTemporaryFilesJob(
  archivoRepository,
  tempStorageService,
  permanentStorageService
);
cleanJob.start();

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en ${DISPLAY_URL}`);
  console.log(`Almacenamiento temporal: ${TEMP_STORAGE_PATH}`);
  console.log(`Almacenamiento permanente: ${STORAGE_ROOT_PATH}`);
});

