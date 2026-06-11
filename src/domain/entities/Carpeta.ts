export class Carpeta {
  constructor(
    public readonly id: string,
    public readonly nombre: string,
    public readonly idPadre: string | null,
    public readonly idUsuario: string,
    public readonly esCompartida: boolean,
    public readonly esPublica: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null
  ) {}

  estaEliminada(): boolean {
    return this.deletedAt !== null;
  }
}

