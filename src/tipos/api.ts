/**
 * Forma de las respuestas de la API de la catedra (PRD, "Como va a venir la informacion").
 *
 *   exito: { "datos": [...], "meta": { "total": 128, "pagina": 1, "porPagina": 20 } }
 *   error: { "error": { "codigo": "FOTO_REQUERIDA", "mensaje": "..." } }
 *
 * OJO: el PRD muestra "datos" como arreglo. Para respuestas de un solo elemento asumimos
 * que "datos" es el objeto (S-09 en el README). Por eso RespuestaOk<T> es generico: se usa
 * RespuestaOk<Reporte[]> o RespuestaOk<Reporte> segun el endpoint.
 */

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
