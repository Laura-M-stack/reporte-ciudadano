// expo-crypto esta mockeado en jest.setup.js (randomUUID devuelve un uuid fijo).
import {
  PREFIJO_LOCAL,
  esIdLocal,
  nombreArchivoAdjunto,
  nuevoIdAdjunto,
  nuevoIdLocal,
  nuevoUuid,
} from '../ids';

describe('ids locales', () => {
  it('nuevoIdLocal arranca con el prefijo local-', () => {
    expect(nuevoIdLocal().startsWith(PREFIJO_LOCAL)).toBe(true);
  });

  it('el id local contiene un uuid, no un numero secuencial', () => {
    expect(nuevoIdLocal()).toMatch(
      /^local-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('nuevoUuid devuelve un uuid', () => {
    expect(typeof nuevoUuid()).toBe('string');
  });

  it('nuevoIdAdjunto tambien es local', () => {
    expect(esIdLocal(nuevoIdAdjunto())).toBe(true);
  });

  it.each([
    ['local-abc', true],
    ['rep-00412', false],
    ['', false],
    [null, false],
    [undefined, false],
  ])('esIdLocal(%s) -> %s', (entrada, esperado) => {
    expect(esIdLocal(entrada as string | null | undefined)).toBe(esperado);
  });

  it('nombreArchivoAdjunto acepta la extension con o sin punto', () => {
    expect(nombreArchivoAdjunto('local-1', 'jpg')).toBe('local-1.jpg');
    expect(nombreArchivoAdjunto('local-1', '.m4a')).toBe('local-1.m4a');
  });
});
