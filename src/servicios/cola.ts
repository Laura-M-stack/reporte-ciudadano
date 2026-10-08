/**
 * Cola offline de reportes. Es la pieza mas compartida del proyecto:
 * la escribe Persona 2, la lee Persona 3 y la limpia Persona 1.
 *
 * Como esta armada y por que:
 *  - `crearServicioCola` es una fabrica que recibe TODO por inyeccion (repositorio, funcion
 *    de envio, reloj, generador de ids, chequeo de red). Asi el comportamiento de la cola
 *    —reintentos, tope de intentos, transiciones de estado— se testea en Node, sin SQLite,
 *    sin red y sin esperar timers reales.
 *  - La cola NO sabe hablar HTTP. Recibe `enviar`, que hoy apunta a servicios/reportes.ts.
 *  - La cola NO calcula la zona. El zonaId ya viene resuelto en el borrador (logica pura de
 *    src/utils/geo.ts, que corre offline). Ver la decision en el README, seccion Arquitectura.
 *
 * Maquina de estados de una fila:
 *
 *   pendiente --(hay red)--> enviando --(ok)--> enviado
 *        ^                       |
 *        |                       +--(falla reintentable, intentos < MAX)--> pendiente
 *        |                       +--(falla definitiva o intentos == MAX)--> error
 *        +--(el vecino toca "reintentar")-----------------------------------+
 */
import { CODIGOS, ErrorServicio, comoErrorServicio, esErrorServicio } from '../errores';
import type {
  BorradorReporte,
  EnviarBorrador,
  EstadoEnvio,
  ReporteEnCola,
  ResultadoSincronizacion,
  ServicioCola,
} from '../tipos';
import { MAX_INTENTOS_ENVIO } from '../tipos';
import { ahoraIso, nuevoIdLocal } from '../utils';
import { borrarAdjunto } from '../datos/archivos';
import { repositorioColaSqlite, type RepositorioCola } from '../datos/colaRepositorio';

import { escucharRed, hayInternet } from './red';
import { crearReporte } from './reportes';

export interface DependenciasCola {
  repositorio: RepositorioCola;
  /** Sube un item de la cola y devuelve el Reporte que creo el servidor. */
  enviar: EnviarBorrador;
  /** Si devuelve false, `reintentar` ni siquiera intenta y deja todo pendiente. */
  hayInternet: () => Promise<boolean>;
  /** Reloj inyectable: los tests fijan la fecha para poder afirmar sobre actualizadoEn. */
  ahora?: () => string;
  nuevoId?: () => string;
  maxIntentos?: number;
  /** Borra el archivo local de un adjunto al descartar un reporte. */
  borrarArchivo?: (uri: string) => void;
}

/** Estados que se vuelven a intentar cuando hay red. */
const REINTENTABLES: EstadoEnvio[] = ['pendiente', 'error'];

export function crearServicioCola(deps: DependenciasCola): ServicioCola {
  const {
    repositorio,
    enviar,
    hayInternet,
    ahora = ahoraIso,
    nuevoId = nuevoIdLocal,
    maxIntentos = MAX_INTENTOS_ENVIO,
    borrarArchivo = () => undefined,
  } = deps;

  const oyentes = new Set<(items: ReporteEnCola[]) => void>();

  async function avisar(): Promise<void> {
    if (oyentes.size === 0) return;
    const items = await repositorio.listar();
    for (const oyente of oyentes) {
      try {
        oyente(items);
      } catch {
        // Un oyente roto no puede tumbar la cola.
      }
    }
  }

  async function guardar(item: ReporteEnCola): Promise<ReporteEnCola> {
    const actualizado: ReporteEnCola = { ...item, actualizadoEn: ahora() };
    await repositorio.actualizar(actualizado);
    return actualizado;
  }

  async function enviarUno(item: ReporteEnCola): Promise<ReporteEnCola> {
    const enCurso = await guardar({ ...item, estadoEnvio: 'enviando' });
    try {
      const reporte = await enviar(enCurso);
      return await guardar({
        ...enCurso,
        estadoEnvio: 'enviado',
        intentos: enCurso.intentos + 1,
        ultimoError: null,
        idRemoto: reporte.id,
        codigoRemoto: reporte.codigo,
      });
    } catch (e) {
      const error = comoErrorServicio(e, CODIGOS.DESCONOCIDO, 'No se pudo enviar el reporte.');
      const intentos = enCurso.intentos + 1;
      // Un error del servidor por datos invalidos (ej. FOTO_REQUERIDA) no mejora reintentando:
      // se marca como error de una y el vecino tiene que corregirlo.
      const puedeReintentar = error.reintentable && intentos < maxIntentos;
      return await guardar({
        ...enCurso,
        estadoEnvio: puedeReintentar ? 'pendiente' : 'error',
        intentos,
        ultimoError: error.aErrorApi(),
      });
    }
  }

  const servicio: ServicioCola = {
    async encolar(borrador: BorradorReporte) {
      if (!borrador.tipoId) {
        throw new ErrorServicio(CODIGOS.TIPO_REQUERIDO, 'Elegi que tipo de problema es.');
      }
      // El PRD es tajante: sin foto no hay reporte. Se valida ACA, no solo en la pantalla,
      // para que ningun camino (ni un test, ni una pantalla nueva) pueda encolar sin foto.
      const tieneFoto = borrador.adjuntos.some((a) => a.tipo === 'foto');
      if (!tieneFoto) {
        throw new ErrorServicio(
          CODIGOS.FOTO_REQUERIDA,
          'El reporte necesita al menos una foto del problema.',
        );
      }
      if (!borrador.coordenadas) {
        throw new ErrorServicio(
          CODIGOS.UBICACION_REQUERIDA,
          'Falta la ubicacion del problema.',
        );
      }

      const momento = ahora();
      const item: ReporteEnCola = {
        idLocal: nuevoId(),
        borrador,
        estadoEnvio: 'pendiente',
        intentos: 0,
        ultimoError: null,
        creadoEn: momento,
        actualizadoEn: momento,
        idRemoto: null,
        codigoRemoto: null,
      };
      await repositorio.insertar(item);
      await avisar();
      return item;
    },

    async listarPendientes() {
      return repositorio.listar({ estados: REINTENTABLES });
    },

    async listarTodos() {
      return repositorio.listar();
    },

    async obtener(idLocal) {
      return repositorio.obtener(idLocal);
    },

    async reintentar(idLocal?: string) {
      const resultado: ResultadoSincronizacion = {
        intentados: 0,
        enviados: 0,
        fallados: 0,
        errores: [],
      };

      let candidatos: ReporteEnCola[];
      if (idLocal) {
        const item = await repositorio.obtener(idLocal);
        if (!item) {
          throw new ErrorServicio(
            CODIGOS.COLA_ITEM_INEXISTENTE,
            'Ese reporte ya no esta en la cola.',
            { detalles: { idLocal } },
          );
        }
        candidatos = item.estadoEnvio === 'enviado' ? [] : [item];
      } else {
        candidatos = await repositorio.listar({ estados: REINTENTABLES });
      }

      if (candidatos.length === 0) return resultado;

      if (!(await hayInternet())) {
        // Sin red no se toca nada: quedan pendientes y se reintenta cuando vuelva la senal.
        return resultado;
      }

      for (const candidato of candidatos) {
        // Un reporte que ya agoto los intentos solo se reintenta si el vecino lo pide a mano.
        if (!idLocal && candidato.intentos >= maxIntentos) continue;
        resultado.intentados++;
        const actualizado = await enviarUno(candidato);
        if (actualizado.estadoEnvio === 'enviado') {
          resultado.enviados++;
        } else {
          resultado.fallados++;
          resultado.errores.push({
            idLocal: actualizado.idLocal,
            codigo: actualizado.ultimoError?.codigo ?? CODIGOS.DESCONOCIDO,
            mensaje: actualizado.ultimoError?.mensaje ?? 'No se pudo enviar.',
          });
        }
      }

      await avisar();
      return resultado;
    },

    async eliminar(idLocal) {
      const item = await repositorio.obtener(idLocal);
      if (!item) return;
      for (const adjunto of item.borrador.adjuntos) {
        try {
          borrarArchivo(adjunto.uri);
        } catch {
          // Si el archivo ya no esta, no es un error: igual sacamos la fila.
        }
      }
      await repositorio.eliminar(idLocal);
      await avisar();
    },

    async limpiarEnviados(dias = 7) {
      const limite = new Date(Date.parse(ahora()) - dias * 24 * 60 * 60 * 1000);
      const borradas = await repositorio.eliminarEnviadosAntesDe(ahoraIso(limite));
      if (borradas > 0) await avisar();
      return borradas;
    },

    suscribir(alCambiar) {
      oyentes.add(alCambiar);
      // Primer aviso con el estado actual, para que la UI no arranque vacia.
      void repositorio.listar().then(alCambiar).catch(() => undefined);
      return () => {
        oyentes.delete(alCambiar);
      };
    },
  };

  return servicio;
}

/**
 * Instancia real de la app. Cableada a SQLite y al servicio de reportes.
 * Las pantallas importan esto, nunca `crearServicioCola`.
 */
export const cola: ServicioCola = crearServicioCola({
  repositorio: repositorioColaSqlite,
  enviar: async (item) => crearReporte(item.borrador, item.idLocal),
  hayInternet,
  borrarArchivo: borrarAdjunto,
});

let bajaDeRed: (() => void) | null = null;

/**
 * Arranca el vaciado automatico de la cola: cada vez que vuelve la conexion, intenta subir
 * lo pendiente. Se llama una vez desde app/_layout.tsx.
 *
 * Devuelve la funcion para frenarlo (util en tests y al desmontar).
 */
export function iniciarAutoSincronizacion(
  alTerminar?: (resultado: ResultadoSincronizacion) => void,
): () => void {
  if (bajaDeRed) return bajaDeRed;

  const sincronizar = () => {
    void cola
      .reintentar()
      .then((resultado) => {
        if (resultado.intentados > 0) alTerminar?.(resultado);
      })
      .catch((e) => {
        if (!esErrorServicio(e)) throw e;
        // Un fallo de sincronizacion en segundo plano no se le muestra al vecino.
      });
  };

  // Primer intento al abrir la app; despues, en cada cambio de red que traiga conexion.
  sincronizar();
  const baja = escucharRed((estado) => {
    if (estado.hayConexion && estado.internetAlcanzable !== false) sincronizar();
  });

  bajaDeRed = () => {
    baja();
    bajaDeRed = null;
  };
  return bajaDeRed;
}
