import { CODIGOS, ErrorServicio } from '../errores';
import { ID_FUERA_DE_ZONA } from '../tipos/zona';
import type { Coordenadas, EstadoReporte, Reporte, Zona } from '../tipos';

/** Radio medio de la Tierra (IUGG), en metros. */
export const RADIO_TIERRA_M = 6_371_008.8;

export const RADIO_DUPLICADOS_M = 50;

const gradosARadianes = (g: number): number => (g * Math.PI) / 180;

function validarCoordenadas(c: Coordenadas, contexto: string): void {
  const { latitud, longitud } = c ?? ({} as Coordenadas);
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
    throw new ErrorServicio(
      CODIGOS.COORDENADAS_INVALIDAS,
      `Coordenadas no numericas en ${contexto}.`,
      { detalles: { latitud, longitud } },
    );
  }
  if (latitud < -90 || latitud > 90) {
    throw new ErrorServicio(
      CODIGOS.COORDENADAS_INVALIDAS,
      `Latitud fuera de rango en ${contexto}: ${latitud}.`,
      { detalles: { latitud } },
    );
  }
  if (longitud < -180 || longitud > 180) {
    throw new ErrorServicio(
      CODIGOS.COORDENADAS_INVALIDAS,
      `Longitud fuera de rango en ${contexto}: ${longitud}.`,
      { detalles: { longitud } },
    );
  }
}

export function sonCoordenadasValidas(c: Coordenadas | null | undefined): c is Coordenadas {
  if (!c) return false;
  try {
    validarCoordenadas(c, 'validacion');
    return true;
  } catch {
    return false;
  }
}

/** Distancia entre dos coordenadas, en metros, mediante la fórmula de Haversine. */
export function distanciaEnMetros(a: Coordenadas, b: Coordenadas): number {
  validarCoordenadas(a, 'distanciaEnMetros(a)');
  validarCoordenadas(b, 'distanciaEnMetros(b)');

  const lat1 = gradosARadianes(a.latitud);
  const lat2 = gradosARadianes(b.latitud);
  const dLat = gradosARadianes(b.latitud - a.latitud);
  // La diferencia de longitud se normaliza para que cruzar el antimeridiano no de la vuelta larga.
  const dLon = gradosARadianes(normalizarDiferenciaLongitud(b.longitud - a.longitud));

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  // min(1, ...) evita NaN por error de punto flotante en antipodas.
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return RADIO_TIERRA_M * c;
}

/** Lleva una diferencia de longitud al rango (-180, 180]. */
function normalizarDiferenciaLongitud(delta: number): number {
  let d = delta;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

export function estanACercaDe(a: Coordenadas, b: Coordenadas, metros: number): boolean {
  return distanciaEnMetros(a, b) <= metros;
}

/** Comprueba si un punto cae dentro de un polígono mediante ray casting. */
export function puntoEnPoligono(punto: Coordenadas, poligono: Coordenadas[]): boolean {
  validarCoordenadas(punto, 'puntoEnPoligono(punto)');

  if (!Array.isArray(poligono) || poligono.length < 3) {
    throw new ErrorServicio(
      CODIGOS.POLIGONO_INVALIDO,
      'Un polígono necesita al menos 3 vertices.',
      { detalles: { vertices: Array.isArray(poligono) ? poligono.length : 0 } },
    );
  }
  poligono.forEach((v, i) => validarCoordenadas(v, `puntoEnPoligono(vertice ${i})`));

  const anillo = cerrarAnillo(poligono);
  const x = punto.longitud;
  const y = punto.latitud;

  // 1) Borde: vertice o arista. Se resuelve antes del ray casting porque el algoritmo
  //    de cruces es ambiguo justo sobre el borde.
  for (let i = 0; i < anillo.length - 1; i++) {
    const a = anillo[i]!;
    const b = anillo[i + 1]!;
    if (puntoEnSegmento(x, y, a.longitud, a.latitud, b.longitud, b.latitud)) return true;
  }

  // 2) Ray casting hacia la derecha (+x). Se cuenta cuantas aristas cruza.
  let dentro = false;
  for (let i = 0, j = anillo.length - 2; i < anillo.length - 1; j = i++) {
    const xi = anillo[i]!.longitud;
    const yi = anillo[i]!.latitud;
    const xj = anillo[j]!.longitud;
    const yj = anillo[j]!.latitud;

    const cruzaEnY = yi > y !== yj > y;
    if (cruzaEnY) {
      const xInterseccion = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (x < xInterseccion) dentro = !dentro;
    }
  }
  return dentro;
}

function cerrarAnillo(poligono: Coordenadas[]): Coordenadas[] {
  const primero = poligono[0]!;
  const ultimo = poligono[poligono.length - 1]!;
  const yaCerrado = primero.latitud === ultimo.latitud && primero.longitud === ultimo.longitud;
  return yaCerrado ? poligono : [...poligono, primero];
}

const EPSILON = 1e-12;

function puntoEnSegmento(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  // Producto cruz ~ 0 => colineales.
  const cruz = (px - ax) * (by - ay) - (py - ay) * (bx - ax);
  if (Math.abs(cruz) > EPSILON) return false;
  // Y ademas dentro de la caja del segmento.
  const dentroX = px >= Math.min(ax, bx) - EPSILON && px <= Math.max(ax, bx) + EPSILON;
  const dentroY = py >= Math.min(ay, by) - EPSILON && py <= Math.max(ay, by) + EPSILON;
  return dentroX && dentroY;
}

/** Caja envolvente de un poligono. Prefiltro barato antes del ray casting. */
export function cajaEnvolvente(poligono: Coordenadas[]): {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
} {
  if (!Array.isArray(poligono) || poligono.length === 0) {
    throw new ErrorServicio(CODIGOS.POLIGONO_INVALIDO, 'Polígono vacío.');
  }
  let latMin = Infinity;
  let latMax = -Infinity;
  let lonMin = Infinity;
  let lonMax = -Infinity;
  for (const v of poligono) {
    if (v.latitud < latMin) latMin = v.latitud;
    if (v.latitud > latMax) latMax = v.latitud;
    if (v.longitud < lonMin) lonMin = v.longitud;
    if (v.longitud > lonMax) lonMax = v.longitud;
  }
  return { latMin, latMax, lonMin, lonMax };
}

/**
 * Convierte coordenadas a metros en un plano local. La longitud se ajusta por latitud.
 */
function aPlanoMetros(punto: Coordenadas, referencia: Coordenadas): { x: number; y: number } {
  const metrosPorGradoLon = 111_320 * Math.cos(gradosARadianes(referencia.latitud));
  return {
    x: punto.longitud * metrosPorGradoLon,
    y: punto.latitud * 111_320,
  };
}

/** Distancia de un punto a un segmento, en metros, sobre el plano local de aPlanoMetros. */
function distanciaAPuntoSegmentoM(
  punto: Coordenadas,
  a: Coordenadas,
  b: Coordenadas,
): number {
  const p = aPlanoMetros(punto, punto);
  const pa = aPlanoMetros(a, punto);
  const pb = aPlanoMetros(b, punto);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const largoAlCuadrado = dx * dx + dy * dy;
  const t =
    largoAlCuadrado === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / largoAlCuadrado));
  const cx = pa.x + t * dx;
  const cy = pa.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

/** Distancia minima de un punto al borde de un poligono, en metros. */
function distanciaAPoligonoM(punto: Coordenadas, poligono: Coordenadas[]): number {
  const anillo = cerrarAnillo(poligono);
  let minimo = Infinity;
  for (let i = 0; i < anillo.length - 1; i++) {
    const d = distanciaAPuntoSegmentoM(punto, anillo[i]!, anillo[i + 1]!);
    if (d < minimo) minimo = d;
  }
  return minimo;
}

/** Distancia máxima para asignar la zona más cercana. */
export const UMBRAL_CERCANIA_ZONA_M = 120;

/**
 * Zona a la que pertenece un punto.
 *
 * Primero busca contencion exacta (ray casting). Si no cae dentro de ninguna, busca la
 * zona más cercana si está dentro de UMBRAL_CERCANIA_ZONA_M; de lo contrario devuelve null.
 *
 * Si las zonas se solaparan, gana la primera de la lista para la contencion exacta.
 */
export function zonaDePunto(punto: Coordenadas, zonas: Zona[]): Zona | null {
  validarCoordenadas(punto, 'zonaDePunto');

  for (const zona of zonas) {
    if (!zona.limite || zona.limite.length < 3) continue;
    const caja = cajaEnvolvente(zona.limite);
    if (
      punto.latitud < caja.latMin ||
      punto.latitud > caja.latMax ||
      punto.longitud < caja.lonMin ||
      punto.longitud > caja.lonMax
    ) {
      continue;
    }
    if (puntoEnPoligono(punto, zona.limite)) return zona;
  }

  let masCercana: Zona | null = null;
  let distanciaMinima = Infinity;
  for (const zona of zonas) {
    if (!zona.limite || zona.limite.length < 3) continue;
    const distancia = distanciaAPoligonoM(punto, zona.limite);
    if (distancia < distanciaMinima) {
      distanciaMinima = distancia;
      masCercana = zona;
    }
  }
  return masCercana && distanciaMinima <= UMBRAL_CERCANIA_ZONA_M ? masCercana : null;
}

/**
 * Devuelve el id de la zona o ID_FUERA_DE_ZONA si no hay una zona cercana.
 */
export function zonaIdDePunto(punto: Coordenadas, zonas: Zona[]): string {
  return zonaDePunto(punto, zonas)?.id ?? ID_FUERA_DE_ZONA;
}

export interface ReporteCercano {
  reporte: Reporte;
  distanciaM: number;
}

const ESTADOS_EXCLUIDOS_DE_DUPLICADOS: readonly EstadoReporte[] = ['resuelto', 'rechazado'];

/**
 * Reportes a menos de `radioM` del punto, del mas cercano al mas lejano.
 * Es lo que alimenta la pantalla "¿es este mismo problema?" antes de crear un reporte.
 *
 * Si se indica `soloTipoId`, solo compara reportes de ese tipo. Excluye los resueltos y rechazados.
 */
export function reportesCercanos(
  punto: Coordenadas,
  reportes: Reporte[],
  radioM: number = RADIO_DUPLICADOS_M,
  soloTipoId?: string,
): ReporteCercano[] {
  validarCoordenadas(punto, 'reportesCercanos');
  const cercanos: ReporteCercano[] = [];
  for (const reporte of reportes) {
    if (soloTipoId && reporte.tipoId !== soloTipoId) continue;
    if (ESTADOS_EXCLUIDOS_DE_DUPLICADOS.includes(reporte.estado)) continue;
    if (!sonCoordenadasValidas(reporte.coordenadas)) continue;
    const distanciaM = distanciaEnMetros(punto, reporte.coordenadas);
    if (distanciaM <= radioM) cercanos.push({ reporte, distanciaM });
  }
  return cercanos.sort((a, b) => a.distanciaM - b.distanciaM);
}

export function formatearDistancia(metros: number): string {
  if (!Number.isFinite(metros)) return '';
  if (metros < 1000) return `a ${Math.round(metros)} m`;
  return `a ${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}
