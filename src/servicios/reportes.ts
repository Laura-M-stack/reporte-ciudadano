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
import { CODIGOS, ErrorServicio, comoErrorServicio, esErrorServicio } from '../errores';
import {
  guardarCambios,
  guardarReportes,
  leerCambios,
  leerCercanos,
  leerReporte,
  leerReportes,
} from '../datos/reportesCache';
import {
  CAMBIOS_DE_ESTADO,
  DEMORA_MOCK_MS,
  REPORTES,
  fallasSimuladas,
} from '../mocks';
import type {
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

function aParametros(filtros: FiltrosReporte = {}): Record<string, string | number | undefined> {
  return {
    estado: filtros.estado,
    tipoId: filtros.tipoId,
    zonaId: filtros.zonaId,
    autorId: filtros.autorId,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
  };
}

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
      parametros: aParametros(filtros),
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

/** Los reportes del vecino que entro. */
export function listarMisReportes(
  autorId: string,
  filtros: FiltrosReporte = {},
): Promise<Pagina<Reporte>> {
  return listarReportes({ ...filtros, autorId });
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
    const cambios = await pedir<CambioDeEstado[]>(`/reportes/${reporteId}/cambios`);
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
 * Sube un reporte. La llama el servicio de cola, NUNCA una pantalla: el vecino siempre
 * encola (aunque tenga señal), y la cola decide cuando subir. Asi hay un solo camino.
 *
 * `idLocal` viaja como clave de idempotencia: si se corta la red despues de que el
 * servidor guardo, el reintento no crea un duplicado (pendiente de confirmar, P-08).
 */
export async function crearReporte(
  borrador: BorradorReporte,
  idLocal: string,
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
    return reporteSimulado(borrador, idLocal);
  }

  const formulario = new FormData();
  formulario.append('tipoId', borrador.tipoId);
  formulario.append('descripcion', borrador.descripcion ?? '');
  formulario.append('latitud', String(borrador.coordenadas.latitud));
  formulario.append('longitud', String(borrador.coordenadas.longitud));
  formulario.append('direccion', borrador.direccion);
  if (borrador.zonaId) formulario.append('zonaId', borrador.zonaId);
  if (borrador.adhiereAReporteId) formulario.append('adhiereA', borrador.adhiereAReporteId);
  formulario.append('idLocal', idLocal);

  for (const adjunto of borrador.adjuntos) {
    formulario.append(adjunto.tipo === 'audio' ? 'audio' : 'fotos', {
      // React Native acepta este objeto como parte de un FormData multipart.
      uri: adjunto.uri,
      name: adjunto.uri.split('/').pop() ?? `${adjunto.id}.bin`,
      type: adjunto.tipo === 'audio' ? 'audio/m4a' : 'image/jpeg',
    } as unknown as Blob);
  }

  return pedir<Reporte>('/reportes', {
    metodo: 'POST',
    formulario,
    claveIdempotencia: idLocal,
  });
}

/** Reporte "como si" lo hubiera creado el servidor. Solo en modo mock. */
function reporteSimulado(borrador: BorradorReporte, idLocal: string): Reporte {
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
    // SUPUESTO S-05: si el punto cayo fuera de las 4 zonas, el reporte se envia igual y lo
    // clasifica el operador. El tipo del PRD no admite null, asi que va cadena vacia.
    zonaId: borrador.zonaId ?? '',
    estado: 'recibido',
    autorId: 'usr-084',
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
        radio: radioM,
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

/** El vecino se suma a un reporte existente en vez de crear otro. */
export async function adherirseAReporte(reporteId: string): Promise<Reporte> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    const reporte = REPORTES.find((r) => r.id === reporteId);
    if (!reporte) {
      throw new ErrorServicio(CODIGOS.NO_ENCONTRADO, 'No encontramos ese reporte.');
    }
    return { ...reporte, adhesiones: reporte.adhesiones + 1 };
  }
  return pedir<Reporte>(`/reportes/${reporteId}/adhesiones`, { metodo: 'POST' });
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
): Promise<CambioDeEstado> {
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
    return {
      id: `cam-${nuevoUuid().slice(0, 6)}`,
      reporteId,
      estado: cambio.estado,
      comentario,
      operadorId: 'usr-003',
      fechaHora: ahoraIso(),
    };
  }

  return pedir<CambioDeEstado>(`/reportes/${reporteId}/cambios`, {
    metodo: 'POST',
    cuerpo: { estado: cambio.estado, comentario, cuadrillaId: cambio.cuadrillaId ?? null },
  });
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

  const formulario = new FormData();
  formulario.append('momento', 'arreglo');
  formulario.append('foto', {
    uri: uriLocal,
    name: uriLocal.split('/').pop() ?? 'arreglo.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  return pedir<Reporte>(`/reportes/${reporteId}/fotos`, { metodo: 'POST', formulario });
}

/** Marca un reporte como duplicado de otro (solo operador). */
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
    return { ...reporte, duplicadoDe };
  }
  return pedir<Reporte>(`/reportes/${reporteId}/duplicado`, {
    metodo: 'PATCH',
    cuerpo: { duplicadoDe },
  });
}
