/**
 * Sincronizacion en primer plano: trae los reportes del vecino, los compara con la copia
 * local y avisa por cada cambio.
 *
 * Esto es lo que hace que la notificacion local sea un hecho REAL de la app y no un boton
 * de prueba (requisito 6 de la catedra). El hecho es "el operador cambio el estado de mi
 * reclamo", que ocurre en el servidor; la app se entera al sincronizar y recien ahi notifica.
 *
 * Limite conocido, hablado con el cliente (P-05): sin push no hay aviso con la app cerrada.
 */
import { leerReportes } from '../datos/reportesCache';
import { preferencias } from '../datos/preferencias';
import { esErrorServicio } from '../errores';
import { ahoraIso } from '../utils';

import { avisarCambiosDetectados } from './notificaciones';
import { hayInternet } from './red';
import { listarMisReportes } from './reportes';

export interface ResultadoRefresco {
  revisados: number;
  avisos: number;
  /** false si no habia conexion: no es un error, simplemente no se pudo. */
  pudoConsultar: boolean;
}

/**
 * Compara lo que hay en el telefono con lo que dice el servidor y notifica las diferencias.
 *
 * El orden importa: primero leemos la copia local (lo que el vecino "ya sabe"), despues
 * pedimos lo nuevo. listarMisReportes actualiza la cache por dentro, asi que si lo
 * hicieramos al reves compararíamos contra los datos nuevos y no avisariamos nunca.
 */
export async function refrescarYAvisar(usuarioId: string): Promise<ResultadoRefresco> {
  if (!(await hayInternet())) {
    return { revisados: 0, avisos: 0, pudoConsultar: false };
  }

  try {
    const conocidos = await leerReportes({ autorId: usuarioId });
    const pagina = await listarMisReportes(usuarioId);

    const avisos = await avisarCambiosDetectados(conocidos, pagina.datos);
    await preferencias.guardarUltimaSincronizacion(ahoraIso());

    return { revisados: pagina.datos.length, avisos, pudoConsultar: true };
  } catch (e) {
    if (!esErrorServicio(e)) throw e;
    // Un fallo de sincronizacion en segundo plano no se le muestra al vecino.
    return { revisados: 0, avisos: 0, pudoConsultar: false };
  }
}
