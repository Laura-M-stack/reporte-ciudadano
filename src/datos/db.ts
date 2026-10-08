/**
 * Base SQLite local. Unico lugar de la app que abre la base y corre migraciones.
 * Nadie mas importa expo-sqlite (hay una regla de ESLint que lo bloquea desde app/).
 *
 * Que guardamos aca y por que:
 *  - cola_reportes: los reportes creados sin senal. Es el corazon del requisito offline.
 *  - reportes_cache: copia de los ultimos reportes traidos de la API, para que la app
 *    abra y muestre algo sin conexion y para poder detectar duplicados a 50 m offline.
 *  - zonas_cache / cuadrillas_cache: idem, ademas el calculo de zona necesita los poligonos
 *    aunque no haya red.
 *
 * Las preferencias y la sesion NO van aca: van a expo-sqlite/kv-store (preferencias.ts)
 * y a expo-secure-store (sesionSegura.ts), como pide el PRD.
 */
import * as SQLite from 'expo-sqlite';

import { CODIGOS, ErrorServicio, comoErrorServicio } from '../errores';

export const NOMBRE_BASE = 'reporte-ciudadano.db';

/** Subir de a uno cuando se agrega una migracion. */
const VERSION_ESQUEMA = 1;

let instancia: SQLite.SQLiteDatabase | null = null;
let abriendo: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRACIONES: string[] = [
  // v1 — esquema inicial
  `
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS cola_reportes (
    id_local      TEXT PRIMARY KEY NOT NULL,
    borrador      TEXT NOT NULL,
    estado_envio  TEXT NOT NULL DEFAULT 'pendiente',
    intentos      INTEGER NOT NULL DEFAULT 0,
    ultimo_error  TEXT,
    creado_en     TEXT NOT NULL,
    actualizado_en TEXT NOT NULL,
    id_remoto     TEXT,
    codigo_remoto TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_cola_estado ON cola_reportes (estado_envio, creado_en);

  CREATE TABLE IF NOT EXISTS reportes_cache (
    id         TEXT PRIMARY KEY NOT NULL,
    datos      TEXT NOT NULL,
    latitud    REAL NOT NULL,
    longitud   REAL NOT NULL,
    tipo_id    TEXT NOT NULL,
    estado     TEXT NOT NULL,
    autor_id   TEXT NOT NULL,
    creado_en  TEXT NOT NULL,
    guardado_en TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cache_autor ON reportes_cache (autor_id, creado_en);
  CREATE INDEX IF NOT EXISTS idx_cache_pos ON reportes_cache (latitud, longitud);

  CREATE TABLE IF NOT EXISTS zonas_cache (
    id    TEXT PRIMARY KEY NOT NULL,
    datos TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cuadrillas_cache (
    id      TEXT PRIMARY KEY NOT NULL,
    zona_id TEXT NOT NULL,
    datos   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cambios_estado_cache (
    id          TEXT PRIMARY KEY NOT NULL,
    reporte_id  TEXT NOT NULL,
    fecha_hora  TEXT NOT NULL,
    datos       TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cambios_reporte ON cambios_estado_cache (reporte_id, fecha_hora);
  `,
];

/**
 * Abre la base (una sola vez por proceso) y aplica las migraciones pendientes.
 * Se puede llamar desde cualquier lado: la promesa se comparte.
 */
export async function obtenerBase(): Promise<SQLite.SQLiteDatabase> {
  if (instancia) return instancia;
  if (abriendo) return abriendo;

  abriendo = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync(NOMBRE_BASE);
      await migrar(db);
      instancia = db;
      return db;
    } catch (e) {
      abriendo = null;
      throw comoErrorServicio(
        e,
        CODIGOS.ERROR_BASE_DATOS,
        'No se pudo abrir la base de datos del telefono.',
      );
    }
  })();

  return abriendo;
}

async function migrar(db: SQLite.SQLiteDatabase): Promise<void> {
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const versionActual = fila?.user_version ?? 0;
  if (versionActual >= VERSION_ESQUEMA) return;

  for (let v = versionActual; v < VERSION_ESQUEMA; v++) {
    const sql = MIGRACIONES[v];
    if (!sql) {
      throw new ErrorServicio(
        CODIGOS.ERROR_BASE_DATOS,
        `Falta la migracion ${v + 1} del esquema local.`,
      );
    }
    await db.execAsync(sql);
  }
  await db.execAsync(`PRAGMA user_version = ${VERSION_ESQUEMA}`);
}

/** Solo para tests y para "cerrar sesion y borrar todo". */
export async function cerrarBase(): Promise<void> {
  if (!instancia) return;
  await instancia.closeAsync();
  instancia = null;
  abriendo = null;
}

/**
 * Borra los datos locales del usuario. Se llama al cerrar sesion.
 * OJO: no borra la cola si quedaron reportes sin subir; eso se avisa antes (ver S-08).
 */
export async function vaciarCache(): Promise<void> {
  const db = await obtenerBase();
  await db.execAsync(`
    DELETE FROM reportes_cache;
    DELETE FROM cambios_estado_cache;
  `);
}
