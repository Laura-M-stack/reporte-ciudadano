import * as ImagePicker from 'expo-image-picker';

import { CODIGOS, ErrorServicio, comoErrorServicio } from '../errores';
import { guardarAdjunto, tamanoBytes } from '../datos/archivos';
import type { AdjuntoLocal, MomentoFoto } from '../tipos';
import { nombreArchivoAdjunto, nuevoIdAdjunto } from '../utils';

export const MAX_BYTES_FOTO = 5 * 1024 * 1024;

function extensionDe(uri: string, porDefecto: string): string {
  const limpia = uri.split('?')[0] ?? uri;
  const punto = limpia.lastIndexOf('.');
  if (punto === -1 || punto < limpia.length - 6) return porDefecto;
  return limpia.slice(punto + 1).toLowerCase();
}

/** Guarda una foto (venga de la camara o de la galeria) y devuelve el adjunto tipado. */
export function registrarFoto(
  uriTemporal: string,
  momento: MomentoFoto = 'problema',
): AdjuntoLocal {
  const id = nuevoIdAdjunto();
  const uri = guardarAdjunto(uriTemporal, nombreArchivoAdjunto(id, extensionDe(uriTemporal, 'jpg')));
  const bytes = tamanoBytes(uri);

  if (bytes !== null && bytes > MAX_BYTES_FOTO) {
    // No la rechazamos: con senal intermitente es peor perder el reporte que tardar en subir.
    // Solo lo dejamos anotado para que la pantalla pueda avisar.
    console.warn(`Foto pesada (${Math.round(bytes / 1024)} KB): la subida puede tardar.`);
  }

  return { id, uri, tipo: 'foto', momento, urlRemota: null, tamanoBytes: bytes };
}

export function registrarAudio(uriTemporal: string): AdjuntoLocal {
  const id = nuevoIdAdjunto();
  const uri = guardarAdjunto(uriTemporal, nombreArchivoAdjunto(id, extensionDe(uriTemporal, 'm4a')));
  return {
    id,
    uri,
    tipo: 'audio',
    momento: 'problema',
    urlRemota: null,
    tamanoBytes: tamanoBytes(uri),
  };
}

export async function elegirDeGaleria(): Promise<AdjuntoLocal | null> {
  try {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      throw new ErrorServicio(
        CODIGOS.SIN_PERMISO,
        'Para elegir una foto guardada necesitamos permiso a tus fotos. También podés sacar una con la cámara.',
      );
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (resultado.canceled) return null;

    const elegida = resultado.assets[0];
    if (!elegida) return null;
    return registrarFoto(elegida.uri, 'problema');
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_ARCHIVO, 'No se pudo usar esa foto.');
  }
}
