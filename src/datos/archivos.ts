/**
 * Guardado de fotos y audio en el telefono, con la API NUEVA de expo-file-system
 * (File, Directory, Paths). La API vieja (FileSystem.documentDirectory, copyAsync, etc.)
 * tira error en tiempo de ejecucion en esta version: el PRD lo aclara expresamente.
 *
 * Los adjuntos viven aca hasta que el reporte se sube; recien ahi se pueden borrar.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { CODIGOS, ErrorServicio, comoErrorServicio } from '../errores';

const CARPETA_ADJUNTOS = 'adjuntos';

/** Carpeta propia dentro del sandbox de la app, creada si no existe. */
export function carpetaAdjuntos(): Directory {
  const dir = new Directory(Paths.document, CARPETA_ADJUNTOS);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Copia un archivo temporal (el que devuelven la camara o el grabador) a la carpeta
 * de la app, con un nombre estable. Devuelve la uri definitiva.
 *
 * Por que copiar: las uris de expo-camera y expo-image-picker apuntan a la cache del
 * sistema y el SO las puede borrar cuando quiera. Si el reporte espera dos dias en la
 * cola sin senal, el archivo tiene que seguir existiendo.
 */
export function guardarAdjunto(uriOrigen: string, nombreDestino: string): string {
  try {
    const origen = new File(uriOrigen);
    if (!origen.exists) {
      throw new ErrorServicio(
        CODIGOS.ERROR_ARCHIVO,
        'El archivo que devolvio la cámara ya no existe.',
        { detalles: { uriOrigen } },
      );
    }
    const destino = new File(carpetaAdjuntos(), nombreDestino);
    if (destino.exists) destino.delete();
    origen.copy(destino);
    return destino.uri;
  } catch (e) {
    throw comoErrorServicio(e, CODIGOS.ERROR_ARCHIVO, 'No se pudo guardar el archivo.');
  }
}

export function tamanoBytes(uri: string): number | null {
  try {
    return new File(uri).size ?? null;
  } catch {
    return null;
  }
}

export function existeAdjunto(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export function borrarAdjunto(uri: string): void {
  try {
    const archivo = new File(uri);
    if (archivo.exists) archivo.delete();
  } catch {
    // Un adjunto que no se pudo borrar no justifica romperle la pantalla al vecino.
  }
}

/** Espacio que ocupan los adjuntos pendientes. Sirve para la pantalla de ajustes. */
export function tamanoTotalAdjuntos(): number {
  try {
    return carpetaAdjuntos()
      .list()
      .reduce((total, entrada) => total + (entrada instanceof File ? (entrada.size ?? 0) : 0), 0);
  } catch {
    return 0;
  }
}
