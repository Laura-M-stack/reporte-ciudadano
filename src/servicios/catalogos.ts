/**
 * Catalogos: tipos de problema, zonas y cuadrillas.
 *
 * Se cachean en SQLite porque hacen falta sin conexion: sin los poligonos de las zonas no
 * se puede calcular el zonaId de un reporte creado offline, y sin los tipos no se puede
 * dibujar la grilla de "¿Que pasa?".
 */
import { comoErrorServicio } from '../errores';
import {
  guardarCuadrillas,
  guardarZonas,
  leerCuadrillas,
  leerZonas,
} from '../datos/reportesCache';
import { CUADRILLAS, DEMORA_MOCK_MS, TIPOS_DE_REPORTE, ZONAS, fallasSimuladas } from '../mocks';
import type { Cuadrilla, TipoDeReporte, Zona } from '../tipos';

import { demorar, hayApi, pedir } from './http';

export async function listarTiposDeReporte(): Promise<TipoDeReporte[]> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    return TIPOS_DE_REPORTE;
  }
  return pedir<TipoDeReporte[]>('/tipos-de-reporte');
}

/**
 * Zonas con sus poligonos. Si no hay red, devuelve las cacheadas; el calculo de zona
 * (puntoEnPoligono) es logica pura y funciona con lo que haya en el telefono.
 */
export async function listarZonas(): Promise<Zona[]> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    return ZONAS;
  }
  try {
    const zonas = await pedir<Zona[]>('/zonas');
    await guardarZonas(zonas).catch(() => undefined);
    return zonas;
  } catch (e) {
    const error = comoErrorServicio(e);
    if (error.reintentable) {
      const cacheadas = await leerZonas();
      if (cacheadas.length > 0) return cacheadas;
    }
    throw error;
  }
}

export async function listarCuadrillas(zonaId?: string): Promise<Cuadrilla[]> {
  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    return zonaId ? CUADRILLAS.filter((c) => c.zonaId === zonaId) : CUADRILLAS;
  }
  try {
    const cuadrillas = await pedir<Cuadrilla[]>('/cuadrillas', { parametros: { zonaId } });
    await guardarCuadrillas(cuadrillas).catch(() => undefined);
    return cuadrillas;
  } catch (e) {
    const error = comoErrorServicio(e);
    if (error.reintentable) {
      const cacheadas = await leerCuadrillas(zonaId);
      if (cacheadas.length > 0) return cacheadas;
    }
    throw error;
  }
}
