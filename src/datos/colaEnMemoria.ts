/**
 * Repositorio de cola en memoria. Existe para dos cosas:
 *  1. Testear el servicio de cola sin SQLite (ver src/servicios/__tests__/cola.test.ts).
 *  2. Poder correr la app en web durante el desarrollo, donde expo-sqlite tiene limitaciones.
 *
 * No se usa en produccion: la instancia real esta cableada a repositorioColaSqlite.
 */
import type { ReporteEnCola } from '../tipos';

import type { FiltroCola, RepositorioCola } from './colaRepositorio';

export function crearRepositorioEnMemoria(inicial: ReporteEnCola[] = []): RepositorioCola & {
  contenido(): ReporteEnCola[];
} {
  const filas = new Map<string, ReporteEnCola>();
  for (const item of inicial) filas.set(item.idLocal, clonar(item));

  const ordenadas = (): ReporteEnCola[] =>
    [...filas.values()].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn)).map(clonar);

  return {
    async insertar(item) {
      filas.set(item.idLocal, clonar(item));
    },
    async actualizar(item) {
      if (!filas.has(item.idLocal)) return;
      filas.set(item.idLocal, clonar(item));
    },
    async obtener(idLocal) {
      const fila = filas.get(idLocal);
      return fila ? clonar(fila) : null;
    },
    async listar(filtro?: FiltroCola) {
      const todas = ordenadas();
      if (!filtro?.estados || filtro.estados.length === 0) return todas;
      return todas.filter((f) => filtro.estados!.includes(f.estadoEnvio));
    },
    async eliminar(idLocal) {
      filas.delete(idLocal);
    },
    async eliminarEnviadosAntesDe(iso) {
      let borradas = 0;
      for (const [clave, fila] of filas) {
        if (fila.estadoEnvio === 'enviado' && fila.actualizadoEn < iso) {
          filas.delete(clave);
          borradas++;
        }
      }
      return borradas;
    },
    contenido: ordenadas,
  };
}

/** Copia profunda barata: evita que el test mute la fila guardada por referencia. */
function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}
