/**
 * Fechas. El PRD es explicito: las fechas viajan SIEMPRE como texto ISO 8601 con zona
 * ("2026-09-14T10:22:00-03:00"). Nunca un Date, nunca un numero. Este archivo es el unico
 * lugar donde se convierte de Date a texto y al reves.
 */

/** Ahora, en ISO 8601 con el offset del dispositivo (no en UTC: el PRD pide zona). */
export function ahoraIso(fecha: Date = new Date()): string {
  const dosDigitos = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const offsetMin = -fecha.getTimezoneOffset();
  const signo = offsetMin >= 0 ? '+' : '-';
  const offset = `${signo}${dosDigitos(offsetMin / 60)}:${dosDigitos(offsetMin % 60)}`;
  return (
    `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}` +
    `T${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}:${dosDigitos(fecha.getSeconds())}` +
    offset
  );
}

export function esIsoValido(texto: string): boolean {
  if (typeof texto !== 'string' || texto.length < 10) return false;
  const t = Date.parse(texto);
  return Number.isFinite(t);
}

/** "14/09" — el formato corto del historial en el mockup del PRD. */
export function formatearDiaMes(iso: string): string {
  if (!esIsoValido(iso)) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** "14/09/2026 10:22" */
export function formatearFechaHora(iso: string): string {
  if (!esIsoValido(iso)) return '';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatearDiaMes(iso)}/${d.getFullYear()} ${hh}:${mi}`;
}

/** "hace 3 días" — para la lista de reportes del vecino. */
export function tiempoRelativo(iso: string, referencia: Date = new Date()): string {
  if (!esIsoValido(iso)) return '';
  const ms = referencia.getTime() - new Date(iso).getTime();
  const minutos = Math.floor(ms / 60000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'hace un mes' : `hace ${meses} meses`;
}

/** Del mas nuevo al mas viejo (lo que pide el PRD para la lista del vecino). */
export function ordenarPorFechaDesc<T>(items: T[], obtenerIso: (item: T) => string): T[] {
  return [...items].sort((a, b) => Date.parse(obtenerIso(b)) - Date.parse(obtenerIso(a)));
}
