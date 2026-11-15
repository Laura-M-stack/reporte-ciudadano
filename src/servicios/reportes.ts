/**
 * Servicio de reportes. UNICA puerta entre las pantallas y los datos.
 *
 * Regla del PRD: ninguna pantalla importa src/mocks ni habla con SQLite. Todo pasa por aca.
 * Mientras EXPO_PUBLIC_API_URL este vacia, cada funcion responde con el mock; cuando la
 * catedra publique la API, se completa el .env y no se toca ninguna pantalla.
 *
 * Todas las funciones son asincronas desde el dia uno, aunque el mock responda al instante.
 * Todas lanzan ErrorServicio (nunca Error pelado).
 */
import { File } from 'expo-file-system';
import { CODIGOS, ErrorServicio, comoErrorServicio, esErrorServicio } from '../errores';
import { preferencias } from '../datos/preferencias';
import {
  guardarCambios,
  guardarReportes,
  leerCambios,
  leerCercanos,
  leerReporte,
  leerReportes,
} from '../datos/reportesCache';
import {
  ADHESIONES,
  CAMBIOS_DE_ESTADO,
  DEMORA_MOCK_MS,
  REPORTES,
  fallasSimuladas,
} from '../mocks';
import type {
  Adhesion,
  BorradorReporte,
  CambioDeEstado,
  Coordenadas,
  EstadoReporte,
  Pagina,
  ParametrosPaginacion,
  Reporte,
} from '../tipos';
import { RADIO_DUPLICADOS_M, ahoraIso, nuevoUuid, reportesCercanos } from '../utils';

import { aPagina, demorar, hayApi, pedir, pedirCompleto } from './http';

/** Filtros de la bandeja del operador y del mapa publico. */
export interface FiltrosReporte extends ParametrosPaginacion {
  estado?: EstadoReporte;
  tipoId?: string;
  zonaId?: string;
  autorId?: string;
}

/**
 * Parametros para GET /reportes (el mapa publico). `autorId` NO viaja: la API no lo acepta
 * (rechaza con 400 cualquier parametro que no conoce) y los reportes propios se piden a
 * GET /yo/reportes. Se usa solo para filtrar en el mock y en la copia local.
 */
function aParametros(filtros: FiltrosReporte = {}): Record<string, string | number | undefined> {
  return {
    estado: filtros.estado,
    tipoId: filtros.tipoId,
    zonaId: filtros.zonaId,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
  };
}

/** Todos los estados, separados por coma: sin `estado`, GET /reportes no trae los rechazados. */
const TODOS_LOS_ESTADOS = 'recibido,en_revision,asignado,resuelto,rechazado';

/** Maximos de pagina que acepta la API (si se pide mas, responde 400). */
const POR_PAGINA_MAPA = 500;
const POR_PAGINA_LISTA = 100;

/** Radio maximo de GET /reportes/cercanos. */
const RADIO_MAXIMO_CERCANOS_M = 200;

function filtrarEnMemoria(reportes: Reporte[], filtros: FiltrosReporte = {}): Reporte[] {
  return reportes.filter((r) => {
    if (filtros.estado && r.estado !== filtros.estado) return false;
    if (filtros.tipoId && r.tipoId !== filtros.tipoId) return false;
    if (filtros.zonaId && r.zonaId !== filtros.zonaId) return false;
    if (filtros.autorId && r.autorId !== filtros.autorId) return false;
    return true;
  });
}

/** Del mas nuevo al mas viejo, que es como lo pide el PRD para la lista del vecino. */
function ordenarNuevosPrimero(reportes: Reporte[]): Reporte[] {
  return [...reportes].sort((a, b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn));
}

/**
 * Lista de reportes. Si hay API, la consulta; si no, usa el mock.
 * Si la API falla por red, cae a la copia local para que la app muestre algo sin conexion.
 */
export async function listarReportes(filtros: FiltrosReporte = {}): Promise<Pagina<Reporte>> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    const datos = ordenarNuevosPrimero(filtrarEnMemoria(REPORTES, filtros));
    return aPagina(datos, undefined);
  }

  try {
    const { datos, meta } = await pedirCompleto<Reporte[]>('/reportes', {
      parametros: {
        ...aParametros(filtros),
        porPagina: Math.min(filtros.porPagina ?? 20, POR_PAGINA_MAPA),
      },
    });
    // Guardar en cache es parte del contrato: la proxima vez la app abre sin conexion.
    await guardarReportes(datos).catch(() => undefined);
    return aPagina(datos, meta);
  } catch (e) {
    const error = comoErrorServicio(e);
    if (error.codigo === CODIGOS.SIN_CONEXION || error.codigo === CODIGOS.TIEMPO_AGOTADO) {
      const cacheados = filtrarEnMemoria(await leerReportes({ autorId: filtros.autorId }), filtros);
      if (cacheados.length > 0) return aPagina(ordenarNuevosPrimero(cacheados), undefined);
    }
    throw error;
  }
}

/**
 * Los reportes del vecino que entro. Con API va a GET /yo/reportes: el servidor sabe quien
 * es por el token, y trae todos sus reportes en cualquier estado (el mapa publico no).
 */
export async function listarMisReportes(
  autorId: string,
  filtros: FiltrosReporte = {},
): Promise<Pagina<Reporte>> {
  if (!hayApi()) return listarReportes({ ...filtros, autorId });

  try {
    const { datos, meta } = await pedirCompleto<Reporte[]>('/yo/reportes', {
      parametros: {
        pagina: filtros.pagina,
        porPagina: Math.min(filtros.porPagina ?? POR_PAGINA_LISTA, POR_PAGINA_LISTA),
      },
    });
    await guardarReportes(datos).catch(() => undefined);
    return aPagina(datos, meta);
  } catch (e) {
    const error = comoErrorServicio(e);
    if (error.codigo === CODIGOS.SIN_CONEXION || error.codigo === CODIGOS.TIEMPO_AGOTADO) {
      const cacheados = await leerReportes({ autorId });
      if (cacheados.length > 0) return aPagina(ordenarNuevosPrimero(cacheados), undefined);
    }
    throw error;
  }
}

/**
 * Todos los reportes de la ciudad para la bandeja del operador, en los cinco estados.
 *
 * Por que GET /reportes y no GET /bandeja: /bandeja trae solo los abiertos (y de a 100), y el
 * operador tambien necesita ver los resueltos (para subir la foto del arreglo) y los
 * rechazados (para auditar un duplicado). Los filtros y el orden por adhesiones los hace la
 * pantalla, igual que con el mock.
 */
export function listarBandeja(): Promise<Pagina<Reporte>> {
  if (!hayApi()) return listarReportes({ porPagina: 200 });
  return listarReportesConEstados(TODOS_LOS_ESTADOS);
}

async function listarReportesConEstados(estados: string): Promise<Pagina<Reporte>> {
  try {
    const { datos, meta } = await pedirCompleto<Reporte[]>('/reportes', {
      parametros: { estado: estados, porPagina: POR_PAGINA_MAPA },
    });
    await guardarReportes(datos).catch(() => undefined);
    return aPagina(datos, meta);
  } catch (e) {
    const error = comoErrorServicio(e);
    if (error.codigo === CODIGOS.SIN_CONEXION || error.codigo === CODIGOS.TIEMPO_AGOTADO) {
      const cacheados = await leerReportes({});
      if (cacheados.length > 0) return aPagina(ordenarNuevosPrimero(cacheados), undefined);
    }
    throw error;
  }
}

export async function obtenerReporte(id: string): Promise<Reporte> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    const reporte = REPORTES.find((r) => r.id === id);
    if (!reporte) {
      throw new ErrorServicio(CODIGOS.NO_ENCONTRADO, 'No encontramos ese reporte.', {
        detalles: { id },
      });
    }
    return reporte;
  }

  try {
    const reporte = await pedir<Reporte>(`/reportes/${id}`);
    await guardarReportes([reporte]).catch(() => undefined);
    return reporte;
  } catch (e) {
    const error = comoErrorServicio(e);
    if (error.reintentable) {
      const cacheado = await leerReporte(id);
      if (cacheado) return cacheado;
    }
    throw error;
  }
}

/**
 * Un reporte por su numero de seguimiento (GCHU-2026-00412). Es lo que trae el QR segun el
 * README de la API, y lo que el vecino puede dictar en la ventanilla.
 */
export async function obtenerReportePorCodigo(codigo: string): Promise<Reporte> {
  const normalizado = codigo.trim().toUpperCase();
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    const reporte = REPORTES.find((r) => r.codigo.toUpperCase() === normalizado);
    if (!reporte) {
      throw new ErrorServicio(CODIGOS.NO_ENCONTRADO, 'No encontramos ese reporte.');
    }
    return reporte;
  }
  const reporte = await pedir<Reporte>(`/reportes/codigo/${encodeURIComponent(normalizado)}`);
  await guardarReportes([reporte]).catch(() => undefined);
  return reporte;
}

/** Historial de cambios de estado ("Que fue pasando" en el mockup del PRD). */
export async function historialDeReporte(reporteId: string): Promise<CambioDeEstado[]> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    return CAMBIOS_DE_ESTADO.filter((c) => c.reporteId === reporteId).sort((a, b) =>
      a.fechaHora.localeCompare(b.fechaHora),
    );
  }

  try {
    // De a 100 (el maximo): con el default de 20, un reporte con muchas idas y vueltas
    // mostraria el historial cortado.
    const cambios = await pedir<CambioDeEstado[]>(`/reportes/${reporteId}/cambios`, {
      parametros: { porPagina: POR_PAGINA_LISTA },
    });
    await guardarCambios(cambios).catch(() => undefined);
    return cambios;
  } catch (e) {
    const error = comoErrorServicio(e);
    if (error.reintentable) {
      const cacheados = await leerCambios(reporteId);
      if (cacheados.length > 0) return cacheados;
    }
    throw error;
  }
}

/**
 * Arma la parte de un FormData para subir un archivo del telefono.
 *
 * El fetch de Expo (el global desde el SDK 52) NO acepta el formato clasico de React Native
 * `{ uri, name, type }`: falla con "Unsupported FormDataPart implementation". Hay que pasar
 * un `File` de expo-file-system, que ya trae nombre y tipo a partir de la extension.
 */
function parteDeArchivo(uri: string): File {
  const archivo = new File(uri);
  if (!archivo.exists) {
    // Reintentar no lo arregla: el archivo ya no esta.
    throw new ErrorServicio(CODIGOS.ERROR_ARCHIVO, 'La foto o el audio ya no están en el teléfono.', {
      detalles: { uri },
    });
  }
  return archivo;
}

/**
 * Sube un reporte. La llama el servicio de cola, NUNCA una pantalla: el vecino siempre
 * encola (aunque tenga señal), y la cola decide cuando subir. Asi hay un solo camino.
 *
 * `idLocal` viaja como clave de idempotencia: si se corta la red despues de que el
 * servidor guardo, el reintento no crea un duplicado (pendiente de confirmar, P-08).
 */
export async function crearReporte(
  borrador: BorradorReporte,
  idLocal: string,
  /** Cuando lo hizo el vecino (la API lo pide asi). Puede ser horas antes de subirse. */
  creadoEn: string = ahoraIso(),
): Promise<Reporte> {
  if (!borrador.adjuntos.some((a) => a.tipo === 'foto')) {
    throw new ErrorServicio(
      CODIGOS.FOTO_REQUERIDA,
      'El reporte necesita al menos una foto.',
    );
  }

  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    // El autor es quien tiene la sesion abierta, no un id fijo: si no, el reporte no
    // aparece en "Mis reclamos" de una cuenta recien registrada.
    const usuario = await preferencias.leerUsuario();
    const reporte = reporteSimulado(borrador, idLocal, usuario?.id ?? 'usr-084');
    // Sin esta linea el reporte se pierde: la cola lo marca como enviado y deja de
    // mostrarlo como pendiente, pero las listas leen REPORTES, donde no estaria.
    // El mock tiene que comportarse como un servidor: lo que crea, queda.
    REPORTES.unshift(reporte);
    return reporte;
  }

  // 1. Subir cada archivo que aun no tenga URL remota a POST /archivos. La API pide primero
  //    el archivo y despues el reporte con esa URL. Si un reintento de la cola vuelve a subir
  //    una foto que ya habia subido, queda un archivo sin usar en el servidor: no rompe nada.
  const fotos: { id?: string; url: string }[] = [];
  let audioUrl: string | null = null;

  for (const adjunto of borrador.adjuntos) {
    let url = adjunto.urlRemota;
    if (!url) {
      try {
        const form = new FormData();
        form.append('archivo', parteDeArchivo(adjunto.uri));

        const subido = await pedir<{ url: string }>('/archivos', {
          metodo: 'POST',
          formulario: form,
        });
        url = subido.url;
        adjunto.urlRemota = url;
      } catch (e) {
        const error = comoErrorServicio(e, CODIGOS.ERROR_ARCHIVO, 'No se pudo subir la foto o el audio.');
        // Diagnostico: deja marcado que la falla fue al subir el archivo, no al crear el reporte.
        throw new ErrorServicio(error.codigo, `${error.mensaje} (al subir ${adjunto.tipo})`, {
          causa: error.causa ?? e,
          detalles: error.detalles,
          reintentable: error.reintentable,
        });
      }
    }

    if (adjunto.tipo === 'audio') {
      audioUrl = url;
    } else {
      fotos.push({
        id: adjunto.id.startsWith('fot-') ? adjunto.id : undefined,
        url,
      });
    }
  }

  // 2. Enviar el reporte a POST /reportes
  const idCandidato = idLocal.startsWith('rep-')
    ? idLocal
    : idLocal.startsWith('local-')
      ? `rep-${idLocal.slice(6)}`
      : undefined;

  const cuerpo: Record<string, unknown> = {
    tipoId: borrador.tipoId,
    descripcion: borrador.descripcion || null,
    audioUrl,
    fotos,
    coordenadas: borrador.coordenadas,
    direccion: borrador.direccion,
    creadoEn,
  };

  // El id propio es lo que hace idempotente el envio: si la red se corta despues de que el
  // servidor guardo, el reintento con el mismo id devuelve el mismo reporte (200) en vez de
  // crear otro. La API no usa la cabecera Idempotency-Key; la mandamos igual (no molesta).
  if (idCandidato && /^rep-[A-Za-z0-9_-]{3,36}$/.test(idCandidato)) {
    cuerpo.id = idCandidato;
  }

  return pedir<Reporte>('/reportes', {
    metodo: 'POST',
    cuerpo,
    claveIdempotencia: idLocal,
  });
}

/** Reporte "como si" lo hubiera creado el servidor. Solo en modo mock. */
function reporteSimulado(
  borrador: BorradorReporte,
  idLocal: string,
  autorId: string,
): Reporte {
  const ahora = ahoraIso();
  void idLocal; // en modo mock no hace falta; con API viaja como clave de idempotencia.
  return {
    id: `rep-${nuevoUuid().slice(0, 8)}`,
    // SUPUESTO S-07: el codigo oficial lo asigna el servidor. En modo mock inventamos uno
    // con el formato del PRD solo para poder ver la pantalla de exito.
    codigo: `GCHU-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
    tipoId: borrador.tipoId,
    descripcion: borrador.descripcion,
    audioUrl: borrador.adjuntos.find((a) => a.tipo === 'audio')?.uri ?? null,
    fotos: borrador.adjuntos
      .filter((a) => a.tipo === 'foto')
      .map((a) => ({ id: a.id, url: a.urlRemota ?? a.uri, momento: a.momento })),
    coordenadas: borrador.coordenadas,
    direccion: borrador.direccion,
    // SUPUESTO S-14 (responde P-06, reemplaza al S-05 original): zonaIdDePunto ya resuelve
    // esto offline — intenta la zona exacta, despues la mas cercana si esta a menos de
    // UMBRAL_CERCANIA_ZONA_M, y si no hay ninguna devuelve ID_FUERA_DE_ZONA. El reporte se
    // envia igual en los tres casos; el operador puede reasignar la zona desde la bandeja.
    zonaId: borrador.zonaId,
    estado: 'recibido',
    autorId,
    cuadrillaId: null,
    duplicadoDe: null,
    adhesiones: 0,
    creadoEn: ahora,
    sincronizado: true,
  };
}

/**
 * Reportes existentes cerca del punto, para preguntar "¿es el mismo problema?".
 *
 * Funciona sin conexion: si no hay API o falla, busca en la copia local. Sin cache no hay
 * deteccion de duplicados offline, y eso hay que avisarlo en pantalla (P-03).
 */
export async function reportesCercaDe(
  punto: Coordenadas,
  radioM: number = RADIO_DUPLICADOS_M,
  tipoId?: string,
): Promise<Reporte[]> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    return reportesCercanos(punto, REPORTES, radioM, tipoId).map((c) => c.reporte);
  }

  try {
    return await pedir<Reporte[]>('/reportes/cercanos', {
      parametros: {
        latitud: punto.latitud,
        longitud: punto.longitud,
        // El parametro se llama radioMetros: con otro nombre la API responde 400.
        radioMetros: Math.min(radioM, RADIO_MAXIMO_CERCANOS_M),
        tipoId,
      },
    });
  } catch (e) {
    if (esErrorServicio(e) && e.reintentable) {
      return leerCercanos(punto, radioM, tipoId);
    }
    throw e;
  }
}

/**
 * El vecino se suma a un reporte existente en vez de crear otro.
 *
 * SUPUESTO S-13 (responde P-04): ademas de subir el contador, crea una Adhesion propia
 * para saber quien se sumo y para poder rechazar que el mismo vecino sume dos veces. El
 * reporte se muta en el mock (no se devuelve una copia suelta): es el mismo criterio que
 * ya usa crearReporte ("el mock tiene que comportarse como un servidor: lo que crea, queda").
 */
export async function adherirseAReporte(reporteId: string, usuarioId: string): Promise<Reporte> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    const reporte = REPORTES.find((r) => r.id === reporteId);
    if (!reporte) {
      throw new ErrorServicio(CODIGOS.NO_ENCONTRADO, 'No encontramos ese reporte.');
    }
    const repetida = ADHESIONES.some(
      (a) => a.reporteId === reporteId && a.usuarioId === usuarioId,
    );
    if (repetida) {
      throw new ErrorServicio(CODIGOS.YA_ADHERIDO, 'Ya te sumaste a este reclamo.');
    }
    const adhesion: Adhesion = {
      id: `adh-${nuevoUuid().slice(0, 8)}`,
      reporteId,
      usuarioId,
      fechaHora: ahoraIso(),
    };
    ADHESIONES.push(adhesion);
    reporte.adhesiones += 1;
    return reporte;
  }
  return pedir<Reporte>(`/reportes/${reporteId}/adhesiones`, { metodo: 'POST' });
}

/** Si este vecino ya esta adherido a este reporte (para deshabilitar el boton "sumarme"). */
export async function yaAdherido(reporteId: string, usuarioId: string): Promise<boolean> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    return ADHESIONES.some((a) => a.reporteId === reporteId && a.usuarioId === usuarioId);
  }
  // La API no trae "yaAdherido" en el reporte: se mira en GET /yo/adhesiones. Si falla, se
  // asume que no: el peor caso es que el boton "sumarme" quede habilitado, y la API responde
  // 200 sin duplicar si el vecino ya estaba sumado.
  try {
    const sumados = await misAdhesiones(usuarioId);
    return sumados.some((r) => r.id === reporteId);
  } catch {
    return false;
  }
}

/** Reportes de OTROS vecinos a los que este vecino se sumo ("me pasa lo mismo"). */
export async function misAdhesiones(usuarioId: string): Promise<Reporte[]> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    const idsSumados = new Set(
      ADHESIONES.filter((a) => a.usuarioId === usuarioId).map((a) => a.reporteId),
    );
    return ordenarNuevosPrimero(REPORTES.filter((r) => idsSumados.has(r.id)));
  }
  try {
    // Endpoint agregado por el grupo a la API (issue "Agregar GET /yo/adhesiones").
    const { datos } = await pedirCompleto<Reporte[]>('/yo/adhesiones', {
      parametros: { porPagina: POR_PAGINA_LISTA },
    });
    await guardarReportes(datos).catch(() => undefined);
    return datos;
  } catch (e) {
    const error = comoErrorServicio(e);
    if (error.codigo === CODIGOS.SIN_CONEXION || error.codigo === CODIGOS.TIEMPO_AGOTADO) {
      return [];
    }
    throw error;
  }
}

export interface CambioSolicitado {
  estado: EstadoReporte;
  comentario: string | null;
  cuadrillaId?: string | null;
}

/**
 * Cambio de estado (solo operador).
 *
 * Validacion del PRD hecha cumplir aca y no solo en la pantalla: "un reclamo rechazado
 * tiene que decir por que".
 */
export async function cambiarEstado(
  reporteId: string,
  cambio: CambioSolicitado,
): Promise<Reporte> {
  const comentario = cambio.comentario?.trim() || null;
  if (cambio.estado === 'rechazado' && !comentario) {
    throw new ErrorServicio(
      'MOTIVO_REQUERIDO',
      'Un reporte rechazado tiene que decir por que. Escribi el motivo.',
    );
  }
  if (cambio.estado === 'asignado' && !cambio.cuadrillaId) {
    throw new ErrorServicio(
      'CUADRILLA_REQUERIDA',
      'Para asignar el reporte hay que elegir una cuadrilla.',
    );
  }

  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    const reporte = REPORTES.find((r) => r.id === reporteId);
    if (!reporte) throw new ErrorServicio(CODIGOS.NO_ENCONTRADO, 'No encontramos ese reporte.');
    // El mock se comporta como el servidor: lo que cambia, queda (y queda en el historial).
    reporte.estado = cambio.estado;
    if (cambio.estado === 'asignado') reporte.cuadrillaId = cambio.cuadrillaId ?? null;
    const usuario = await preferencias.leerUsuario();
    CAMBIOS_DE_ESTADO.push({
      id: `cam-${nuevoUuid().slice(0, 6)}`,
      reporteId,
      estado: cambio.estado,
      comentario,
      operadorId: usuario?.id ?? null,
      fechaHora: ahoraIso(),
    });
    return reporte;
  }

  // La API separa los dos caminos: "asignado" solo se alcanza eligiendo una cuadrilla. En los
  // dos devuelve el Reporte actualizado; el CambioDeEstado queda en GET /reportes/:id/cambios.
  const actualizado =
    cambio.estado === 'asignado' && cambio.cuadrillaId
      ? await pedir<Reporte>(`/reportes/${reporteId}/cuadrilla`, {
          metodo: 'PATCH',
          cuerpo: { cuadrillaId: cambio.cuadrillaId, comentario },
        })
      : await pedir<Reporte>(`/reportes/${reporteId}/estado`, {
          metodo: 'PATCH',
          cuerpo: { estado: cambio.estado, comentario },
        });
  await guardarReportes([actualizado]).catch(() => undefined);
  return actualizado;
}

/**
 * Sube la foto del arreglo al cerrar el reporte (solo operador).
 * PRD: "Cuando lo resolvemos, quiero poder subir una foto del arreglo. Es lo que mas nos
 * van a agradecer."
 */
export async function subirFotoDeArreglo(reporteId: string, uriLocal: string): Promise<Reporte> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    const reporte = REPORTES.find((r) => r.id === reporteId);
    if (!reporte) throw new ErrorServicio(CODIGOS.NO_ENCONTRADO, 'No encontramos ese reporte.');
    return {
      ...reporte,
      fotos: [
        ...reporte.fotos,
        { id: `fot-${nuevoUuid().slice(0, 6)}`, url: uriLocal, momento: 'arreglo' },
      ],
    };
  }

  // 1. Subir a /archivos
  const formulario = new FormData();
  formulario.append('archivo', parteDeArchivo(uriLocal));

  const subido = await pedir<{ url: string }>('/archivos', {
    metodo: 'POST',
    formulario,
  });

  // 2. Asociar al reporte
  return pedir<Reporte>(`/reportes/${reporteId}/fotos`, {
    metodo: 'POST',
    cuerpo: { url: subido.url },
  });
}

/**
 * Corrige la zona de un reporte (solo operador). Endpoint agregado por el grupo a la API
 * (PATCH /reportes/:id/zona): si la cuadrilla asignada es de otra zona, el servidor la suelta
 * y deja un cambio de estado que lo explica.
 */
export async function corregirZona(
  reporteId: string,
  zonaId: string,
  comentario: string | null = null,
): Promise<Reporte> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    const reporte = REPORTES.find((r) => r.id === reporteId);
    if (!reporte) throw new ErrorServicio(CODIGOS.NO_ENCONTRADO, 'No encontramos ese reporte.');
    reporte.zonaId = zonaId;
    return reporte;
  }
  const reporte = await pedir<Reporte>(`/reportes/${reporteId}/zona`, {
    metodo: 'PATCH',
    cuerpo: { zonaId, comentario: comentario?.trim() || null },
  });
  await guardarReportes([reporte]).catch(() => undefined);
  return reporte;
}

/**
 * Marca un reporte como duplicado de otro (solo operador).
 *
 * Comportamiento resuelto en el foro (P-07): el duplicado (A) pasa a "rechazado" con un
 * comentario que referencia al original (B) — no queda en limbo ni se borra, pero deja de
 * ser un reclamo vigente aparte. El original (B) suma la adhesion de A, porque es el mismo
 * problema contado dos veces. El mapa publico deja de listar a A de forma independiente
 * (ver app/(vecino)/mapa.tsx); la bandeja del operador si lo sigue mostrando, con un enlace
 * a B, porque el operador necesita poder auditar como quedo cada marcado.
 *
 * El aviso al autor de A sale solo, por el mismo camino que cualquier otro cambio de
 * estado (sincronizacion.ts -> avisarCambiosDetectados), que ya detecta que el estado de A
 * cambio a "rechazado" y lo nota especial por tener duplicadoDe (ver notificaciones.ts).
 * No hace falta una notificacion aparte ni suscribir a A a los cambios futuros de B.
 */
export async function marcarDuplicado(
  reporteId: string,
  duplicadoDe: string,
): Promise<Reporte> {
  if (reporteId === duplicadoDe) {
    throw new ErrorServicio(
      CODIGOS.DESCONOCIDO,
      'Un reporte no puede ser duplicado de si mismo.',
    );
  }
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    const reporte = REPORTES.find((r) => r.id === reporteId);
    if (!reporte) throw new ErrorServicio(CODIGOS.NO_ENCONTRADO, 'No encontramos ese reporte.');
    const original = REPORTES.find((r) => r.id === duplicadoDe);
    if (!original) {
      throw new ErrorServicio(
        CODIGOS.NO_ENCONTRADO,
        'No encontramos el reporte original. Revisá el id.',
      );
    }

    const comentario = `Es el mismo problema que ${original.codigo}. Lo sumamos a ese reclamo y dejamos de listar este por separado; las novedades las vas a ver en ${original.codigo}.`;

    // Se muta en el mock, no se devuelve una copia suelta: mismo criterio que crearReporte
    // y adherirseAReporte ("lo que cambia, queda").
    reporte.duplicadoDe = duplicadoDe;
    reporte.estado = 'rechazado';
    original.adhesiones += 1;

    CAMBIOS_DE_ESTADO.push({
      id: `cam-${nuevoUuid().slice(0, 6)}`,
      reporteId,
      estado: 'rechazado',
      comentario,
      operadorId: 'usr-003',
      fechaHora: ahoraIso(),
    });

    return reporte;
  }
  return pedir<Reporte>(`/reportes/${reporteId}/duplicado`, {
    metodo: 'POST',
    cuerpo: { originalId: duplicadoDe },
  });
}