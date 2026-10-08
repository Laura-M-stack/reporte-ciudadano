/**
 * Ajustes del operador. Persona 1.
 */
import { useSesion } from '@/contexto/ContextoSesion';
import { Boton, Pantalla, Parrafo, Tarjeta, Titulo } from '@/ui';

export default function AjustesOperador() {
  const { usuario, salir } = useSesion();

  return (
    <Pantalla>
      <Titulo>Ajustes</Titulo>
      <Tarjeta>
        <Parrafo>{usuario?.nombre}</Parrafo>
        <Parrafo suave>{usuario?.email}</Parrafo>
        <Parrafo suave>Zona asignada: {usuario?.zonaId ?? 'todas'}</Parrafo>
      </Tarjeta>
      <Boton titulo="Cerrar sesion" variante="secundario" alTocar={() => void salir()} />
    </Pantalla>
  );
}
