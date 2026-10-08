/**
 * Cuadrillas por zona. Persona 4.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';

import { listarCuadrillas, listarZonas } from '@/servicios/catalogos';
import { espacio } from '@/tema';
import type { Cuadrilla, Zona } from '@/tipos';
import { EstadoCarga, EstadoError, EstadoVacio, Parrafo, Subtitulo, Tarjeta, Titulo } from '@/ui';

export default function Cuadrillas() {
  const [datos, setDatos] = useState<{ zonas: Zona[]; cuadrillas: Cuadrilla[] } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const cargar = useCallback(async () => {
    setError(null);
    setDatos(null);
    try {
      const [zonas, cuadrillas] = await Promise.all([listarZonas(), listarCuadrillas()]);
      setDatos({ zonas, cuadrillas });
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    // El reset de estado antes del await es intencional (limpia el error previo al recargar); cuesta un render extra al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  if (error) return <ScrollView contentContainerStyle={{ padding: espacio.md }}><EstadoError error={error} alReintentar={cargar} /></ScrollView>;
  if (!datos) return <EstadoCarga texto="Cargando cuadrillas..." />;

  return (
    <ScrollView contentContainerStyle={{ padding: espacio.md, gap: espacio.md }}>
      <Titulo>Cuadrillas</Titulo>
      {datos.zonas.map((zona) => {
        const propias = datos.cuadrillas.filter((c) => c.zonaId === zona.id);
        return (
          <Tarjeta key={zona.id}>
            <Subtitulo>{zona.nombre}</Subtitulo>
            <Parrafo suave>Referente: {zona.referente}</Parrafo>
            {propias.length === 0 ? (
              <Parrafo suave>Sin cuadrillas cargadas.</Parrafo>
            ) : (
              propias.map((c) => (
                <Parrafo key={c.id}>
                  {c.nombre} - {c.especialidad}
                  {c.activa ? '' : ' (inactiva)'}
                </Parrafo>
              ))
            )}
          </Tarjeta>
        );
      })}
      {datos.zonas.length === 0 && (
        <EstadoVacio titulo="No hay zonas cargadas" detalle="La Municipalidad todavia no envío los límites." />
      )}
    </ScrollView>
  );
}
