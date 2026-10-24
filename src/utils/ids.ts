import { randomUUID } from 'expo-crypto';

export const PREFIJO_LOCAL = 'local-';

/** UUID v4. expo-crypto usa el generador seguro del sistema operativo. */
export function nuevoUuid(): string {
  return randomUUID();
}

/** id de un reporte que todavia no existe en el servidor: "local-<uuid>". */
export function nuevoIdLocal(): string {
  return `${PREFIJO_LOCAL}${nuevoUuid()}`;
}

/** id de un adjunto (foto o audio) guardado en el telefono. */
export function nuevoIdAdjunto(): string {
  return `${PREFIJO_LOCAL}${nuevoUuid()}`;
}

export function esIdLocal(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(PREFIJO_LOCAL);
}

/** Código estable para identificar un reporte que todavía espera sincronización. */
export function codigoProvisorio(idLocal: string): string {
  const sinPrefijo = idLocal.startsWith(PREFIJO_LOCAL) ? idLocal.slice(PREFIJO_LOCAL.length) : idLocal;
  const soloHex = sinPrefijo.replace(/-/g, '').toUpperCase();
  return `LOCAL-${soloHex.slice(0, 8)}`;
}

/**
 * Nombre de archivo estable para un adjunto dentro del directorio de la app.
 * Ej: "local-3f2a....-problema.jpg"
 */
export function nombreArchivoAdjunto(idAdjunto: string, extension: string): string {
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;
  return `${idAdjunto}.${ext}`;
}
