/** Ubicación del dispositivo y búsqueda de dirección a partir de coordenadas. */
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

/** Ubicaciones de prueba visibles solo durante el desarrollo. */
export const PUNTOS_DE_PRUEBA: { nombre: string; punto: Coordenadas }[] = [
  { nombre: 'Zona Norte', punto: { latitud: -32.975, longitud: -58.52 } },
  { nombre: 'Zona Centro', punto: { latitud: -33.0, longitud: -58.515 } },
  { nombre: 'Zona Sur', punto: { latitud: -33.025, longitud: -58.51 } },
  { nombre: 'Costanera', punto: { latitud: -33.055, longitud: -58.5 } },
  // Este punto permite probar la opción "Fuera de zona".
  { nombre: 'Fuera de zona', punto: { latitud: -33.2, longitud: -58.6 } },
];

/** Texto mostrado cuando no se pudo resolver la dirección. */
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

    // `name` suele traer el codigo postal cuando no hay calle (vimos "X0C 0B0"). Un codigo
    // postal no le dice nada a la cuadrilla que tiene que ir al lugar, asi que lo
    // descartamos y preferimos barrio o localidad, que al menos ubican.
    const nombre = primero.name?.trim();
    const pareceCodigoPostal =
      !!nombre && (/^[A-Z]\d{4}[A-Z]{3}$/i.test(nombre.replace(/\s/g, '')) ||
        /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(nombre) ||
        /^\d{4,}$/.test(nombre));
    if (nombre && !pareceCodigoPostal) return nombre;

    const barrio = primero.district?.trim();
    const localidad = primero.city?.trim() ?? primero.subregion?.trim();
    if (barrio && localidad) return `${barrio}, ${localidad}`;
    if (barrio) return barrio;
    if (localidad) return localidad;

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
