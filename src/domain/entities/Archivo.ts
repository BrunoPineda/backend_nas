export class Archivo {
  constructor(
    public readonly id: string,
    public readonly idUsuario: string,
    public readonly idCarpeta: string | null,
    public readonly nombreOriginal: string,
    public readonly nombreFisico: string,
    public readonly rutaFisica: string,
    public readonly mimeType: string,
    public readonly tamanoBytes: number,
    public readonly hashSha256: string | null,
    public readonly enTemporal: boolean,
    public readonly rutaTemporal: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly lastDownloadAt: Date | null,
    /** Directorios relativos adicionales (mismo nombreFisico) para copias en otras áreas NAS. */
    public readonly rutasEspejo: string[] | null,
    /** true = sin ventana de fechas; false = FE_INICIO/FE_FIN aplican. */
    public readonly esPermanente: boolean,
    public readonly fechaInicioVigencia: Date | null,
    public readonly fechaFinVigencia: Date | null,
    public readonly deletedAt: Date | null
  ) {}

  get rutaCompleta(): string {
    if (this.enTemporal && this.rutaTemporal) {
      return this.rutaTemporal;
    }
    return `${this.rutaFisica}/${this.nombreFisico}`;
  }

  estaExpiradoTemporal(): boolean {
    if (!this.enTemporal) return false;
    const ahora = new Date();
    const tiempoTranscurrido = ahora.getTime() - this.createdAt.getTime();
    return tiempoTranscurrido > 60000; // 1 minuto
  }

  estaEliminado(): boolean {
    return this.deletedAt !== null;
  }

  /** Disponible según ventana de fecha/hora (sin contar FE_BAJA). */
  estaEnVentanaVigencia(ref: Date = new Date()): boolean {
    if (this.esPermanente) return true;
    if (!this.fechaFinVigencia) return false;
    const t = ref.getTime();
    const fin = this.fechaFinVigencia.getTime();
    const inicio = this.fechaInicioVigencia?.getTime() ?? t;
    return t >= inicio && t <= fin;
  }
}
