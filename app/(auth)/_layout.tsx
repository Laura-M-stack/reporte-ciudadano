/**
 * Guard de las pantallas publicas. Si ya hay sesion activa, no tiene sentido mostrar
 * el ingreso: se manda al usuario a su seccion segun el rol.
 */
import { Redirect, Stack } from 'expo-router';

import { useSesion } from '@/contexto/ContextoSesion';

export default function LayoutAuth() {
  const { estado, usuario } = useSesion();

  if (estado === 'activa') {
    return <Redirect href={usuario?.rol === 'operador' ? '/(operador)/bandeja' : '/(vecino)/reportar'} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
