/**
 * Tests de la cola offline.
 *
 * Se prueba el COMPORTAMIENTO, no la implementacion: se arma el servicio con un repositorio
 * en memoria y una funcion de envio falsa. Ni SQLite ni red ni Expo.
 *
 * Casos cubiertos (todos salen del PRD):
 *  - el reporte se guarda en el telefono aunque no haya senal
 *  - sin foto no hay reporte, ni siquiera en la cola
 *  - sin conexion no se intenta subir nada y no se pierde nada
 *  - un error de red se reintenta; un error de datos, no
 *  - el tope de intentos existe y se respeta
 */
import { ErrorServicio, esErrorServicio } from '../../errores';
import { crearRepositorioEnMemoria } from '../../datos/colaEnMemoria';
import type { AdjuntoLocal, BorradorReporte, ReporteEnCola, Reporte } from '../../tipos';
import { crearServicioCola } from '../cola';

const FOTO: AdjuntoLocal = {
  id: 'local-foto-1',
  uri: 'file:///datos/adjuntos/local-foto-1.jpg',
  tipo: 'foto',
  momento: 'problema',
  urlRemota: null,
  tamanoBytes: 120_000,
};

function borrador(extra: Partial<BorradorReporte> = {}): BorradorReporte {
  return {
    tipoId: 'tip-bache',
    descripcion: 'Pozo grande en la mano hacia el centro.',
    coordenadas: { latitud: -33.0089, longitud: -58.5142 },
    direccion: 'Rocamora 1240',
    zonaId: 'zon-norte',
    adjuntos: [FOTO],
    adhiereAReporteId: null,
    ubicacionCorregidaAMano: false,
    ...extra,
  };
}

function reporteDelServidor(id = 'rep-00999'): Reporte {
  return {
    id,
    codigo: 'GCHU-2026-00999',
    tipoId: 'tip-bache',
    descripcion: null,
    audioUrl: null,
    fotos: [],
    coordenadas: { latitud: -33.0089, longitud: -58.5142 },
    direccion: 'Rocamora 1240',
    zonaId: 'zon-norte',
    estado: 'recibido',
    autorId: 'usr-084',
    cuadrillaId: null,
    duplicadoDe: null,
    adhesiones: 0,
    creadoEn: '2026-09-14T10:22:00-03:00',
    sincronizado: true,
  };
}

interface Armado {
  cola: ReturnType<typeof crearServicioCola>;
  repositorio: ReturnType<typeof crearRepositorioEnMemoria>;
  envios: ReporteEnCola[];
  borrados: string[];
}

function armar(opciones: {
  enviar?: (item: ReporteEnCola) => Promise<Reporte>;
  hayInternet?: boolean;
  maxIntentos?: number;
} = {}): Armado {
  const repositorio = crearRepositorioEnMemoria();
  const envios: ReporteEnCola[] = [];
  const borrados: string[] = [];
  let contador = 0;

  const cola = crearServicioCola({
    repositorio,
    enviar: async (item) => {
      envios.push(item);
      if (opciones.enviar) return opciones.enviar(item);
      return reporteDelServidor();
    },
    hayInternet: async () => opciones.hayInternet ?? true,
    ahora: () => '2026-09-14T10:22:00-03:00',
    nuevoId: () => `local-fijo-${++contador}`,
    maxIntentos: opciones.maxIntentos,
    borrarArchivo: (uri) => borrados.push(uri),
  });

  return { cola, repositorio, envios, borrados };
}

describe('encolar', () => {
  it('guarda el reporte como pendiente, con id local', async () => {
    const { cola } = armar();
    const item = await cola.encolar(borrador());

    expect(item.idLocal).toBe('local-fijo-1');
    expect(item.estadoEnvio).toBe('pendiente');
    expect(item.intentos).toBe(0);
    expect(item.idRemoto).toBe(null);
    expect(item.codigoRemoto).toBe(null);
  });

  it('no acepta un reporte sin foto (el PRD: sin foto no hay reporte)', async () => {
    const { cola, repositorio } = armar();
    let error: unknown = null;
    try {
      await cola.encolar(borrador({ adjuntos: [] }));
    } catch (e) {
      error = e;
    }
    expect(esErrorServicio(error)).toBe(true);
    expect((error as ErrorServicio).codigo).toBe('FOTO_REQUERIDA');
    expect(repositorio.contenido().length).toBe(0);
  });

  it('no acepta un reporte con solo audio', async () => {
    const { cola } = armar();
    const soloAudio: AdjuntoLocal = { ...FOTO, id: 'local-audio-1', tipo: 'audio' };
    let error: unknown = null;
    try {
      await cola.encolar(borrador({ adjuntos: [soloAudio] }));
    } catch (e) {
      error = e;
    }
    expect((error as ErrorServicio).codigo).toBe('FOTO_REQUERIDA');
  });

  it('no acepta un reporte sin tipo de problema', async () => {
    const { cola } = armar();
    let error: unknown = null;
    try {
      await cola.encolar(borrador({ tipoId: '' }));
    } catch (e) {
      error = e;
    }
    expect((error as ErrorServicio).codigo).toBe('TIPO_REQUERIDO');
  });

  it('acepta un reporte cuyo punto cayo fuera de las 4 zonas (S-14, responde P-06)', async () => {
    const { cola } = armar();
    // zonaId ya no admite null: zonaIdDePunto siempre devuelve algo, real o ID_FUERA_DE_ZONA.
    const item = await cola.encolar(borrador({ zonaId: 'fuera-de-zona' }));
    expect(item.borrador.zonaId).toBe('fuera-de-zona');
    expect(item.estadoEnvio).toBe('pendiente');
  });
});

describe('reintentar sin conexion', () => {
  it('no intenta subir nada y deja todo pendiente', async () => {
    const { cola, envios, repositorio } = armar({ hayInternet: false });
    await cola.encolar(borrador());

    const resultado = await cola.reintentar();

    expect(envios.length).toBe(0);
    expect(resultado.intentados).toBe(0);
    expect(repositorio.contenido()[0]!.estadoEnvio).toBe('pendiente');
  });
});

describe('reintentar con conexion', () => {
  it('sube el reporte y guarda el id y el codigo del servidor', async () => {
    const { cola } = armar();
    const item = await cola.encolar(borrador());

    const resultado = await cola.reintentar();

    expect(resultado.enviados).toBe(1);
    expect(resultado.fallados).toBe(0);
    const guardado = await cola.obtener(item.idLocal);
    expect(guardado!.estadoEnvio).toBe('enviado');
    expect(guardado!.idRemoto).toBe('rep-00999');
    expect(guardado!.codigoRemoto).toBe('GCHU-2026-00999');
  });

  it('respeta el orden: primero lo que el vecino cargo antes', async () => {
    const { cola, envios } = armar();
    const primero = await cola.encolar(borrador({ direccion: 'Primero' }));
    const segundo = await cola.encolar(borrador({ direccion: 'Segundo' }));

    await cola.reintentar();

    expect(envios[0]!.idLocal).toBe(primero.idLocal);
    expect(envios[1]!.idLocal).toBe(segundo.idLocal);
  });

  it('un error de red deja el reporte pendiente para reintentar', async () => {
    const { cola } = armar({
      enviar: async () => {
        throw new ErrorServicio('SIN_CONEXION', 'Se corto la red.', { reintentable: true });
      },
    });
    const item = await cola.encolar(borrador());

    const resultado = await cola.reintentar();

    expect(resultado.fallados).toBe(1);
    const guardado = await cola.obtener(item.idLocal);
    expect(guardado!.estadoEnvio).toBe('pendiente');
    expect(guardado!.intentos).toBe(1);
    expect(guardado!.ultimoError!.codigo).toBe('SIN_CONEXION');
  });

  it('un error de datos NO se reintenta: queda en error de una', async () => {
    const { cola } = armar({
      enviar: async () => {
        throw new ErrorServicio('FOTO_REQUERIDA', 'El reporte necesita una foto.');
      },
    });
    const item = await cola.encolar(borrador());

    await cola.reintentar();

    const guardado = await cola.obtener(item.idLocal);
    expect(guardado!.estadoEnvio).toBe('error');
    expect(guardado!.intentos).toBe(1);
  });

  it('deja de reintentar al llegar al tope de intentos', async () => {
    const { cola } = armar({
      maxIntentos: 3,
      enviar: async () => {
        throw new ErrorServicio('SIN_CONEXION', 'Se corto la red.', { reintentable: true });
      },
    });
    const item = await cola.encolar(borrador());

    await cola.reintentar();
    await cola.reintentar();
    await cola.reintentar();

    const guardado = await cola.obtener(item.idLocal);
    expect(guardado!.intentos).toBe(3);
    expect(guardado!.estadoEnvio).toBe('error');

    // El cuarto intento automatico ya no lo toca.
    const resultado = await cola.reintentar();
    expect(resultado.intentados).toBe(0);
  });

  it('el vecino puede forzar el reintento de uno que agoto los intentos', async () => {
    let fallar = true;
    const { cola } = armar({
      maxIntentos: 1,
      enviar: async () => {
        if (fallar) throw new ErrorServicio('SIN_CONEXION', 'Se corto.', { reintentable: true });
        return reporteDelServidor('rep-01000');
      },
    });
    const item = await cola.encolar(borrador());
    await cola.reintentar();
    expect((await cola.obtener(item.idLocal))!.estadoEnvio).toBe('error');

    fallar = false;
    const resultado = await cola.reintentar(item.idLocal);

    expect(resultado.enviados).toBe(1);
    expect((await cola.obtener(item.idLocal))!.estadoEnvio).toBe('enviado');
  });

  it('reintentar un id que no existe lanza ErrorServicio tipado', async () => {
    const { cola } = armar();
    let error: unknown = null;
    try {
      await cola.reintentar('local-que-no-existe');
    } catch (e) {
      error = e;
    }
    expect(esErrorServicio(error)).toBe(true);
    expect((error as ErrorServicio).codigo).toBe('COLA_ITEM_INEXISTENTE');
  });
});

describe('listados', () => {
  it('listarPendientes no incluye lo ya enviado', async () => {
    const { cola } = armar();
    await cola.encolar(borrador());
    await cola.reintentar();
    await cola.encolar(borrador({ direccion: 'Otro' }));

    const pendientes = await cola.listarPendientes();
    const todos = await cola.listarTodos();

    expect(pendientes.length).toBe(1);
    expect(todos.length).toBe(2);
  });
});

describe('eliminar y limpiar', () => {
  it('al descartar un reporte borra tambien sus archivos locales', async () => {
    const { cola, borrados, repositorio } = armar();
    const item = await cola.encolar(borrador());

    await cola.eliminar(item.idLocal);

    expect(borrados).toEqual([FOTO.uri]);
    expect(repositorio.contenido().length).toBe(0);
  });

  it('limpiarEnviados no toca lo que sigue pendiente', async () => {
    const { cola } = armar({ hayInternet: false });
    await cola.encolar(borrador());

    const borradas = await cola.limpiarEnviados(7);

    expect(borradas).toBe(0);
    expect((await cola.listarTodos()).length).toBe(1);
  });
});

describe('suscripcion', () => {
  it('avisa cuando la cola cambia', async () => {
    const { cola } = armar();
    const avisos: number[] = [];
    const baja = cola.suscribir((items) => avisos.push(items.length));

    await cola.encolar(borrador());
    await cola.encolar(borrador({ direccion: 'Otro' }));
    baja();
    await cola.encolar(borrador({ direccion: 'Tercero' }));

    // El ultimo aviso recibido tiene que ser el de la segunda alta, no el de la tercera.
    expect(avisos[avisos.length - 1]).toBe(2);
  });
});
