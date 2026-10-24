/**
 * Persistencia de la cola offline. Es la unica parte que sabe que la cola vive en SQLite.
 *
 * El servicio de cola (src/servicios/cola.ts) trabaja contra la interfaz RepositorioCola,
 * no contra esta implementacion. Gracias a eso la cola se testea con el repositorio en
 * memoria (colaEnMemoria.ts) sin levantar SQLite ni mockear expo-sqlite.
 */
import { CODIGOS, comoErrorServicio } from '../errores';
import type { BorradorReporte, EstadoEnvio, ReporteEnCola } from '../tipos';

import { obtenerBase } from './db';

export interface FiltroCola {
  /** Si se omite, devuelve todo. */
  estados?: EstadoEnvio[];
}

export interface RepositorioCola {
  insertar(item: ReporteEnCola): Promise<void>;
  /** Reemplaza la fila completa. Si no existe, no hace nada. */
  actualizar(item: ReporteEnCola): Promise<void>;
  obtener(idLocal: string): Promise<ReporteEnCola | null>;
  /** Del mas viejo al mas nuevo (orden de envio: primero lo que el vecino cargo antes). */
  listar(filtro?: FiltroCola): Promise<ReporteEnCola[]>;
  eliminar(idLocal: string): Promise<void>;
  /** Devuelve cuantas filas borro. */
  eliminarEnviadosAntesDe(iso: string): Promise<number>;
}

interface FilaCola {
  id_local: string;
  borrador: string;
  estado_envio: string;
  intentos: number;
  ultimo_error: string | null;
  creado_en: string;
  actualizado_en: string;
  id_remoto: string | null;
  codigo_remoto: string | null;
}

function aFila(item: ReporteEnCola): FilaCola {
  return {
    id_local: item.idLocal,
    borrador: JSON.stringify(item.borrador),
    estado_envio: item.estadoEnvio,
    intentos: item.intentos,
    ultimo_error: item.ultimoError ? JSON.stringify(item.ultimoError) : null,
    creado_en: item.creadoEn,
    actualizado_en: item.actualizadoEn,
    id_remoto: item.idRemoto,
    codigo_remoto: item.codigoRemoto,
  };
}

function aItem(fila: FilaCola): ReporteEnCola {
  return {
    idLocal: fila.id_local,
    borrador: JSON.parse(fila.borrador) as BorradorReporte,
    estadoEnvio: fila.estado_envio as EstadoEnvio,
    intentos: fila.intentos,
    ultimoError: fila.ultimo_error
      ? (JSON.parse(fila.ultimo_error) as { codigo: string; mensaje: string })
      : null,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
    idRemoto: fila.id_remoto,
    codigoRemoto: fila.codigo_remoto,
  };
}

export const repositorioColaSqlite: RepositorioCola = {
  async insertar(item) {
    try {
      const db = await obtenerBase();
      const f = aFila(item);
      await db.runAsync(
        `INSERT INTO cola_reportes
           (id_local, borrador, estado_envio, intentos, ultimo_error, creado_en, actualizado_en, id_remoto, codigo_remoto)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.id_local,
          f.borrador,
          f.estado_envio,
          f.intentos,
          f.ultimo_error,
          f.creado_en,
          f.actualizado_en,
          f.id_remoto,
          f.codigo_remoto,
        ],
      );
    } catch (e) {
      throw comoErrorServicio(
        e,
        CODIGOS.ERROR_BASE_DATOS,
        'No se pudo guardar el reporte en el teléfono.',
      );
    }
  },

  async actualizar(item) {
    try {
      const db = await obtenerBase();
      const f = aFila(item);
      await db.runAsync(
        `UPDATE cola_reportes SET
           borrador = ?, estado_envio = ?, intentos = ?, ultimo_error = ?,
           actualizado_en = ?, id_remoto = ?, codigo_remoto = ?
         WHERE id_local = ?`,
        [
          f.borrador,
          f.estado_envio,
          f.intentos,
          f.ultimo_error,
          f.actualizado_en,
          f.id_remoto,
          f.codigo_remoto,
          f.id_local,
        ],
      );
    } catch (e) {
      throw comoErrorServicio(
        e,
        CODIGOS.ERROR_BASE_DATOS,
        'No se pudo actualizar el reporte en la cola.',
      );
    }
  },

  async obtener(idLocal) {
    try {
      const db = await obtenerBase();
      const fila = await db.getFirstAsync<FilaCola>(
        'SELECT * FROM cola_reportes WHERE id_local = ?',
        [idLocal],
      );
      return fila ? aItem(fila) : null;
    } catch (e) {
      throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudo leer la cola.');
    }
  },

  async listar(filtro) {
    try {
      const db = await obtenerBase();
      const estados = filtro?.estados;
      if (!estados || estados.length === 0) {
        const filas = await db.getAllAsync<FilaCola>(
          'SELECT * FROM cola_reportes ORDER BY creado_en ASC',
        );
        return filas.map(aItem);
      }
      const huecos = estados.map(() => '?').join(', ');
      const filas = await db.getAllAsync<FilaCola>(
        `SELECT * FROM cola_reportes WHERE estado_envio IN (${huecos}) ORDER BY creado_en ASC`,
        estados,
      );
      return filas.map(aItem);
    } catch (e) {
      throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudo leer la cola.');
    }
  },

  async eliminar(idLocal) {
    try {
      const db = await obtenerBase();
      await db.runAsync('DELETE FROM cola_reportes WHERE id_local = ?', [idLocal]);
    } catch (e) {
      throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudo borrar el reporte de la cola.');
    }
  },

  async eliminarEnviadosAntesDe(iso) {
    try {
      const db = await obtenerBase();
      const resultado = await db.runAsync(
        "DELETE FROM cola_reportes WHERE estado_envio = 'enviado' AND actualizado_en < ?",
        [iso],
      );
      return resultado.changes ?? 0;
    } catch (e) {
      throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudo limpiar la cola.');
    }
  },
};
