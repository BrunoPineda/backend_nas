export class Rol {
  constructor(
    public readonly id: string,
    public readonly nombre: string,
    public readonly descripcion: string | null,
    public readonly esSistema: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}

