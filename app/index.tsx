/**
 * Punto de entrada. No dibuja nada propio: decide a donde va el usuario segun la sesion.
 */
import { Redirect } from 'expo-router';

import { rutaSegunSesion, useSesion } from '@/contexto/ContextoSesion';
import { EstadoCarga, Pantalla } from '@/ui';

export default function Inicio() {
  const { estado, usuario } = useSesion();

  if (estado === 'cargando') {
    return (
      <Pantalla desplazable={false}>
        <EstadoCarga texto="Abriendo Reporte Ciudadano..." />
      </Pantalla>
    );
  }

  return <Redirect href={rutaSegunSesion(estado, usuario?.rol)} />;
}
