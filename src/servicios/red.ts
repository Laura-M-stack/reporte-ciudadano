/**
 * Estado de la red (expo-network). Lo usan el aviso de "sin conexion" y el disparador
 * de la cola offline.
 */
import * as Network from 'expo-network';

export interface EstadoRed {
  hayConexion: boolean;
  /** null cuando el sistema no sabe decirlo (pasa en algunos Android). */
  internetAlcanzable: boolean | null;
  tipo: string | null;
}

export async function estadoRed(): Promise<EstadoRed> {
  try {
    const estado = await Network.getNetworkStateAsync();
    return {
      hayConexion: Boolean(estado.isConnected),
      internetAlcanzable: estado.isInternetReachable ?? null,
      tipo: estado.type ?? null,
    };
  } catch {
    // Si no se puede consultar, asumimos que hay red y dejamos que falle el fetch:
    // es preferible a bloquear al vecino por un falso negativo.
    return { hayConexion: true, internetAlcanzable: null, tipo: null };
  }
}

export async function hayInternet(): Promise<boolean> {
  const estado = await estadoRed();
  return estado.hayConexion && estado.internetAlcanzable !== false;
}

/** Devuelve la funcion para desuscribirse. */
export function escucharRed(alCambiar: (estado: EstadoRed) => void): () => void {
  const suscripcion = Network.addNetworkStateListener((estado) => {
    alCambiar({
      hayConexion: Boolean(estado.isConnected),
      internetAlcanzable: estado.isInternetReachable ?? null,
      tipo: estado.type ?? null,
    });
  });
  return () => suscripcion.remove();
}
