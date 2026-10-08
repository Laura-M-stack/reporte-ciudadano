/**
 * Preferencias y datos no sensibles, en expo-sqlite/kv-store (la API sincrona tipo
 * localStorage que reemplaza a AsyncStorage). PRD: "expo-sqlite/kv-store para preferencias
 * y sesion". El token NO va aca.
 */
import Storage from 'expo-sqlite/kv-store';

import type { Usuario } from '../tipos';

const CLAVES = {
  usuario: 'usuario',
  avisosActivos: 'avisos_activos',
  biometriaHabilitada: 'biometria_habilitada',
  ultimaSincronizacion: 'ultima_sincronizacion',
  borradorEnCurso: 'borrador_en_curso',
  tutorialVisto: 'tutorial_visto',
} as const;

async function leerJson<T>(clave: string): Promise<T | null> {
  const texto = await Storage.getItem(clave);
  if (!texto) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    // Valor corrupto: lo tiramos en vez de arrastrar el problema.
    await Storage.removeItem(clave);
    return null;
  }
}

async function guardarJson(clave: string, valor: unknown): Promise<void> {
  await Storage.setItem(clave, JSON.stringify(valor));
}

export const preferencias = {
  async guardarUsuario(usuario: Usuario): Promise<void> {
    await guardarJson(CLAVES.usuario, usuario);
  },
  leerUsuario(): Promise<Usuario | null> {
    return leerJson<Usuario>(CLAVES.usuario);
  },
  async borrarUsuario(): Promise<void> {
    await Storage.removeItem(CLAVES.usuario);
  },

  async leerAvisosActivos(): Promise<boolean> {
    const v = await Storage.getItem(CLAVES.avisosActivos);
    return v === null ? true : v === 'true';
  },
  async guardarAvisosActivos(activos: boolean): Promise<void> {
    await Storage.setItem(CLAVES.avisosActivos, String(activos));
  },

  async leerBiometriaHabilitada(): Promise<boolean> {
    return (await Storage.getItem(CLAVES.biometriaHabilitada)) === 'true';
  },
  async guardarBiometriaHabilitada(habilitada: boolean): Promise<void> {
    await Storage.setItem(CLAVES.biometriaHabilitada, String(habilitada));
  },

  async leerUltimaSincronizacion(): Promise<string | null> {
    return Storage.getItem(CLAVES.ultimaSincronizacion);
  },
  async guardarUltimaSincronizacion(iso: string): Promise<void> {
    await Storage.setItem(CLAVES.ultimaSincronizacion, iso);
  },

  /** Borrador en curso: si el vecino cierra la app a mitad de un reporte, no lo pierde. */
  leerBorradorEnCurso<T>(): Promise<T | null> {
    return leerJson<T>(CLAVES.borradorEnCurso);
  },
  async guardarBorradorEnCurso(borrador: unknown): Promise<void> {
    await guardarJson(CLAVES.borradorEnCurso, borrador);
  },
  async borrarBorradorEnCurso(): Promise<void> {
    await Storage.removeItem(CLAVES.borradorEnCurso);
  },

  /** Al cerrar sesion. No toca la cola de reportes sin subir. */
  async limpiarSesion(): Promise<void> {
    await Storage.removeItem(CLAVES.usuario);
    await Storage.removeItem(CLAVES.biometriaHabilitada);
  },
};
