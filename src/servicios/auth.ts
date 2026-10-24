import { CODIGOS, ErrorServicio, comoErrorServicio } from '../errores';
import { preferencias } from '../datos/preferencias';
import { borrarToken, guardarToken, leerToken } from '../datos/sesionSegura';
import { DEMORA_MOCK_MS, EMAILS_DEMO, OPERADORA_DEMO, VECINO_DEMO, fallasSimuladas } from '../mocks';
import type { Credenciales, DatosRegistro, Sesion, Usuario } from '../tipos';
import { ahoraIso, nuevoUuid } from '../utils';

import { configurarToken, demorar, hayApi, pedir } from './http';

/** Largo minimo de contrasena. Si la API pide otra cosa, gana la API. */
export const LARGO_MINIMO_CLAVE = 6;

let tokenEnMemoria: string | null = null;

// El cliente HTTP no conoce SecureStore: le damos un proveedor de token en memoria, que se
// completa al ingresar o al restaurar la sesion guardada.
configurarToken(() => tokenEnMemoria);

function validarCredenciales(credenciales: Credenciales): void {
  const email = credenciales.email?.trim() ?? '';
  if (!email.includes('@')) {
    throw new ErrorServicio('EMAIL_INVALIDO', 'Escribi un correo válido.');
  }
  if ((credenciales.clave?.length ?? 0) < LARGO_MINIMO_CLAVE) {
    throw new ErrorServicio(
      'CLAVE_CORTA',
      `La contraseña tiene que tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`,
    );
  }
}

async function persistirSesion(sesion: Sesion): Promise<Sesion> {
  tokenEnMemoria = sesion.token;
  await guardarToken(sesion.token);
  await preferencias.guardarUsuario(sesion.usuario);
  return sesion;
}

export async function ingresar(credenciales: Credenciales): Promise<Sesion> {
  validarCredenciales(credenciales);

  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    const email = credenciales.email.trim().toLowerCase();
    const usuario: Usuario | null =
      email === EMAILS_DEMO.operador
        ? OPERADORA_DEMO
        : email === EMAILS_DEMO.vecino
          ? VECINO_DEMO
          : null;
    if (!usuario) {
      throw new ErrorServicio(
        CODIGOS.CREDENCIALES_INVALIDAS,
        'El correo o la contraseña no coinciden.',
      );
    }
    return persistirSesion({ token: `mock-${nuevoUuid()}`, usuario });
  }

  const sesion = await pedir<Sesion>('/auth/ingresar', {
    metodo: 'POST',
    cuerpo: { email: credenciales.email.trim().toLowerCase(), clave: credenciales.clave },
  });
  return persistirSesion(sesion);
}

export async function registrar(datos: DatosRegistro): Promise<Sesion> {
  validarCredenciales({ email: datos.email, clave: datos.clave });
  if (!datos.nombre?.trim()) {
    throw new ErrorServicio('NOMBRE_REQUERIDO', 'Escribi tu nombre y apellido.');
  }

  if (!hayApi()) {
    await demorar(DEMORA_MOCK_MS);
    fallasSimuladas.verificar();
    const usuario: Usuario = {
      id: `usr-${nuevoUuid().slice(0, 6)}`,
      nombre: datos.nombre.trim(),
      email: datos.email.trim().toLowerCase(),
      telefono: datos.telefono,
      rol: 'vecino',
      zonaId: null,
      avisosActivos: true,
      creadoEn: ahoraIso(),
    };
    return persistirSesion({ token: `mock-${nuevoUuid()}`, usuario });
  }

  const sesion = await pedir<Sesion>('/auth/registro', {
    metodo: 'POST',
    cuerpo: {
      nombre: datos.nombre.trim(),
      email: datos.email.trim().toLowerCase(),
      clave: datos.clave,
      telefono: datos.telefono,
    },
  });
  return persistirSesion(sesion);
}

/** Recupera la sesión guardada en el dispositivo. */
export async function sesionGuardada(): Promise<Sesion | null> {
  try {
    const token = await leerToken();
    const usuario = await preferencias.leerUsuario();
    if (!token || !usuario) return null;
    tokenEnMemoria = token;
    return { token, usuario };
  } catch (e) {
    // Si el almacen seguro falla, es preferible arrancar deslogueado que romper la app.
    void comoErrorServicio(e);
    return null;
  }
}

/** Refresca los datos del usuario (por ejemplo si le cambiaron el rol o la zona). */
export async function refrescarUsuario(): Promise<Usuario | null> {
  if (!tokenEnMemoria) return null;
  if (!hayApi()) return preferencias.leerUsuario();
  const usuario = await pedir<Usuario>('/auth/yo');
  await preferencias.guardarUsuario(usuario);
  return usuario;
}

/** Estado actual del interruptor de avisos. Las pantallas no leen preferencias directo. */
export function avisosActivos(): Promise<boolean> {
  return preferencias.leerAvisosActivos();
}

export async function actualizarAvisos(activos: boolean): Promise<void> {
  await preferencias.guardarAvisosActivos(activos);
  if (hayApi() && tokenEnMemoria) {
    await pedir<Usuario>('/auth/yo', { metodo: 'PATCH', cuerpo: { avisosActivos: activos } });
  }
}

/** Cierra la sesión sin eliminar los reportes pendientes de sincronización. */
export async function cerrarSesion(): Promise<void> {
  tokenEnMemoria = null;
  await borrarToken();
  await preferencias.limpiarSesion();
}

/** Solo para el contexto: saber si hay token cargado sin ir al almacen seguro. */
export function tokenActual(): string | null {
  return tokenEnMemoria;
}
