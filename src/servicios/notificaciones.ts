/** Notificaciones locales asociadas a cambios de estado y sincronización. */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { preferencias } from '../datos/preferencias';
import { ETIQUETAS_ESTADO, type EstadoReporte, type Reporte } from '../tipos';

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

/** Carga el módulo de notificaciones de forma diferida. */
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

async function avisar(
  titulo: string,
  cuerpo: string,
  datos: Record<string, unknown>,
): Promise<void> {
  const N = await cargar();
  if (!N) return;
  try {
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

/** Notifica cuando un reporte se vincula con otro por ser duplicado. */
export function notificarDuplicado(reporte: Reporte): Promise<void> {
  return avisar(
    `Tu reclamo ${reporte.codigo}`,
    'Era el mismo problema que otro reclamo ya en curso. Lo sumamos a ese y dejamos de listar este por separado; las novedades las vas a ver ahí.',
    { reporteId: reporte.id, tipo: 'duplicado' },
  );
}

/** La cola logro subir un reporte que estaba esperando senal. */
export function notificarReporteEnviado(codigo: string): Promise<void> {
  return avisar(
    'Tu reporte ya se envío',
    `Quedó registrado como ${codigo}. Ya lo pueden ver en la Municipalidad.`,
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
  const porId = new Map(anteriores.map((r) => [r.id, r]));
  let avisos = 0;
  for (const actual of actuales) {
    const anterior = porId.get(actual.id);
    if (!anterior) continue;
    if (anterior.estado !== actual.estado) {
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
