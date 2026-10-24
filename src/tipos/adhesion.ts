/** Adhesión de un vecino a un reporte existente. */
export interface Adhesion {
  id: string;
  reporteId: string;
  usuarioId: string;
  fechaHora: string;
}
