/**
 * Ubicacion del dispositivo (expo-location).
 *
 * Regla del PRD, no negociable: "Si niega la ubicacion, que igual pueda reportar poniendo
 * el punto a mano en el mapa". Por eso ninguna funcion de aca lanza error cuando el vecino
 * dice que no: devuelve un resultado que la pantalla sabe manejar.
 *
 * Distinto es la camara: sin foto no hay reporte. Esa SI bloquea.
 */
import * as Location from 'expo-location';

import { comoErrorServicio } from '../errores';
import type { Coordenadas } from '../tipos';

/** Centro de Gualeguaychu. Es donde arranca el mapa cuando no sabemos donde esta el vecino. */
export const CENTRO_GUALEGUAYCHU: Coordenadas = { latitud: -33.0095, longitud: -58.5172 };

export interface ResultadoUbicacion {
  /** Null si el vecino nego el permiso o el GPS no respondio. */
  coordenadas: Coordenadas | null;
  /** Precision informada por el GPS, en metros. Util para avisar "el GPS no esta fino". */
  precisionM: number | null;
  permisoConcedido: boolean;
  /** true si el sistema ya no vuelve a preguntar: hay que mandarlo a Configuracion. */
  puedeVolverAPreguntar: boolean;
}

export async function pedirPermisoUbicacion(): Promise<{
  concedido: boolean;
  puedeVolverAPreguntar: boolean;
}> {
  try {
    const actual = await Location.getForegroundPermissionsAsync();
    if (actual.granted) return { concedido: true, puedeVolverAPreguntar: true };
    const pedido = await Location.requestForegroundPermissionsAsync();
    return { concedido: pedido.granted, puedeVolverAPreguntar: pedido.canAskAgain };
  } catch {
    return { concedido: false, puedeVolverAPreguntar: false };
  }
}

/**
 * Posicion actual. Nunca lanza: si no se puede, devuelve coordenadas en null y la pantalla
 * muestra el mapa centrado en Gualeguaychu para que el vecino marque el punto a mano.
 */
export async function ubicacionActual(): Promise<ResultadoUbicacion> {
  const permiso = await pedirPermisoUbicacion();
  if (!permiso.concedido) {
    return {
      coordenadas: null,
      precisionM: null,
      permisoConcedido: false,
      puedeVolverAPreguntar: permiso.puedeVolverAPreguntar,
    };
  }

  try {
    const posicion = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      coordenadas: {
        latitud: posicion.coords.latitude,
        longitud: posicion.coords.longitude,
      },
      precisionM: posicion.coords.accuracy ?? null,
      permisoConcedido: true,
      puedeVolverAPreguntar: true,
    };
  } catch (e) {
    void comoErrorServicio(e);
    return {
      coordenadas: null,
      precisionM: null,
      permisoConcedido: true,
      puedeVolverAPreguntar: true,
    };
  }
}

/** Texto que se muestra cuando no se pudo resolver la calle. S-03. */
export const DIRECCION_SIN_RESOLVER = 'Punto marcado en el mapa';

/**
 * Calle y altura a partir del punto. Si falla (sin red, sin resultados), devuelve el texto
 * generico: el punto es el dato que vale, la direccion es una ayuda para el operador.
 */
export async function direccionDe(coordenadas: Coordenadas): Promise<string> {
  try {
    const resultados = await Location.reverseGeocodeAsync({
      latitude: coordenadas.latitud,
      longitude: coordenadas.longitud,
    });
    const primero = resultados[0];
    if (!primero) return DIRECCION_SIN_RESOLVER;

    const calle = primero.street?.trim();
    const altura = primero.streetNumber?.trim();
    if (calle && altura) return `${calle} ${altura}`;
    if (calle) return calle;
    if (primero.name?.trim()) return primero.name.trim();
    return DIRECCION_SIN_RESOLVER;
  } catch {
    return DIRECCION_SIN_RESOLVER;
  }
}

/** Abre la pantalla de permisos de la app. Para cuando el sistema ya no vuelve a preguntar. */
export async function abrirConfiguracion(): Promise<void> {
  const { Linking } = await import('react-native');
  await Linking.openSettings();
}
