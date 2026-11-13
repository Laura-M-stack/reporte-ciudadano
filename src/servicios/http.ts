/**
 * Cliente HTTP. Unico lugar donde se llama a fetch.
 *
 * Traduce la forma de respuesta de la catedra a valores o a ErrorServicio:
 *   exito: { "datos": ..., "meta": {...} }
 *   error: { "error": { "codigo": "...", "mensaje": "..." } }
 *
 * MIENTRAS NO EXISTA LA API: si EXPO_PUBLIC_API_URL esta vacia, `hayApi()` devuelve false
 * y cada servicio responde con el mock. La decision esta en un solo lugar; cuando la
 * catedra publique la URL, se completa el .env y no se toca ninguna pantalla.
 */
import { CODIGOS, ErrorServicio, comoErrorServicio, desdeErrorApi } from '../errores';
import type { MetaPaginacion, Pagina, RespuestaApi } from '../tipos';
import { esRespuestaError } from '../tipos/api';

export const URL_API = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** false mientras la catedra no publique la API: los servicios usan src/mocks. */
export function hayApi(): boolean {
  return URL_API.length > 0;
}

/**
 * 45 s y no 15: la API publicada en Render (plan gratis) se duerme a los 15 minutos sin uso y
 * tarda cerca de un minuto en despertar. Con 15 s el primer pedido del dia fallaba siempre
 * por tiempo agotado. La pantalla igual muestra que esta cargando mientras espera.
 */
const TIEMPO_LIMITE_MS = 45_000;

/** 5xx (o un proxy que devuelve HTML mientras el servidor arranca): vale la pena reintentar. */
const esFallaDelServidor = (estado: number) => estado >= 500;

/** El token lo inyecta el servicio de auth al iniciar sesion; http no conoce SecureStore. */
let obtenerToken: () => string | null = () => null;

export function configurarToken(proveedor: () => string | null): void {
  obtenerToken = proveedor;
}

export interface OpcionesPeticion {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  cuerpo?: unknown;
  /** Se agregan al query string; los undefined y null se descartan. */
  parametros?: Record<string, string | number | boolean | null | undefined>;
  /** Para POST de reportes: el idLocal viaja como clave de idempotencia (ver P-08). */
  claveIdempotencia?: string;
  senal?: AbortSignal;
  /** Multipart, para subir fotos y audio. Si viene, se ignora `cuerpo`. */
  formulario?: FormData;
}

function armarUrl(ruta: string, parametros?: OpcionesPeticion['parametros']): string {
  const base = `${URL_API}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
  if (!parametros) return base;
  const qs = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === null) continue;
    qs.append(clave, String(valor));
  }
  const texto = qs.toString();
  return texto ? `${base}?${texto}` : base;
}

/**
 * Hace la peticion y devuelve `datos` ya desempaquetado.
 * Lanza SIEMPRE ErrorServicio, nunca un Error generico ni un objeto suelto.
 */
export async function pedir<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const { datos } = await pedirCompleto<T>(ruta, opciones);
  return datos;
}

/** Igual que `pedir` pero conserva `meta` (para las listas paginadas). */
export async function pedirCompleto<T>(
  ruta: string,
  opciones: OpcionesPeticion = {},
): Promise<{ datos: T; meta?: MetaPaginacion }> {
  if (!hayApi()) {
    throw new ErrorServicio(
      CODIGOS.SIN_CONEXION,
      'Todavia no hay API configurada (EXPO_PUBLIC_API_URL vacía).',
      { detalles: { ruta } },
    );
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_MS);
  opciones.senal?.addEventListener?.('abort', () => controlador.abort());

  const token = obtenerToken();
  const cabeceras: Record<string, string> = { Accept: 'application/json' };
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  if (opciones.claveIdempotencia) cabeceras['Idempotency-Key'] = opciones.claveIdempotencia;
  if (!opciones.formulario && opciones.cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(armarUrl(ruta, opciones.parametros), {
      method: opciones.metodo ?? 'GET',
      headers: cabeceras,
      body: opciones.formulario ?? (opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined),
      signal: controlador.signal,
    });
  } catch (e) {
    clearTimeout(temporizador);
    if ((e as Error)?.name === 'AbortError') {
      throw new ErrorServicio(CODIGOS.TIEMPO_AGOTADO, 'La conexión tardo demasiado.', {
        causa: e,
        reintentable: true,
      });
    }
    throw new ErrorServicio(CODIGOS.SIN_CONEXION, 'No hay conexión con el servidor.', {
      causa: e,
      reintentable: true,
    });
  }
  clearTimeout(temporizador);

  // 204 (DELETE /dispositivos/:token): exito sin cuerpo. No hay "datos" que desempaquetar.
  if (respuesta.status === 204) return { datos: undefined as T };

  let cuerpo: RespuestaApi<T> | null = null;
  const texto = await respuesta.text();
  if (texto) {
    try {
      cuerpo = JSON.parse(texto) as RespuestaApi<T>;
    } catch (e) {
      throw new ErrorServicio(
        esFallaDelServidor(respuesta.status) ? CODIGOS.ERROR_SERVIDOR : CODIGOS.RESPUESTA_INVALIDA,
        'El servidor devolvio algo que no es JSON.',
        {
          causa: e,
          detalles: { estado: respuesta.status },
          reintentable: esFallaDelServidor(respuesta.status),
        },
      );
    }
  }

  if (cuerpo && esRespuestaError(cuerpo)) {
    const error = desdeErrorApi(cuerpo.error, { estado: respuesta.status, ruta });
    // Un 500 con el sobre de error de la API (ERROR_INTERNO, ALMACEN_NO_DISPONIBLE) es una
    // falla pasajera del servidor, no un dato mal cargado: la cola tiene que reintentarlo en
    // vez de dejar el reporte en "error" para siempre.
    if (esFallaDelServidor(respuesta.status)) {
      throw new ErrorServicio(error.codigo, error.mensaje, {
        detalles: error.detalles,
        reintentable: true,
      });
    }
    // 401 de la API: el token vencio o es invalido. Se unifica en SESION_EXPIRADA salvo en el
    // login, donde el 401 significa "email o contraseña incorrectos".
    if (respuesta.status === 401 && error.codigo === 'NO_AUTENTICADO') {
      throw new ErrorServicio(CODIGOS.SESION_EXPIRADA, 'Tu sesión venció.', {
        detalles: { estado: 401, ruta },
      });
    }
    throw error;
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new ErrorServicio(CODIGOS.SESION_EXPIRADA, 'Tu sesión venció.', {
        detalles: { estado: 401 },
      });
    }
    if (respuesta.status === 403) {
      throw new ErrorServicio(CODIGOS.SIN_PERMISO, 'Tu cuenta no tiene permiso para esto.', {
        detalles: { estado: 403 },
      });
    }
    if (respuesta.status === 404) {
      throw new ErrorServicio(CODIGOS.NO_ENCONTRADO, 'No encontramos lo que buscabas.', {
        detalles: { estado: 404, ruta },
      });
    }
    throw new ErrorServicio(CODIGOS.ERROR_SERVIDOR, 'El servidor respondio con un error.', {
      detalles: { estado: respuesta.status, ruta },
      reintentable: respuesta.status >= 500,
    });
  }

  if (!cuerpo || !('datos' in cuerpo)) {
    throw new ErrorServicio(
      CODIGOS.RESPUESTA_INVALIDA,
      'La respuesta no trae el campo "datos".',
      { detalles: { ruta } },
    );
  }

  return { datos: cuerpo.datos, meta: cuerpo.meta };
}

/** Normaliza una respuesta de lista para las pantallas: siempre hay `meta`. */
export function aPagina<T>(datos: T[], meta: MetaPaginacion | undefined): Pagina<T> {
  return {
    datos,
    meta: meta ?? { total: datos.length, pagina: 1, porPagina: datos.length || 20 },
  };
}

/** Solo para tests y para simular latencia contra los mocks. */
export function demorar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

export { comoErrorServicio };
