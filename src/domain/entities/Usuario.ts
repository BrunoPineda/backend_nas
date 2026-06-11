export class Usuario {
  constructor(
    public readonly id: string,
    public readonly nombre: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly idRol: string | null,
    public readonly activo: boolean,
    public readonly limiteAlmacenamientoBytes: number,
    public readonly maxTamanoArchivoBytes: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly lastLoginAt: Date | null,
    /** Si es true: el contenido no se comparte con otros por categoría; solo enlaces públicos. */
    public readonly esPrivado: boolean,
    public readonly categoriaIds: string[] = []
  ) {}

  tienePermiso(permiso: string): boolean {
    // Esto se implementaría consultando la BD de permisos
    // Por ahora, lógica básica
    return false;
  }
}

