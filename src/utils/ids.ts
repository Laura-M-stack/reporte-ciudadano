/**
 * Identificadores locales.
 *
 * REGLA: los reportes creados en el telefono nacen con id "local-<uuid>", nunca con un
 * indice secuencial. Dos vecinos offline generarian "local-1" al mismo tiempo y al
 * sincronizar se pisarian. Ademas el idLocal viaja al servidor como clave de idempotencia:
 * si el POST se reintenta porque se corto la red despues de enviar, el servidor puede
 * reconocer que ya lo tiene en vez de crear un duplicado (ver P-08 en el README).
 */
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

/**
 * Código provisorio para mostrar en "Mis reclamos" mientras el reporte sigue en la cola
 * (responde P-02: la catedra confirmo que SI conviene mostrar algo, no dejar la pantalla
 * muda). No es el código oficial — ese lo asigna el servidor recien al sincronizar, y
 * hasta entonces ni existe. Se deriva del propio idLocal para que sea estable: el mismo
 * reporte pendiente siempre muestra el mismo código, en vez de uno al azar en cada render.
 */
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
