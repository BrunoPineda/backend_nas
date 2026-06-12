export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface JwtPayload {
  userId: string;
  email: string;
  rol: string;
  /** DNI/codUsuario en BDJUNTOS (identidad corporativa). */
  codUsuario?: string;
  useIntranet?: boolean;
  /** Permisos NAS resueltos en middleware (solo runtime, no firmados en JWT). */
  permisos?: string[];
  /** Unidades efectivas desde BDJUNTOS (runtime, middleware). */
  categorias?: { id: string; codigo: string; descripcion: string }[];
  iat?: number;
  exp?: number;
}

