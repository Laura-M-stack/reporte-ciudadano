import { ErrorServicio, CODIGOS } from '../../errores';
import type { Coordenadas, Reporte, Zona } from '../../tipos';
import {
  RADIO_TIERRA_M,
  RADIO_DUPLICADOS_M,
  cajaEnvolvente,
  distanciaEnMetros,
  estanACercaDe,
  formatearDistancia,
  puntoEnPoligono,
  reportesCercanos,
  sonCoordenadasValidas,
  zonaDePunto,
  zonaIdDePunto,
} from '../geo';

/** Metros que mide un grado de latitud con el radio que usamos. Sirve de patron. */
const METROS_POR_GRADO_LAT = (Math.PI * RADIO_TIERRA_M) / 180; // ~111.195 m

const c = (latitud: number, longitud: number): Coordenadas => ({ latitud, longitud });

/** Reporte minimo para los tests: solo importan coordenadas y tipoId. */
function reporteEn(id: string, coordenadas: Coordenadas, tipoId = 'tip-bache'): Reporte {
  return {
    id,
    codigo: `GCHU-2026-${id}`,
    tipoId,
    descripcion: null,
    audioUrl: null,
    fotos: [{ id: `fot-${id}`, url: 'https://x/f.jpg', momento: 'problema' }],
    coordenadas,
    direccion: 'Calle 1',
    zonaId: 'zon-norte',
    estado: 'recibido',
    autorId: 'usr-001',
    cuadrillaId: null,
    duplicadoDe: null,
    adhesiones: 0,
    creadoEn: '2026-09-14T10:22:00-03:00',
    sincronizado: true,
  };
}

describe('distanciaEnMetros (Haversine)', () => {
  it('devuelve 0 para el mismo punto', () => {
    expect(distanciaEnMetros(c(-33.0089, -58.5142), c(-33.0089, -58.5142))).toBe(0);
  });

  it('un grado de latitud son ~111.195 m (patron analitico)', () => {
    expect(distanciaEnMetros(c(0, 0), c(1, 0))).toBeCloseTo(METROS_POR_GRADO_LAT, 3);
  });

  it('un grado de longitud sobre el ecuador mide lo mismo que uno de latitud', () => {
    expect(distanciaEnMetros(c(0, 0), c(0, 1))).toBeCloseTo(METROS_POR_GRADO_LAT, 3);
  });

  it('un grado de longitud a 60 de latitud mide aproximadamente la mitad (cos 60 = 0,5)', () => {
    // El arco de circulo maximo entre dos puntos del mismo paralelo es un poco mas corto
    // que el arco del paralelo, por eso la tolerancia de +-5 m y no de centimetros.
    expect(distanciaEnMetros(c(60, 0), c(60, 1))).toBeCloseTo(METROS_POR_GRADO_LAT / 2, -1);
  });

  it('es simetrica', () => {
    const a = c(-33.0089, -58.5142);
    const b = c(-33.01, -58.52);
    expect(distanciaEnMetros(a, b)).toBeCloseTo(distanciaEnMetros(b, a), 9);
  });

  it('antipodas: media vuelta al planeta, sin NaN por redondeo', () => {
    const d = distanciaEnMetros(c(0, 0), c(0, 180));
    expect(d).toBeCloseTo(Math.PI * RADIO_TIERRA_M, 0);
    expect(Number.isNaN(d)).toBe(false);
  });

  it('cruzar el antimeridiano toma el camino corto, no la vuelta larga', () => {
    // 179.9 E y 179.9 W estan a 0,2 grados de distancia, no a 359,8.
    const d = distanciaEnMetros(c(0, 179.9), c(0, -179.9));
    expect(d).toBeCloseTo(0.2 * METROS_POR_GRADO_LAT, 0);
  });

  it('funciona en los polos', () => {
    // Dos longitudes distintas en el polo norte son el mismo punto.
    expect(distanciaEnMetros(c(90, 0), c(90, 120))).toBeCloseTo(0, 6);
  });

  it('50 m calculados a mano dan 50 m', () => {
    const base = c(-33.0089, -58.5142);
    const cincuentaMetrosAlNorte = c(base.latitud + 50 / METROS_POR_GRADO_LAT, base.longitud);
    expect(distanciaEnMetros(base, cincuentaMetrosAlNorte)).toBeCloseTo(50, 2);
  });

  it('rechaza coordenadas fuera de rango con ErrorServicio tipado', () => {
    expect.assertions(3);
    try {
      distanciaEnMetros(c(91, 0), c(0, 0));
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorServicio);
      expect((e as ErrorServicio).codigo).toBe(CODIGOS.COORDENADAS_INVALIDAS);
      expect((e as ErrorServicio).mensaje).toContain('Latitud');
    }
  });

  it('rechaza NaN', () => {
    expect(() => distanciaEnMetros(c(Number.NaN, 0), c(0, 0))).toThrow(ErrorServicio);
    expect(() => distanciaEnMetros(c(0, 0), c(0, Number.POSITIVE_INFINITY))).toThrow(ErrorServicio);
  });

  it('rechaza longitud fuera de rango', () => {
    expect(() => distanciaEnMetros(c(0, 0), c(0, 181))).toThrow(ErrorServicio);
  });
});

describe('estanACercaDe y el umbral de 50 m del PRD', () => {
  const base = c(-33.0089, -58.5142);
  const aCuarentaYNueve = c(base.latitud + 49 / METROS_POR_GRADO_LAT, base.longitud);
  const aCincuentaYUno = c(base.latitud + 51 / METROS_POR_GRADO_LAT, base.longitud);

  it('49 m entra', () => {
    expect(estanACercaDe(base, aCuarentaYNueve, RADIO_DUPLICADOS_M)).toBe(true);
  });

  it('51 m no entra', () => {
    expect(estanACercaDe(base, aCincuentaYUno, RADIO_DUPLICADOS_M)).toBe(false);
  });

  it('el borde exacto se considera dentro (<=)', () => {
    const aCincuenta = c(base.latitud + 50 / METROS_POR_GRADO_LAT, base.longitud);
    expect(distanciaEnMetros(base, aCincuenta)).toBeLessThanOrEqual(50.001);
    expect(estanACercaDe(base, aCincuenta, 50.001)).toBe(true);
  });
});

describe('sonCoordenadasValidas', () => {
  it.each([
    [c(0, 0), true],
    [c(-90, -180), true],
    [c(90, 180), true],
    [c(90.0001, 0), false],
    [c(0, -180.1), false],
    [c(Number.NaN, 0), false],
  ])('%o -> %s', (entrada, esperado) => {
    expect(sonCoordenadasValidas(entrada)).toBe(esperado);
  });

  it('null y undefined son invalidos', () => {
    expect(sonCoordenadasValidas(null)).toBe(false);
    expect(sonCoordenadasValidas(undefined)).toBe(false);
  });
});

describe('puntoEnPoligono (ray casting)', () => {
  // Cuadrado de 2x2 centrado en el origen. Vertices en orden antihorario, sin cerrar.
  const cuadrado: Coordenadas[] = [c(-1, -1), c(-1, 1), c(1, 1), c(1, -1)];
  // Mismo cuadrado, explicitamente cerrado.
  const cuadradoCerrado: Coordenadas[] = [...cuadrado, c(-1, -1)];
  // Poligono concavo en forma de C.
  const concavo: Coordenadas[] = [
    c(0, 0),
    c(0, 4),
    c(4, 4),
    c(4, 3),
    c(1, 3),
    c(1, 1),
    c(4, 1),
    c(4, 0),
  ];

  it('punto claramente adentro', () => {
    expect(puntoEnPoligono(c(0, 0), cuadrado)).toBe(true);
  });

  it('punto claramente afuera', () => {
    expect(puntoEnPoligono(c(5, 5), cuadrado)).toBe(false);
  });

  it('da igual que el poligono venga abierto o cerrado', () => {
    expect(puntoEnPoligono(c(0.5, 0.5), cuadrado)).toBe(
      puntoEnPoligono(c(0.5, 0.5), cuadradoCerrado),
    );
  });

  it('punto sobre un vertice cuenta como adentro', () => {
    expect(puntoEnPoligono(c(-1, -1), cuadrado)).toBe(true);
    expect(puntoEnPoligono(c(1, 1), cuadrado)).toBe(true);
  });

  it('punto sobre una arista cuenta como adentro', () => {
    expect(puntoEnPoligono(c(-1, 0), cuadrado)).toBe(true); // arista izquierda
    expect(puntoEnPoligono(c(0, 1), cuadrado)).toBe(true); // arista superior
  });

  it('punto a la altura de un vertice pero afuera no cuenta doble', () => {
    // Caso clasico que rompe las implementaciones ingenuas: el rayo pasa justo por un vertice.
    expect(puntoEnPoligono(c(1, 5), cuadrado)).toBe(false);
    expect(puntoEnPoligono(c(-1, -5), cuadrado)).toBe(false);
  });

  it('concavo: el hueco de la C queda afuera', () => {
    expect(puntoEnPoligono(c(0.5, 2), concavo)).toBe(true); // pared izquierda
    expect(puntoEnPoligono(c(2, 2), concavo)).toBe(false); // hueco
    expect(puntoEnPoligono(c(2, 3.5), concavo)).toBe(true); // brazo de arriba
    expect(puntoEnPoligono(c(2, 0.5), concavo)).toBe(true); // brazo de abajo
  });

  it('el sentido de los vertices (horario/antihorario) no cambia el resultado', () => {
    const horario = [...cuadrado].reverse();
    expect(puntoEnPoligono(c(0.2, -0.3), horario)).toBe(true);
    expect(puntoEnPoligono(c(9, 9), horario)).toBe(false);
  });

  it('poligono con menos de 3 vertices es un error tipado', () => {
    expect.assertions(2);
    try {
      puntoEnPoligono(c(0, 0), [c(0, 0), c(1, 1)]);
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorServicio);
      expect((e as ErrorServicio).codigo).toBe(CODIGOS.POLIGONO_INVALIDO);
    }
  });

  it('vertice invalido tambien es error tipado', () => {
    expect(() => puntoEnPoligono(c(0, 0), [c(0, 0), c(0, 1), c(999, 1)])).toThrow(ErrorServicio);
  });

  it('funciona con coordenadas reales de Gualeguaychu', () => {
    // Triangulo del ejemplo del PRD (Zona Norte).
    const zonaNorte: Coordenadas[] = [c(-32.99, -58.53), c(-32.99, -58.49), c(-33.02, -58.49)];
    expect(puntoEnPoligono(c(-33.0, -58.5), zonaNorte)).toBe(true);
    expect(puntoEnPoligono(c(-32.98, -58.5), zonaNorte)).toBe(false);
  });
});

describe('cajaEnvolvente', () => {
  it('calcula los extremos', () => {
    const caja = cajaEnvolvente([c(-1, -2), c(3, 4), c(0, 10)]);
    expect(caja).toEqual({ latMin: -1, latMax: 3, lonMin: -2, lonMax: 10 });
  });

  it('poligono vacio es error tipado', () => {
    expect(() => cajaEnvolvente([])).toThrow(ErrorServicio);
  });
});

describe('zonaDePunto', () => {
  const zonas: Zona[] = [
    {
      id: 'zon-norte',
      nombre: 'Zona Norte',
      referente: 'Corralon Norte',
      limite: [c(-33.0, -58.55), c(-33.0, -58.5), c(-32.95, -58.5), c(-32.95, -58.55)],
    },
    {
      id: 'zon-sur',
      nombre: 'Zona Sur',
      referente: 'Corralon Sur',
      limite: [c(-33.05, -58.55), c(-33.05, -58.5), c(-33.0, -58.5), c(-33.0, -58.55)],
    },
  ];

  it('encuentra la zona que contiene al punto', () => {
    expect(zonaDePunto(c(-32.97, -58.52), zonas)?.id).toBe('zon-norte');
    expect(zonaDePunto(c(-33.03, -58.52), zonas)?.id).toBe('zon-sur');
  });

  it('devuelve null si el punto cae fuera de todas las zonas (S-05)', () => {
    expect(zonaDePunto(c(-34.6, -58.38), zonas)).toBeNull();
  });

  it('zonaIdDePunto devuelve solo el id o null', () => {
    expect(zonaIdDePunto(c(-32.97, -58.52), zonas)).toBe('zon-norte');
    expect(zonaIdDePunto(c(0, 0), zonas)).toBeNull();
  });

  it('ignora zonas con poligono invalido en vez de romper', () => {
    const conBasura: Zona[] = [
      { id: 'zon-rota', nombre: 'Rota', referente: '-', limite: [c(0, 0)] },
      ...zonas,
    ];
    expect(zonaDePunto(c(-32.97, -58.52), conBasura)?.id).toBe('zon-norte');
  });

  it('sin zonas devuelve null', () => {
    expect(zonaDePunto(c(-32.97, -58.52), [])).toBeNull();
  });
});

describe('reportesCercanos (los 50 m del PRD)', () => {
  const base = c(-33.0089, -58.5142);
  const cerca = c(base.latitud + 20 / METROS_POR_GRADO_LAT, base.longitud);
  const masCerca = c(base.latitud + 5 / METROS_POR_GRADO_LAT, base.longitud);
  const lejos = c(base.latitud + 300 / METROS_POR_GRADO_LAT, base.longitud);

  const reportes = [
    reporteEn('rep-1', cerca),
    reporteEn('rep-2', lejos),
    reporteEn('rep-3', masCerca, 'tip-luminaria'),
  ];

  it('devuelve solo los que estan dentro del radio, del mas cercano al mas lejano', () => {
    const cercanos = reportesCercanos(base, reportes);
    expect(cercanos.map((r) => r.reporte.id)).toEqual(['rep-3', 'rep-1']);
    expect(cercanos[0]!.distanciaM).toBeLessThan(cercanos[1]!.distanciaM);
  });

  it('puede filtrar por tipo de problema (P-03)', () => {
    const cercanos = reportesCercanos(base, reportes, RADIO_DUPLICADOS_M, 'tip-bache');
    expect(cercanos.map((r) => r.reporte.id)).toEqual(['rep-1']);
  });

  it('lista vacia devuelve vacio', () => {
    expect(reportesCercanos(base, [])).toEqual([]);
  });

  it('descarta reportes con coordenadas corruptas en vez de romper la pantalla', () => {
    const roto = reporteEn('rep-roto', { latitud: 999, longitud: 0 });
    expect(reportesCercanos(base, [roto, reporteEn('rep-ok', cerca)])).toHaveLength(1);
  });

  it('respeta un radio custom', () => {
    expect(reportesCercanos(base, reportes, 400)).toHaveLength(3);
  });
});

describe('formatearDistancia', () => {
  it.each([
    [12, 'a 12 m'],
    [0, 'a 0 m'],
    [999, 'a 999 m'],
    [1000, 'a 1,0 km'],
    [1234, 'a 1,2 km'],
  ])('%s m -> %s', (metros, esperado) => {
    expect(formatearDistancia(metros)).toBe(esperado);
  });

  it('no rompe con valores no finitos', () => {
    expect(formatearDistancia(Number.NaN)).toBe('');
  });
});
