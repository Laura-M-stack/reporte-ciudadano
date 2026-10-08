/**
 * Error tipado de toda la app. REGLA DEL EQUIPO: ningun servicio ni utilidad lanza
 * `new Error("algo")`. Siempre `new ErrorServicio(codigo, mensaje)`, con un codigo de
 * CODIGOS. La UI decide que mostrar mirando el codigo, nunca parseando el texto.
 *
 * El codigo tiene la misma forma que el que devuelve la API de la catedra:
 *   { "error": { "codigo": "FOTO_REQUERIDA", "mensaje": "El reporte necesita al menos una foto." } }
 * asi un error de red y un error del servidor se manejan igual en la pantalla.
 */
import type { ErrorApi } from './tipos/api';

/** Codigos propios de la app (los del servidor llegan como string y se respetan tal cual). */
export const CODIGOS = {
  // Red / transporte
  SIN_CONEXION: 'SIN_CONEXION',
  TIEMPO_AGOTADO: 'TIEMPO_AGOTADO',
  RESPUESTA_INVALIDA: 'RESPUESTA_INVALIDA',
  ERROR_SERVIDOR: 'ERROR_SERVIDOR',
  // Sesion
  CREDENCIALES_INVALIDAS: 'CREDENCIALES_INVALIDAS',
  SESION_EXPIRADA: 'SESION_EXPIRADA',
  SIN_PERMISO: 'SIN_PERMISO',
  BIOMETRIA_NO_DISPONIBLE: 'BIOMETRIA_NO_DISPONIBLE',
  BIOMETRIA_FALLIDA: 'BIOMETRIA_FALLIDA',
  // Reportes
  FOTO_REQUERIDA: 'FOTO_REQUERIDA',
  TIPO_REQUERIDO: 'TIPO_REQUERIDO',
  UBICACION_REQUERIDA: 'UBICACION_REQUERIDA',
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  // Datos / logica pura
  COORDENADAS_INVALIDAS: 'COORDENADAS_INVALIDAS',
  POLIGONO_INVALIDO: 'POLIGONO_INVALIDO',
  // Cola offline
  COLA_MAX_INTENTOS: 'COLA_MAX_INTENTOS',
  COLA_ITEM_INEXISTENTE: 'COLA_ITEM_INEXISTENTE',
  // Almacenamiento
  ERROR_BASE_DATOS: 'ERROR_BASE_DATOS',
  ERROR_ARCHIVO: 'ERROR_ARCHIVO',
  // Comodin
  DESCONOCIDO: 'DESCONOCIDO',
} as const;

export type CodigoError = (typeof CODIGOS)[keyof typeof CODIGOS] | (string & {});

interface OpcionesErrorServicio {
  /** Error original, para logs. Nunca se muestra al usuario. */
  causa?: unknown;
  /** Datos extra (id del recurso, status HTTP, etc.). */
  detalles?: Record<string, unknown>;
  /** Si el llamador puede reintentar (timeouts, sin conexion). */
  reintentable?: boolean;
}

export class ErrorServicio extends Error {
  /** Marca para reconocerlo aunque cruce el limite de un bundle o pierda el prototipo. */
  readonly esErrorServicio = true as const;
  readonly codigo: CodigoError;
  /** Mismo texto que `message`, con el nombre que usa la API. */
  readonly mensaje: string;
  readonly detalles?: Record<string, unknown>;
  readonly reintentable: boolean;
  readonly causa?: unknown;

  constructor(codigo: CodigoError, mensaje: string, opciones: OpcionesErrorServicio = {}) {
    super(mensaje);
    // Sin esto, `instanceof ErrorServicio` falla al transpilar a ES5 (Hermes/Babel).
    Object.setPrototypeOf(this, ErrorServicio.prototype);
    this.name = 'ErrorServicio';
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.detalles = opciones.detalles;
    this.reintentable = opciones.reintentable ?? false;
    this.causa = opciones.causa;
  }

  /** Forma serializable, igual a la del cuerpo de error de la API. */
  aErrorApi(): ErrorApi {
    return { codigo: this.codigo, mensaje: this.mensaje };
  }
}

export function esErrorServicio(e: unknown): e is ErrorServicio {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { esErrorServicio?: boolean }).esErrorServicio === true
  );
}

/** Convierte el cuerpo de error de la API en un ErrorServicio. */
export function desdeErrorApi(error: ErrorApi, detalles?: Record<string, unknown>): ErrorServicio {
  return new ErrorServicio(error.codigo, error.mensaje, { detalles });
}

/**
 * Envuelve cualquier cosa atrapada en un catch. Si ya es ErrorServicio lo deja pasar,
 * asi no se pierde el codigo original al subir por las capas.
 */
export function comoErrorServicio(
  e: unknown,
  codigoPorDefecto: CodigoError = CODIGOS.DESCONOCIDO,
  mensajePorDefecto = 'Ocurrio un error inesperado. Volve a intentar.',
): ErrorServicio {
  if (esErrorServicio(e)) return e;
  const mensaje = e instanceof Error && e.message ? e.message : mensajePorDefecto;
  return new ErrorServicio(codigoPorDefecto, mensaje, { causa: e });
}

/**
 * Texto para mostrarle al vecino. Los codigos que no conocemos caen en el mensaje del
 * servidor, que segun el PRD ya viene redactado para humanos.
 */
const MENSAJES_AMIGABLES: Partial<Record<string, string>> = {
  [CODIGOS.SIN_CONEXION]: 'No hay conexion. Lo guardamos en el telefono y se envia solo cuando vuelva la senal.',
  [CODIGOS.TIEMPO_AGOTADO]: 'La conexion tardo demasiado. Probá de nuevo en un momento.',
  [CODIGOS.ERROR_SERVIDOR]: 'El sistema de la Municipalidad no responde. Volvé a intentar mas tarde.',
  [CODIGOS.CREDENCIALES_INVALIDAS]: 'El correo o la contrasena no coinciden.',
  [CODIGOS.SESION_EXPIRADA]: 'Tu sesion venció. Ingresá otra vez.',
  [CODIGOS.SIN_PERMISO]: 'Tu cuenta no tiene permiso para hacer esto.',
  [CODIGOS.FOTO_REQUERIDA]: 'El reporte necesita al menos una foto.',
  [CODIGOS.NO_ENCONTRADO]: 'No encontramos ese reporte.',
};

export function mensajeParaUsuario(e: unknown): string {
  const err = comoErrorServicio(e);
  return MENSAJES_AMIGABLES[err.codigo] ?? err.mensaje;
}
