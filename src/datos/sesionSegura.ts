/**
 * Guardado del token de sesion. UNICO archivo de la app que toca expo-secure-store.
 *
 * PRD, sin excepcion: "La sesion viaja en la cabecera Authorization: Bearer <token>.
 * El token se guarda en expo-secure-store, nunca en kv-store."
 *
 * El perfil del usuario (nombre, rol, avisosActivos) no es secreto y se guarda en kv-store
 * para poder pintar la UI antes de que responda la red (ver preferencias.ts).
 */
import * as SecureStore from 'expo-secure-store';

import { CODIGOS, comoErrorServicio } from '../errores';

const CLAVE_TOKEN = 'reporte_ciudadano_token';

export async function guardarToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(CLAVE_TOKEN, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_ARCHIVO, 'No se pudo guardar la sesión.');
  }
}

export async function leerToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(CLAVE_TOKEN);
  } catch {
    // Si el llavero esta corrupto preferimos "no hay sesión" antes que romper el arranque.
    return null;
  }
}

export async function borrarToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CLAVE_TOKEN);
  } catch {
    // Nada que hacer: si no se pudo borrar, igual limpiamos el estado en memoria.
  }
}
