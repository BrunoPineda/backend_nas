export class Permiso {
  constructor(
    public readonly id: string,
    public readonly nombre: string,
    public readonly descripcion: string | null,
    public readonly createdAt: Date
  ) {}
}

