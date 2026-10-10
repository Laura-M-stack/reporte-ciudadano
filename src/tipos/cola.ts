/**
 * Contrato COMPARTIDO de la cola offline. Lo usan las cuatro personas del equipo:
 *  - Persona 2 escribe en la cola al crear un reporte sin senal.
 *  - Persona 3 lee la cola para mostrar "pendiente de envio" en la lista del vecino.
 *  - Persona 1 la vacia al cerrar sesion.
 *  - Persona 4 nunca la toca (el operador trabaja online), pero comparte los tipos.
 *
 * Decision de arquitectura: la cola NO sabe hablar con la API. Recibe por inyeccion la
 * funcion que sube un borrador (ver crearServicioCola en src/servicios/cola.ts). Asi se
 * puede testear sin red y cambiar el transporte sin tocarla.
 */
import type { Coordenadas, MomentoFoto, Reporte } from './reporte';

export type EstadoEnvio = 'pendiente' | 'enviando' | 'enviado' | 'error';

/** Archivo guardado en el telefono (expo-file-system) que todavia no se subio. */
export interface AdjuntoLocal {
  /** local-<uuid> */
  id: string;
  /** Ruta local file:// devuelta por expo-camera / expo-image-picker / expo-audio. */
  uri: string;
  tipo: 'foto' | 'audio';
  /** Solo aplica a fotos; en audio va "problema". */
  momento: MomentoFoto;
  /** URL remota una vez subido. null mientras sigue solo en el telefono. */
  urlRemota: string | null;
  /** Bytes, para poder avisar si el adjunto es muy grande antes de intentar subirlo. */
  tamanoBytes: number | null;
}

/**
 * Lo que el vecino completa en la pantalla de "Nuevo reporte", antes de que exista
 * un Reporte con id y codigo del servidor.
 */
export interface BorradorReporte {
  tipoId: string;
  descripcion: string | null;
  coordenadas: Coordenadas;
  /** Puede ser "Sin direccion (punto marcado en el mapa)" si no hubo geocodificacion. Ver S-03. */
  direccion: string;
  /**
   * Calculado offline con zonaIdDePunto. Siempre viene con un valor: el id de una de las 4
   * zonas, o ID_FUERA_DE_ZONA si el punto no cae dentro de ninguna ni lo bastante cerca
   * (S-14, responde P-06). Reemplaza al S-05 original, que dejaba esto en null.
   */
  zonaId: string;
  adjuntos: AdjuntoLocal[];
  /** Si el vecino eligio sumarse a un reporte cercano en vez de crear uno nuevo. */
  adhiereAReporteId: string | null;
  /** true si el punto lo movio el vecino a mano (GPS negado o corregido). Util para el operador. */
  ubicacionCorregidaAMano: boolean;
}

/** Una fila de la cola. La clave primaria es idLocal y tambien sirve de clave de idempotencia. */
export interface ReporteEnCola {
  /** local-<uuid>. Nunca un indice secuencial: dos telefonos offline generarian el mismo. */
  idLocal: string;
  borrador: BorradorReporte;
  estadoEnvio: EstadoEnvio;
  intentos: number;
  ultimoError: { codigo: string; mensaje: string } | null;
  /** ISO 8601 con zona. */
  creadoEn: string;
  /** ISO 8601 con zona. */
  actualizadoEn: string;
  /** id que devolvio el servidor una vez subido. */
  idRemoto: string | null;
  /** codigo de seguimiento oficial (GCHU-2026-00412) una vez subido. */
  codigoRemoto: string | null;
}

export interface ResultadoSincronizacion {
  intentados: number;
  enviados: number;
  fallados: number;
  /** Reportes que quedaron en error, para poder mostrarselo al vecino. */
  errores: { idLocal: string; codigo: string; mensaje: string }[];
}

/**
 * Servicio de cola. Implementacion en src/servicios/cola.ts (SQLite).
 * Todos los metodos son asincronos desde el dia uno, aunque hoy respondan al instante.
 */
export interface ServicioCola {
  /** Guarda el borrador en el telefono y devuelve la fila creada (estadoEnvio: "pendiente"). */
  encolar(borrador: BorradorReporte): Promise<ReporteEnCola>;
  /** Pendientes y fallados reintentables, del mas viejo al mas nuevo. */
  listarPendientes(): Promise<ReporteEnCola[]>;
  /** Todo lo que hay en la cola, incluido lo ya enviado que aun no se limpio. */
  listarTodos(): Promise<ReporteEnCola[]>;
  obtener(idLocal: string): Promise<ReporteEnCola | null>;
  /** Reintenta uno (si se pasa idLocal) o toda la cola. No lanza: devuelve el resumen. */
  reintentar(idLocal?: string): Promise<ResultadoSincronizacion>;
  /** Descarta un reporte de la cola (el vecino lo cancela). Borra tambien sus adjuntos locales. */
  eliminar(idLocal: string): Promise<void>;
  /** Saca de la cola lo ya enviado hace mas de `dias`. */
  limpiarEnviados(dias?: number): Promise<number>;
  /**
   * Avisa cada vez que la cola cambia, con el contenido nuevo. Lo usa la UI para el
   * cartel de "N reportes esperando senal". Devuelve la funcion para desuscribirse.
   */
  suscribir(alCambiar: (items: ReporteEnCola[]) => void): () => void;
}

/** Lo que la cola necesita saber hacer para subir: se inyecta desde servicios/reportes.ts. */
export type EnviarBorrador = (item: ReporteEnCola) => Promise<Reporte>;

/** Politica de reintentos. Un reporte no se reintenta para siempre. */
export const MAX_INTENTOS_ENVIO = 5;
