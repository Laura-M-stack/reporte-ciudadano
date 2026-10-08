export type Rol = 'vecino' | 'operador';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  /** Solo para operadores. En vecinos viene null. */
  zonaId: string | null;
  avisosActivos: boolean;
  creadoEn: string;
}

/** Lo que se manda al endpoint de ingreso. */
export interface Credenciales {
  email: string;
  clave: string;
}

/** SUPUESTO (ver README, S-01): el registro publico solo crea vecinos. */
export interface DatosRegistro {
  nombre: string;
  email: string;
  clave: string;
  telefono: string | null;
}

/**
 * Lo que devuelve la API al autenticar. El token va a expo-secure-store; el usuario,
 * a kv-store (no es sensible y hace falta para pintar la UI antes de tener red).
 */
export interface Sesion {
  token: string;
  usuario: Usuario;
}
