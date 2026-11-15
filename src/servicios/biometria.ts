/**
 * Reingreso con huella o rostro (expo-local-authentication).
 *
 * SUPUESTO S-12: la biometria es un ATAJO, no el camino principal. El PRD dice que buena
 * parte de los vecinos tienen mas de 60 y telefonos viejos; muchos no van a tener sensor.
 * La contrasena siempre esta disponible y la app nunca queda trabada por falta de sensor.
 */
import * as LocalAuthentication from 'expo-local-authentication';

import { CODIGOS, ErrorServicio } from '../errores';
import { preferencias } from '../datos/preferencias';

export interface DisponibilidadBiometria {
  /** El telefono tiene sensor. */
  hayHardware: boolean;
  /** El usuario tiene huella/rostro dado de alta en el sistema. */
  hayRegistro: boolean;
  /** Etiqueta para el boton: "huella", "rostro" o null. */
  etiqueta: string | null;
}

export async function disponibilidad(): Promise<DisponibilidadBiometria> {
  let hayHardware = false;
  let hayRegistro = false;
  try {
    hayHardware = await LocalAuthentication.hasHardwareAsync();
    hayRegistro = hayHardware ? await LocalAuthentication.isEnrolledAsync() : false;
  } catch {
    return { hayHardware: false, hayRegistro: false, etiqueta: null };
  }

  // La etiqueta es solo texto del boton. Si falla averiguarla (pasa en algunos Android viejos),
  // NO puede tumbar el resultado: el telefono igual tiene huella registrada.
  let etiqueta: string | null = null;
  if (hayRegistro) {
    etiqueta = 'biometria';
    try {
      const tipos = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        etiqueta = 'rostro';
      } else if (tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        etiqueta = 'huella';
      }
    } catch {
      // se queda con la etiqueta generica
    }
  }
  return { hayHardware, hayRegistro, etiqueta };
}

/**
 * Pide la huella/rostro. Devuelve true solo si el sistema confirmo la identidad.
 * Lanza ErrorServicio si el telefono no puede hacerlo, para que la pantalla ofrezca
 * la contrasena en vez de dejar al usuario mirando un boton que no hace nada.
 */
export async function autenticar(motivo = 'Confirma tu identidad para entrar'): Promise<boolean> {
  const estado = await disponibilidad();
  if (!estado.hayRegistro) {
    throw new ErrorServicio(
      CODIGOS.BIOMETRIA_NO_DISPONIBLE,
      'Este teléfono no tiene huella ni rostro configurados. Ingresa con tu contraseña.',
    );
  }
  const resultado = await LocalAuthentication.authenticateAsync({
    promptMessage: motivo,
    cancelLabel: 'Usar contraseña',
    disableDeviceFallback: false,
  });
  return resultado.success;
}

export async function estaHabilitada(): Promise<boolean> {
  return preferencias.leerBiometriaHabilitada();
}

export async function habilitar(habilitada: boolean): Promise<void> {
  if (habilitada) {
    const estado = await disponibilidad();
    if (!estado.hayRegistro) {
      throw new ErrorServicio(
        CODIGOS.BIOMETRIA_NO_DISPONIBLE,
        'No hay huella ni rostro configurados en este teléfono.',
      );
    }
  }
  await preferencias.guardarBiometriaHabilitada(habilitada);
}