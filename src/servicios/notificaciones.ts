/**
 * Notificaciones locales (expo-notifications).
 *
 * SUPUESTO S-10, y hay que conversarlo con el cliente (P-05): la catedra pide notificaciones
 * LOCALES disparadas por un hecho real de la app, pero el hecho que le importa al vecino
 * —"el operador cambio el estado de mi reclamo"— ocurre en el servidor. Sin push, la app
 * solo puede enterarse cuando sincroniza. Entonces:
 *
 *   - Al sincronizar, comparamos el estado que teniamos en cache con el que trae la API.
 *     Si cambio, disparamos la notificacion local. Es un hecho real, no un boton de prueba.
 *   - Tambien notificamos cuando la cola logra subir un reporte que estaba esperando senal.
 *
 * Lo que NO hace: avisar con la app cerrada. Eso necesita push y esta fuera de alcance.
 */
import * as Notifications from 'expo-notifications';

import { preferencias } from '../datos/preferencias';
import { ETIQUETAS_ESTADO, type EstadoReporte, type Reporte } from '../tipos';

export const CANAL_ANDROID = 'reportes';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Se llama una vez al arrancar la app. */
export async function configurar(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
    name: 'Avisos de reportes',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function pedirPermiso(): Promise<boolean> {
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted) return true;
  const pedido = await Notifications.requestPermissionsAsync();
  return pedido.granted;
}

async function avisar(titulo: string, cuerpo: string, datos: Record<string, unknown>): Promise<void> {
  // El vecino puede apagar los avisos (PRD, seccion 5). Se respeta aca, en un solo lugar.
  if (!(await preferencias.leerAvisosActivos())) return;
  const permiso = await Notifications.getPermissionsAsync();
  if (!permiso.granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: titulo, body: cuerpo, data: datos },
    trigger: null, // inmediata
  });
}

export function notificarCambioDeEstado(reporte: Reporte, estadoNuevo: EstadoReporte): Promise<void> {
  return avisar(
    `Tu reclamo ${reporte.codigo}`,
    `Ahora esta: ${ETIQUETAS_ESTADO[estadoNuevo]}`,
    { reporteId: reporte.id, tipo: 'cambio_estado' },
  );
}

export function notificarAdhesion(reporte: Reporte, total: number): Promise<void> {
  return avisar(
    'Otro vecino se sumo a tu reclamo',
    `${reporte.codigo} ya tiene ${total} vecinos.`,
    { reporteId: reporte.id, tipo: 'adhesion' },
  );
}

/** La cola logro subir un reporte que estaba esperando señal. */
export function notificarReporteEnviado(codigo: string): Promise<void> {
  return avisar(
    'Tu reporte ya se envio',
    `Quedo registrado como ${codigo}. Ya lo pueden ver en la Municipalidad.`,
    { tipo: 'reporte_enviado' },
  );
}

/**
 * Compara la copia local con lo que trajo la API y avisa por cada cambio.
 * La llama la sincronizacion, no una pantalla.
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
      await notificarCambioDeEstado(actual, actual.estado);
      avisos++;
    } else if (actual.adhesiones > anterior.adhesiones) {
      await notificarAdhesion(actual, actual.adhesiones);
      avisos++;
    }
  }
  return avisos;
}
