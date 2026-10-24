import type { Coordenadas } from './reporte';

export interface Zona {
  id: string;
  nombre: string;
  /** Polígono que delimita la zona. */
  limite: Coordenadas[];
  referente: string;
}

/** Id usado cuando un reporte no pertenece a ninguna zona. */
export const ID_FUERA_DE_ZONA = 'fuera-de-zona';

/** Etiqueta visible para ID_FUERA_DE_ZONA, para no repetir el texto en cada pantalla. */
export const ETIQUETA_FUERA_DE_ZONA = 'Fuera de zona';
