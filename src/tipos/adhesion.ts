/**
 * Adhesión de un vecino a un reporte existente ("me pasa lo mismo, sumarme").
 *
 * SUPUESTO S-13 (ver README, resuelto en el foro — P-04): `Reporte.adhesiones` sigue
 * existiendo como contador, porque la bandeja ordena por el numero ("cuantos mas vecinos
 * se suman, mas arriba va en la lista de Obras"). Pero el contador solo no alcanza para
 * saber QUIEN se sumo ni para evitar que el mismo vecino sume dos veces, que es lo que
 * señalo la catedra. Por eso esta entidad aparte, con la forma que ellos mismos sugirieron.
 */
export interface Adhesion {
  id: string;
  reporteId: string;
  usuarioId: string;
  fechaHora: string;
}
