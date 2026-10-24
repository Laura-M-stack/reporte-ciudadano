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
