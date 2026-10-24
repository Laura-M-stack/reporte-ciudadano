export interface MetaPaginacion {
  total: number;
  pagina: number;
  porPagina: number;
}

export interface RespuestaOk<T> {
  datos: T;
  meta?: MetaPaginacion;
}

export interface ErrorApi {
  codigo: string;
  mensaje: string;
}

export interface RespuestaError {
  error: ErrorApi;
}

export type RespuestaApi<T> = RespuestaOk<T> | RespuestaError;

export function esRespuestaError<T>(r: RespuestaApi<T>): r is RespuestaError {
  return typeof r === 'object' && r !== null && 'error' in r;
}

/** Resultado paginado ya normalizado para las pantallas. */
export interface Pagina<T> {
  datos: T[];
  meta: MetaPaginacion;
}

export interface ParametrosPaginacion {
  pagina?: number;
  porPagina?: number;
}
