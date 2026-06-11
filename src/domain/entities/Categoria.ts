export class Categoria {
  constructor(
    public readonly id: string,
    public readonly codigo: string,
    public readonly descripcion: string,
    public readonly createdAt: Date
  ) {}
}
