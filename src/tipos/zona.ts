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
