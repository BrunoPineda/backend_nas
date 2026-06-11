export class Enlace {
  constructor(
    public readonly id: string,
    public readonly idArchivo: string,
    public readonly token: string,
    public readonly esTemporal: boolean,
    public readonly fechaExpiracion: Date | null,
    public readonly maxVisitas: number | null,
    public readonly visitasActuales: number,
    public readonly fechaUltimaVisita: Date | null,
    public readonly activo: boolean,
    public readonly createdAt: Date,
    public readonly createdBy: string | null
  ) {}

  estaExpirado(): boolean {
    if (!this.activo) return true;
    if (!this.esTemporal) return false;
    
    if (this.fechaExpiracion) {
      const ahora = new Date();
      if (ahora > this.fechaExpiracion) return true;
    }
    
    if (this.maxVisitas !== null) {
      if (this.visitasActuales >= this.maxVisitas) return true;
    }
    
    return false;
  }

  puedeAcceder(): boolean {
    return !this.estaExpirado();
  }
}

