// expo-crypto esta mockeado en jest.setup.js (randomUUID devuelve un uuid fijo).
import {
  PREFIJO_LOCAL,
  codigoProvisorio,
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

  describe('codigoProvisorio (P-02, resuelto en el foro)', () => {
    it('empieza con LOCAL- y es estable para el mismo idLocal', () => {
      const idLocal = 'local-8c1f0b6e-4b7a-4f0e-9a1d-2c3d4e5f6a7b';
      expect(codigoProvisorio(idLocal)).toBe('LOCAL-8C1F0B6E');
      expect(codigoProvisorio(idLocal)).toBe(codigoProvisorio(idLocal));
    });

    it('dos idLocal distintos dan codigos distintos', () => {
      expect(codigoProvisorio('local-aaaaaaaa-0000-0000-0000-000000000000')).not.toBe(
        codigoProvisorio('local-bbbbbbbb-0000-0000-0000-000000000000'),
      );
    });

    it('funciona aunque no traiga el prefijo local-', () => {
      expect(codigoProvisorio('8c1f0b6e-4b7a')).toBe('LOCAL-8C1F0B6E');
    });
  });
});
