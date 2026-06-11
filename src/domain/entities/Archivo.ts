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
}

