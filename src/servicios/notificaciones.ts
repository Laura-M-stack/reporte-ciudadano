/**
 * Notificaciones: push (desde la API) y locales (desde la app). expo-notifications.
 *
 * PUSH (resuelve P-05): la API de la catedra ya decide cuando avisar (cambio de estado de un
 * reporte, otro vecino que se suma) y el grupo completo la parte que faltaba (guardar los
 * tokens y mandarlos a Expo). La app, al entrar, pide el token de Expo del telefono y lo
 * registra con POST /dispositivos; al cerrar sesion lo da de baja. Asi el aviso llega aunque
 * la app este cerrada.
 *
 * LOCALES (requisito 6 de la catedra, disparadas por un hecho real):
 *   - La cola logra subir un reporte que estaba esperando señal. Ese hecho ocurre en el
 *     telefono, asi que siempre es local.
 *   - Al sincronizar, si el estado de un reporte cambio respecto de la copia local. Es la
 *     red de seguridad cuando NO hay push (sin API, sin permiso, o sin token): si el
 *     telefono si tiene push registrado, no se repite el aviso que ya mando el servidor.
 *
 * POR QUE EL MODULO SE CARGA EN DIFERIDO (y no con un `import` arriba):
 * en Expo Go sobre Android, expo-notifications LANZA UN ERROR al cargarse. No es una
 * advertencia: su propio warnOfExpoGoPushUsage.js hace `throw` cuando Platform.OS es
 * 'android', porque el push remoto se quito de Expo Go en el SDK 53. Como el error ocurre al
 * IMPORTAR, con un `import` normal se propagaba a app/_layout.tsx, Expo Router no podia
 * cargar la ruta raiz y la app no abria ("missing the required default export").
 *
 * Por eso: en Expo Go sobre Android ni se intenta cargar, y en cualquier otro caso se carga
 * en diferido dentro de try/catch. Consecuencia practica, y hay que tenerla presente para la
 * defensa: EN EXPO GO NO HAY NINGUNA NOTIFICACION, ni local. El requisito 6 se demuestra en
 * el APK o en una development build, donde el modulo carga normalmente.
 *
 * Regla que se desprende de esto, y vale para todo el proyecto: ningun modulo de src/ hace
 * trabajo al importarse. Solo define cosas. El trabajo va dentro de funciones.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { preferencias } from '../datos/preferencias';
import { ETIQUETAS_ESTADO, type EstadoReporte, type Reporte } from '../tipos';

import { hayApi, pedir } from './http';

export const CANAL_ANDROID = 'reportes';

type ModuloNotificaciones = typeof import('expo-notifications');

/**
 * true cuando la app corre dentro de Expo Go (no en el APK ni en una development build).
 * Se mira con expo-constants, que es API publica y no lanza.
 */
export const EN_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** En Expo Go sobre Android el modulo lanza al cargarse: ni lo intentamos. */
const MODULO_IMPOSIBLE = EN_EXPO_GO && Platform.OS === 'android';

/** undefined = todavia no se intento; null = se intento y no esta disponible. */
let modulo: ModuloNotificaciones | null | undefined;

/**
 * Carga el modulo la primera vez y memoriza el resultado, incluido el fallo.
 * Se usa `import()` dinamico (no `require`) para que un fallo sea una promesa rechazada
 * que podemos atrapar, en vez de una excepcion al evaluar este archivo.
 */
async function cargar(): Promise<ModuloNotificaciones | null> {
  if (modulo !== undefined) return modulo;
  if (MODULO_IMPOSIBLE) {
    modulo = null;
    return modulo;
  }
  try {
    modulo = await import('expo-notifications');
  } catch {
    modulo = null;
  }
  return modulo;
}

/**
 * Para que la UI pueda decir la verdad ("en este dispositivo no hay avisos") en vez de
 * prometer notificaciones que no van a llegar.
 */
export async function hayNotificaciones(): Promise<boolean> {
  return (await cargar()) !== null;
}

let configurado = false;

/**
 * Se llama una vez al arrancar la app, ya con sesion. Nunca lanza: un telefono sin
 * notificaciones no es un error que tenga que romper el arranque.
 */
export async function configurar(): Promise<void> {
  const N = await cargar();
  if (!N || configurado) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    await N.setNotificationChannelAsync(CANAL_ANDROID, {
      name: 'Avisos de reportes',
      importance: N.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
    configurado = true;
  } catch {
    // Si el canal no se puede crear, los avisos no salen pero la app sigue.
  }
}

export async function pedirPermiso(): Promise<boolean> {
  const N = await cargar();
  if (!N) return false;
  try {
    const actual = await N.getPermissionsAsync();
    if (actual.granted) return true;
    const pedido = await N.requestPermissionsAsync();
    return pedido.granted;
  } catch {
    return false;
  }
}

/** El projectId de EAS: getExpoPushTokenAsync lo necesita fuera de Expo Go. */
function idDeProyecto(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/**
 * Registra este telefono en la API para recibir push. Se llama con la sesion ya activa y el
 * permiso ya pedido. Devuelve true si quedo registrado. Nunca lanza.
 *
 * Por que puede no registrarse, y en todos los casos la app sigue con las locales:
 *  - sin API (modo mock) o sin permiso de notificaciones;
 *  - en Expo Go sobre Android (el modulo no carga);
 *  - en Android, si la build no tiene la configuracion de Firebase (google-services.json):
 *    Expo usa FCM para entregar las push y getExpoPushTokenAsync falla sin ella.
 */
export async function registrarDispositivo(): Promise<boolean> {
  if (!hayApi()) return false;
  const N = await cargar();
  const proyecto = idDeProyecto();
  if (!N || !proyecto) return false;
  try {
    const permiso = await N.getPermissionsAsync();
    if (!permiso.granted) {
      await preferencias.borrarTokenPush();
      return false;
    }
    const { data: tokenExpo } = await N.getExpoPushTokenAsync({ projectId: proyecto });
    await pedir('/dispositivos', {
      metodo: 'POST',
      cuerpo: { tokenExpo, plataforma: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
    await preferencias.guardarTokenPush(tokenExpo);
    return true;
  } catch {
    // Sin token registrado, la sincronizacion vuelve a avisar con notificaciones locales.
    await preferencias.borrarTokenPush().catch(() => undefined);
    return false;
  }
}

/** Da de baja el token de este telefono (al cerrar sesion). Si no habia, no hace nada. */
export async function darDeBajaDispositivo(): Promise<void> {
  const token = await preferencias.leerTokenPush();
  if (!token) return;
  try {
    if (hayApi()) {
      await pedir<void>(`/dispositivos/${encodeURIComponent(token)}`, { metodo: 'DELETE' });
    }
  } finally {
    await preferencias.borrarTokenPush();
  }
}

/** true si las novedades del servidor ya llegan por push a este telefono. */
async function hayPushRegistrado(): Promise<boolean> {
  return (await preferencias.leerTokenPush()) !== null;
}

/**
 * Al tocar una notificacion (push o local) que trae `reporteId`, abre ese reporte. Cubre
 * tambien el caso de la app cerrada: la notificacion que la abrio se lee al arrancar.
 * Devuelve la funcion para dejar de escuchar.
 */
export async function alTocarNotificacion(
  abrirReporte: (reporteId: string) => void,
): Promise<() => void> {
  const N = await cargar();
  if (!N) return () => undefined;
  const manejar = (datos: unknown) => {
    const id = (datos as { reporteId?: unknown } | null)?.reporteId;
    if (typeof id === 'string' && id) abrirReporte(id);
  };
  try {
    // La que abrio la app (si la abrio una notificacion). Se limpia despues de usarla: si no,
    // cada vez que se vuelve a abrir la app saltaria otra vez al mismo reporte.
    const inicial = N.getLastNotificationResponse();
    if (inicial) {
      manejar(inicial.notification.request.content.data);
      N.clearLastNotificationResponse();
    }
    const suscripcion = N.addNotificationResponseReceivedListener((respuesta) =>
      manejar(respuesta.notification.request.content.data),
    );
    return () => suscripcion.remove();
  } catch {
    return () => undefined;
  }
}

async function avisar(
  titulo: string,
  cuerpo: string,
  datos: Record<string, unknown>,
): Promise<void> {
  const N = await cargar();
  if (!N) return;
  try {
    // El vecino puede apagar los avisos (PRD, seccion 5). Se respeta aca, en un solo lugar.
    if (!(await preferencias.leerAvisosActivos())) return;
    const permiso = await N.getPermissionsAsync();
    if (!permiso.granted) return;
    await N.scheduleNotificationAsync({
      content: { title: titulo, body: cuerpo, data: datos },
      trigger: null, // inmediata
    });
  } catch {
    // Un aviso que no sale no justifica romperle la pantalla al vecino.
  }
}

export function notificarCambioDeEstado(
  reporte: Reporte,
  estadoNuevo: EstadoReporte,
): Promise<void> {
  return avisar(`Tu reclamo ${reporte.codigo}`, `Ahora esta: ${ETIQUETAS_ESTADO[estadoNuevo]}`, {
    reporteId: reporte.id,
    tipo: 'cambio_estado',
  });
}

export function notificarAdhesion(reporte: Reporte, total: number): Promise<void> {
  return avisar(
    'Otro vecino se sumó a tu reclamo',
    `${reporte.codigo} ya tiene ${total} vecinos.`,
    { reporteId: reporte.id, tipo: 'adhesion' },
  );
}

/**
 * El reporte se marco como duplicado de otro (P-07). Mensaje propio en vez del generico
 * de notificarCambioDeEstado: el vecino no entenderia un seco "Ahora esta: Rechazado" sin
 * la explicacion de que es porque alguien mas ya habia avisado lo mismo.
 */
export function notificarDuplicado(reporte: Reporte): Promise<void> {
  return avisar(
    `Tu reclamo ${reporte.codigo}`,
    'Era el mismo problema que otro reclamo ya en curso. Lo sumamos a ese y dejamos de listar este por separado; las novedades las vas a ver ahí.',
    { reporteId: reporte.id, tipo: 'duplicado' },
  );
}

/** La cola logro subir reportes que estaban esperando señal. */
export function notificarReporteEnviado(cantidad: number): Promise<void> {
  return avisar(
    cantidad === 1 ? 'Tu reporte ya se envió' : 'Tus reportes ya se enviaron',
    cantidad === 1
      ? 'Quedó registrado y ya lo pueden ver en la Municipalidad. El número de seguimiento está en Mis reclamos.'
      : `${cantidad} reportes quedaron registrados y ya los pueden ver en la Municipalidad.`,
    { tipo: 'reporte_enviado' },
  );
}

/**
 * Compara la copia local con lo que trajo la API y avisa por cada cambio.
 * La llama la sincronizacion (src/servicios/sincronizacion.ts), no una pantalla.
 */
export async function avisarCambiosDetectados(
  anteriores: Reporte[],
  actuales: Reporte[],
): Promise<number> {
  // Si el telefono recibe push, el servidor ya aviso de estos cambios: repetirlos con una
  // local seria mandar dos notificaciones por el mismo hecho.
  if (await hayPushRegistrado()) return 0;

  const porId = new Map(anteriores.map((r) => [r.id, r]));
  let avisos = 0;
  for (const actual of actuales) {
    const anterior = porId.get(actual.id);
    if (!anterior) continue;
    if (anterior.estado !== actual.estado) {
      // P-07: si el cambio a "rechazado" fue por marcarlo duplicado, un mensaje especial
      // en vez del generico — ver notificarDuplicado.
      if (actual.estado === 'rechazado' && actual.duplicadoDe) {
        await notificarDuplicado(actual);
      } else {
        await notificarCambioDeEstado(actual, actual.estado);
      }
      avisos++;
    } else if (actual.adhesiones > anterior.adhesiones) {
      await notificarAdhesion(actual, actual.adhesiones);
      avisos++;
    }
  }
  return avisos;
}
