import {
  ahoraIso,
  esIsoValido,
  formatearDiaMes,
  formatearFechaHora,
  ordenarPorFechaDesc,
  tiempoRelativo,
} from '../fechas';

/**
 * Los tests no dependen de la zona horaria de la maquina: se construyen fechas locales
 * con `new Date(anio, mes, dia, ...)` y se comparan contra el texto que produce ahoraIso.
 * Asi corren igual en la notebook de cualquiera del equipo y en el CI.
 */
const local = (a: number, m: number, d: number, h = 0, mi = 0, s = 0) => new Date(a, m - 1, d, h, mi, s);

describe('ahoraIso', () => {
  it('tiene forma ISO 8601 con offset, no con Z', () => {
    expect(ahoraIso(local(2026, 9, 14, 10, 22, 0))).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
    );
  });

  it('rellena con ceros los meses, dias y horas de un digito', () => {
    expect(ahoraIso(local(2026, 1, 5, 9, 7, 3))).toContain('2026-01-05T09:07:03');
  });

  it('el texto se puede volver a parsear al mismo instante', () => {
    const d = local(2026, 9, 14, 10, 22, 0);
    expect(Date.parse(ahoraIso(d))).toBe(d.getTime());
  });

  it('cruza bien fin de ano', () => {
    expect(ahoraIso(local(2026, 12, 31, 23, 59, 59))).toContain('2026-12-31T23:59:59');
  });
});

describe('esIsoValido', () => {
  it.each([
    ['2026-09-14T10:22:00-03:00', true],
    ['2026-09-14', true],
    ['', false],
    ['ayer', false],
    ['14/09/2026', false],
  ])('%s -> %s', (entrada, esperado) => {
    expect(esIsoValido(entrada)).toBe(esperado);
  });
});

describe('formateo', () => {
  const iso = ahoraIso(local(2026, 9, 14, 10, 22, 0));

  it('formatearDiaMes da dd/mm como en el mockup del PRD', () => {
    expect(formatearDiaMes(iso)).toBe('14/09');
  });

  it('formatearFechaHora agrega ano y hora', () => {
    expect(formatearFechaHora(iso)).toBe('14/09/2026 10:22');
  });

  it('texto invalido devuelve cadena vacia en vez de "Invalid Date"', () => {
    expect(formatearDiaMes('cualquier cosa')).toBe('');
    expect(formatearFechaHora('')).toBe('');
  });
});

describe('tiempoRelativo', () => {
  const referencia = local(2026, 9, 20, 12, 0, 0);
  const hace = (ms: number) => ahoraIso(new Date(referencia.getTime() - ms));

  const MIN = 60_000;
  const HORA = 60 * MIN;
  const DIA = 24 * HORA;

  it.each([
    [hace(10_000), 'recién'],
    [hace(5 * MIN), 'hace 5 min'],
    [hace(3 * HORA), 'hace 3 h'],
    [hace(DIA), 'ayer'],
    [hace(5 * DIA), 'hace 5 días'],
    [hace(45 * DIA), 'hace un mes'],
    [hace(120 * DIA), 'hace 4 meses'],
  ])('%s -> %s', (iso, esperado) => {
    expect(tiempoRelativo(iso, referencia)).toBe(esperado);
  });

  it('texto invalido no rompe', () => {
    expect(tiempoRelativo('nada', referencia)).toBe('');
  });
});

describe('ordenarPorFechaDesc', () => {
  it('deja el mas nuevo primero (lista del vecino, PRD 2)', () => {
    const items = [
      { id: 'a', creadoEn: '2026-09-10T10:00:00-03:00' },
      { id: 'b', creadoEn: '2026-09-14T10:00:00-03:00' },
      { id: 'c', creadoEn: '2026-09-12T10:00:00-03:00' },
    ];
    expect(ordenarPorFechaDesc(items, (i) => i.creadoEn).map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('no muta el arreglo original', () => {
    const items = [
      { id: 'a', creadoEn: '2026-09-10T10:00:00-03:00' },
      { id: 'b', creadoEn: '2026-09-14T10:00:00-03:00' },
    ];
    ordenarPorFechaDesc(items, (i) => i.creadoEn);
    expect(items[0]!.id).toBe('a');
  });

  it('lista vacia devuelve lista vacia', () => {
    expect(ordenarPorFechaDesc([], () => '')).toEqual([]);
  });
});
