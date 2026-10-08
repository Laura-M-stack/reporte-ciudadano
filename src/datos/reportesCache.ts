/**
 * Copia local de lo ultimo que trajo la API. Dos requisitos dependen de esto:
 *  - "La app tiene que abrir y mostrar algo sin conexion" (consigna 7).
 *  - Detectar duplicados a 50 m cuando el vecino esta parado en un barrio sin senal.
 *
 * Guardamos el JSON completo del reporte y ademas desnormalizamos lat/lon/tipo/estado en
 * columnas, para poder filtrar por caja envolvente en SQL antes de calcular Haversine en JS.
 */
import { CODIGOS, comoErrorServicio } from '../errores';
import type { CambioDeEstado, Coordenadas, Cuadrilla, Reporte, Zona } from '../tipos';
import { ahoraIso } from '../utils/fechas';
import { distanciaEnMetros } from '../utils/geo';

import { obtenerBase } from './db';

/** 1 grado de latitud ~ 111,32 km. Alcanza para armar una caja de busqueda holgada. */
const METROS_POR_GRADO_LAT = 111_320;

export async function guardarReportes(reportes: Reporte[]): Promise<void> {
  if (reportes.length === 0) return;
  try {
    const db = await obtenerBase();
    const guardadoEn = ahoraIso();
    await db.withTransactionAsync(async () => {
      for (const r of reportes) {
        await db.runAsync(
          `INSERT OR REPLACE INTO reportes_cache
             (id, datos, latitud, longitud, tipo_id, estado, autor_id, creado_en, guardado_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.id,
            JSON.stringify(r),
            r.coordenadas.latitud,
            r.coordenadas.longitud,
            r.tipoId,
            r.estado,
            r.autorId,
            r.creadoEn,
            guardadoEn,
          ],
        );
      }
    });
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudo guardar la copia local.');
  }
}

export async function leerReportes(filtro?: {
  autorId?: string;
  limite?: number;
}): Promise<Reporte[]> {
  try {
    const db = await obtenerBase();
    const limite = filtro?.limite ?? 200;
    const filas = filtro?.autorId
      ? await db.getAllAsync<{ datos: string }>(
          'SELECT datos FROM reportes_cache WHERE autor_id = ? ORDER BY creado_en DESC LIMIT ?',
          [filtro.autorId, limite],
        )
      : await db.getAllAsync<{ datos: string }>(
          'SELECT datos FROM reportes_cache ORDER BY creado_en DESC LIMIT ?',
          [limite],
        );
    return filas.map((f) => JSON.parse(f.datos) as Reporte);
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudo leer la copia local.');
  }
}

export async function leerReporte(id: string): Promise<Reporte | null> {
  try {
    const db = await obtenerBase();
    const fila = await db.getFirstAsync<{ datos: string }>(
      'SELECT datos FROM reportes_cache WHERE id = ?',
      [id],
    );
    return fila ? (JSON.parse(fila.datos) as Reporte) : null;
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudo leer la copia local.');
  }
}

/**
 * Reportes cacheados dentro de un radio. Prefiltra con una caja en SQL y despues afina con
 * Haversine en JS (la caja sobra un poco a proposito: mejor traer de mas que perder uno).
 */
export async function leerCercanos(
  punto: Coordenadas,
  radioM: number,
  tipoId?: string,
): Promise<Reporte[]> {
  try {
    const db = await obtenerBase();
    const deltaLat = radioM / METROS_POR_GRADO_LAT;
    const cosLat = Math.max(0.01, Math.cos((punto.latitud * Math.PI) / 180));
    const deltaLon = deltaLat / cosLat;

    const parametros: (string | number)[] = [
      punto.latitud - deltaLat,
      punto.latitud + deltaLat,
      punto.longitud - deltaLon,
      punto.longitud + deltaLon,
    ];
    let sql =
      'SELECT datos FROM reportes_cache WHERE latitud BETWEEN ? AND ? AND longitud BETWEEN ? AND ?';
    if (tipoId) {
      sql += ' AND tipo_id = ?';
      parametros.push(tipoId);
    }

    const filas = await db.getAllAsync<{ datos: string }>(sql, parametros);
    return filas
      .map((f) => JSON.parse(f.datos) as Reporte)
      .filter((r) => distanciaEnMetros(punto, r.coordenadas) <= radioM);
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudo buscar reportes cercanos.');
  }
}

export async function guardarCambios(cambios: CambioDeEstado[]): Promise<void> {
  if (cambios.length === 0) return;
  try {
    const db = await obtenerBase();
    await db.withTransactionAsync(async () => {
      for (const c of cambios) {
        await db.runAsync(
          `INSERT OR REPLACE INTO cambios_estado_cache (id, reporte_id, fecha_hora, datos)
           VALUES (?, ?, ?, ?)`,
          [c.id, c.reporteId, c.fechaHora, JSON.stringify(c)],
        );
      }
    });
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudo guardar el historial.');
  }
}

export async function leerCambios(reporteId: string): Promise<CambioDeEstado[]> {
  try {
    const db = await obtenerBase();
    const filas = await db.getAllAsync<{ datos: string }>(
      'SELECT datos FROM cambios_estado_cache WHERE reporte_id = ? ORDER BY fecha_hora ASC',
      [reporteId],
    );
    return filas.map((f) => JSON.parse(f.datos) as CambioDeEstado);
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudo leer el historial.');
  }
}

export async function guardarZonas(zonas: Zona[]): Promise<void> {
  if (zonas.length === 0) return;
  try {
    const db = await obtenerBase();
    await db.withTransactionAsync(async () => {
      for (const z of zonas) {
        await db.runAsync('INSERT OR REPLACE INTO zonas_cache (id, datos) VALUES (?, ?)', [
          z.id,
          JSON.stringify(z),
        ]);
      }
    });
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudieron guardar las zonas.');
  }
}

export async function leerZonas(): Promise<Zona[]> {
  try {
    const db = await obtenerBase();
    const filas = await db.getAllAsync<{ datos: string }>('SELECT datos FROM zonas_cache');
    return filas.map((f) => JSON.parse(f.datos) as Zona);
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudieron leer las zonas.');
  }
}

export async function guardarCuadrillas(cuadrillas: Cuadrilla[]): Promise<void> {
  if (cuadrillas.length === 0) return;
  try {
    const db = await obtenerBase();
    await db.withTransactionAsync(async () => {
      for (const c of cuadrillas) {
        await db.runAsync(
          'INSERT OR REPLACE INTO cuadrillas_cache (id, zona_id, datos) VALUES (?, ?, ?)',
          [c.id, c.zonaId, JSON.stringify(c)],
        );
      }
    });
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudieron guardar las cuadrillas.');
  }
}

export async function leerCuadrillas(zonaId?: string): Promise<Cuadrilla[]> {
  try {
    const db = await obtenerBase();
    const filas = zonaId
      ? await db.getAllAsync<{ datos: string }>(
          'SELECT datos FROM cuadrillas_cache WHERE zona_id = ?',
          [zonaId],
        )
      : await db.getAllAsync<{ datos: string }>('SELECT datos FROM cuadrillas_cache');
    return filas.map((f) => JSON.parse(f.datos) as Cuadrilla);
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_BASE_DATOS, 'No se pudieron leer las cuadrillas.');
  }
}
