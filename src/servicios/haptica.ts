/**
 * Haptica (expo-haptics). Requisito 8 de la catedra: "al menos un uso justificado... que
 * aporte algo a la experiencia".
 *
 * Los tres usos que tiene la app, y por que cada uno:
 *
 *  - confirmarEnvio(): el vecino esta parado en la vereda, con sol, mirando el pozo y no la
 *    pantalla. La vibracion le confirma que el reporte salio sin tener que leer nada.
 *  - avisarDuplicadoCerca(): aparece una lista de reportes existentes a menos de 50 m. Es un
 *    cambio de pantalla inesperado; la vibracion de advertencia le dice "pará, mirá esto"
 *    antes de que siga apretando.
 *  - fotoTomada(): feedback del obturador, que en un celular silenciado no se oye.
 *
 * Nunca vibra por algo que el vecino ya esta mirando: eso es ruido, no informacion.
 */
import * as Haptics from 'expo-haptics';

/** Ninguna de estas funciones falla nunca: un telefono sin vibrador no es un error. */
async function seguro(accion: () => Promise<void>): Promise<void> {
  try {
    await accion();
  } catch {
    // Sin motor haptico no pasa nada.
  }
}

export function fotoTomada(): Promise<void> {
  return seguro(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function confirmarEnvio(): Promise<void> {
  return seguro(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function avisarDuplicadoCerca(): Promise<void> {
  return seguro(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function errorAlEnviar(): Promise<void> {
  return seguro(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

/** Toque corto al elegir una opcion de la grilla de tipos. */
export function seleccion(): Promise<void> {
  return seguro(() => Haptics.selectionAsync());
}
