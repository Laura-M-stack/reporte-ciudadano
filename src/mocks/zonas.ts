import type { Zona } from '../tipos';

/** Zonas de prueba aproximadas; sus límites no son los oficiales. */
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
  { id: 'zon-costanera', nombre: 'Zona Costanera', referente: 'Depósito Costanera', limite: franja(-33.04, -33.07) },
];
