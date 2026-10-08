import type { Zona } from '../tipos';

/**
 * SUPUESTO (README, S-06): los limites reales los tiene la Municipalidad. Hasta que los
 * manden, se usan cuatro franjas de latitud sobre el ejido de Gualeguaychu. Sirven para
 * probar el calculo de zona; no son los limites verdaderos.
 *
 * Los poligonos vienen ABIERTOS a proposito (el ultimo punto no repite al primero) para
 * ejercitar el cierre automatico de puntoEnPoligono.
 */
const LON_OESTE = -58.58;
const LON_ESTE = -58.46;

const franja = (latNorte: number, latSur: number) => [
  { latitud: latNorte, longitud: LON_OESTE },
  { latitud: latNorte, longitud: LON_ESTE },
  { latitud: latSur, longitud: LON_ESTE },
  { latitud: latSur, longitud: LON_OESTE },
];

export const ZONAS: Zona[] = [
  { id: 'zon-norte', nombre: 'Zona Norte', referente: 'Corralon Norte', limite: franja(-32.96, -32.99) },
  { id: 'zon-centro', nombre: 'Zona Centro', referente: 'Corralon Central', limite: franja(-32.99, -33.015) },
  { id: 'zon-sur', nombre: 'Zona Sur', referente: 'Corralon Sur', limite: franja(-33.015, -33.04) },
  { id: 'zon-costanera', nombre: 'Zona Costanera', referente: 'Deposito Costanera', limite: franja(-33.04, -33.07) },
];
