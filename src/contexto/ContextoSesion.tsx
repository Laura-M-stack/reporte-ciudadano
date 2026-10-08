/**
 * Contexto de sesion. Es la unica fuente de verdad sobre quien esta usando la app.
 *
 * Estados posibles:
 *   cargando   -> todavia estamos leyendo el almacen seguro (se muestra el splash)
 *   anonimo    -> no hay sesion: van las pantallas de (auth)
 *   bloqueada  -> hay sesion guardada pero pide huella/rostro para reingresar
 *   activa     -> hay sesion usable
 *
 * El guard de navegacion vive en los _layout de cada grupo de rutas y solo mira este estado.
 * Ninguna pantalla lee el token: para eso esta useSesion().
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { comoErrorServicio, esErrorServicio } from '../errores';
import * as auth from '../servicios/auth';
import * as biometria from '../servicios/biometria';
import type { Credenciales, DatosRegistro, Rol, Usuario } from '../tipos';

export type EstadoSesion = 'cargando' | 'anonimo' | 'bloqueada' | 'activa';

export interface ValorSesion {
  estado: EstadoSesion;
  usuario: Usuario | null;
  esOperador: boolean;
  /** true si el telefono puede pedir huella/rostro y el usuario lo activo. */
  biometriaDisponible: boolean;
  ingresar(credenciales: Credenciales): Promise<void>;
  registrar(datos: DatosRegistro): Promise<void>;
  salir(): Promise<void>;
  /** Reingreso con huella/rostro. Devuelve false si el usuario cancelo. */
  desbloquearConBiometria(): Promise<boolean>;
  /** "Prefiero usar mi contraseña": manda a la pantalla de ingreso sin borrar nada. */
  usarContrasena(): void;
  refrescar(): Promise<void>;
}

const Contexto = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>('cargando');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [biometriaDisponible, setBiometriaDisponible] = useState(false);

  // Restaurar la sesion al arrancar. Requisito 2 de la catedra: la sesion sobrevive
  // al cierre de la app.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const sesion = await auth.sesionGuardada();
        if (!vivo) return;
        if (!sesion) {
          setEstado('anonimo');
          return;
        }
        setUsuario(sesion.usuario);

        const [habilitada, estadoSensor] = await Promise.all([
          biometria.estaHabilitada(),
          biometria.disponibilidad(),
        ]);
        if (!vivo) return;
        const puedeBiometria = habilitada && estadoSensor.hayRegistro;
        setBiometriaDisponible(puedeBiometria);
        // Si el usuario la activo, la app arranca bloqueada y pide huella.
        // Si no, la sesion entra directo: no se le traba la app a nadie por no tener sensor.
        setEstado(puedeBiometria ? 'bloqueada' : 'activa');
      } catch {
        if (vivo) setEstado('anonimo');
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const ingresar = useCallback(async (credenciales: Credenciales) => {
    const sesion = await auth.ingresar(credenciales);
    setUsuario(sesion.usuario);
    setEstado('activa');
    const estadoSensor = await biometria.disponibilidad();
    setBiometriaDisponible(estadoSensor.hayRegistro && (await biometria.estaHabilitada()));
  }, []);

  const registrar = useCallback(async (datos: DatosRegistro) => {
    const sesion = await auth.registrar(datos);
    setUsuario(sesion.usuario);
    setEstado('activa');
  }, []);

  const salir = useCallback(async () => {
    await auth.cerrarSesion();
    setUsuario(null);
    setBiometriaDisponible(false);
    setEstado('anonimo');
  }, []);

  const desbloquearConBiometria = useCallback(async () => {
    try {
      const ok = await biometria.autenticar('Ingresa a Reporte Ciudadano');
      if (ok) setEstado('activa');
      return ok;
    } catch (e) {
      // Sin sensor no se puede quedar trabado: se cae a contrasena.
      if (esErrorServicio(e)) {
        setEstado('anonimo');
        return false;
      }
      throw comoErrorServicio(e);
    }
  }, []);

  const usarContrasena = useCallback(() => {
    setEstado('anonimo');
  }, []);

  const refrescar = useCallback(async () => {
    const actualizado = await auth.refrescarUsuario();
    if (actualizado) setUsuario(actualizado);
  }, []);

  const valor = useMemo<ValorSesion>(
    () => ({
      estado,
      usuario,
      esOperador: usuario?.rol === 'operador',
      biometriaDisponible,
      ingresar,
      registrar,
      salir,
      desbloquearConBiometria,
      usarContrasena,
      refrescar,
    }),
    [
      estado,
      usuario,
      biometriaDisponible,
      ingresar,
      registrar,
      salir,
      desbloquearConBiometria,
      usarContrasena,
      refrescar,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error('useSesion() se uso fuera de <ProveedorSesion>. Revisar app/_layout.tsx.');
  }
  return valor;
}

/**
 * Ruta a la que corresponde mandar a cada usuario. Lo usan los guards para no repetir
 * la misma cadena de ifs en cada _layout.
 */
export type RutaInicial =
  | '/(auth)/ingresar'
  | '/(auth)/desbloquear'
  | '/(vecino)/reportar'
  | '/(operador)/bandeja';

export function rutaSegunSesion(estado: EstadoSesion, rol: Rol | undefined): RutaInicial {
  if (estado === 'bloqueada') return '/(auth)/desbloquear';
  if (estado !== 'activa') return '/(auth)/ingresar';
  return rol === 'operador' ? '/(operador)/bandeja' : '/(vecino)/reportar';
}
