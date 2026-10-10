import type { Coordenadas } from './reporte';

export interface Zona {
  id: string;
  nombre: string;
  /**
   * Poligono que la delimita, en orden. SUPUESTO (README, S-04): el poligono puede venir
   * abierto (el ultimo punto distinto del primero); puntoEnPoligono lo cierra solo.
   */
  limite: Coordenadas[];
  referente: string;
}

/**
 * SUPUESTO S-14 (ver README, responde P-06): id que usa un reporte cuando el punto no cae
 * dentro de ninguna zona ni lo bastante cerca de una (el rio, una ruta fuera del ejido, un
 * error grosero de GPS). No es el id de una Zona real de la lista: no tiene poligono ni
 * referente, y por eso no aparece entre los chips de filtro de zona. El reporte se guarda
 * igual (el PRD no admite que un reclamo se pierda por esto) y el operador lo reasigna a
 * mano desde la bandeja cuando lo revisa.
 */
export const ID_FUERA_DE_ZONA = 'fuera-de-zona';

/** Etiqueta visible para ID_FUERA_DE_ZONA, para no repetir el texto en cada pantalla. */
export const ETIQUETA_FUERA_DE_ZONA = 'Fuera de zona';
