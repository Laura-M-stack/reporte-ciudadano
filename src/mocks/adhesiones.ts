import type { Adhesion } from '../tipos';

/**
 * Datos falsos de adhesiones (S-13). Arranca vacío a propósito: los contadores
 * `Reporte.adhesiones` que ya traían los mocks (rep-00412: 3, rep-00421: 5, etc.) son
 * anteriores a esta entidad y no sabemos quién las hizo, así que no se inventan autores
 * para no mentir en los datos de prueba. A partir de ahora, cada "sumarme" nuevo desde la
 * app SÍ queda registrado acá (ver adherirseAReporte en servicios/reportes.ts), y por eso
 * el contador y esta lista van a volver a estar en sincronía después de un par de usos.
 */
export const ADHESIONES: Adhesion[] = [];
