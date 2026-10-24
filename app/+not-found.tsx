import { Link, Stack } from 'expo-router';

import { Pantalla, Parrafo, Titulo } from '@/ui';

export default function NoEncontrada() {
  return (
    <>
      <Stack.Screen options={{ title: 'No encontramos esa pantalla' }} />
      <Pantalla>
        <Titulo>No encontramos esa pantalla</Titulo>
        <Parrafo suave>Puede que el enlace esté mal o que la pantalla ya no exista.</Parrafo>
        <Link href="/">
          <Parrafo>Volver al inicio</Parrafo>
        </Link>
      </Pantalla>
    </>
  );
}
