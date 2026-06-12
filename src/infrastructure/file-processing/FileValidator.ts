import { formatByteLimit } from '../../shared/constants/storageLimits';

export class FileValidator {
  private allowAllTypes: boolean;

  constructor(
    private maxSizeBytes: number,
    private allowedMimeTypes: string[]
  ) {
    // FORZAR: Por defecto SIEMPRE permitir todos los tipos
    // Solo validar si se especifica una lista restrictiva explícita (sin '*')
    
    // Verificar si hay wildcard
    const hasWildcard = allowedMimeTypes && (
      allowedMimeTypes.includes('*') || 
      allowedMimeTypes.includes('*/*')
    );
    
    // Permitir todos si:
    // 1. No hay lista
    // 2. Lista vacía
    // 3. Contiene '*'
    // 4. Todos los elementos están vacíos
    this.allowAllTypes = 
      !allowedMimeTypes || 
      allowedMimeTypes.length === 0 || 
      hasWildcard ||
      allowedMimeTypes.every(type => !type || type.trim() === '');
    
    // Log para debug - MUY IMPORTANTE
    console.log('=== FileValidator Constructor ===');
    console.log('allowedMimeTypes recibido:', allowedMimeTypes);
    console.log('allowAllTypes calculado:', this.allowAllTypes);
    console.log('hasWildcard:', hasWildcard);
    console.log('================================');
  }

  validate(file: Express.Multer.File): void {
    console.log('=== FileValidator.validate ===');
    console.log('Archivo:', file.originalname);
    console.log('MIME type:', file.mimetype);
    console.log('allowAllTypes:', this.allowAllTypes);
    console.log('allowedMimeTypes:', this.allowedMimeTypes);
    
    // Validar tamaño
    if (file.size > this.maxSizeBytes) {
      throw new Error(
        `Archivo excede el tamaño máximo de ${formatByteLimit(this.maxSizeBytes)}`
      );
    }

    // PRIMERA VERIFICACIÓN: Si allowAllTypes es true, PERMITIR TODO
    if (this.allowAllTypes === true) {
      console.log('✅ PERMITIENDO archivo (allowAllTypes=true)');
      return; // SALIR - no validar tipo MIME
    }

    // Solo llegar aquí si hay una lista restrictiva
    console.log('⚠️ Validando con lista restrictiva');
    if (!this.allowedMimeTypes || !this.allowedMimeTypes.includes(file.mimetype)) {
      console.log('❌ RECHAZANDO archivo');
      throw new Error(`Tipo de archivo no permitido: ${file.mimetype}`);
    }
    console.log('✅ PERMITIENDO archivo (está en lista)');
  }
}

