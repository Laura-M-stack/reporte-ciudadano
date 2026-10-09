/**
 * Mapa con un punto que se puede arrastrar. Es el "corregir en el mapa" del mockup del PRD.
 *
 * Dos reglas que vienen del PRD y estan implementadas aca:
 *  - Si el GPS erro, el vecino corrige el punto arrastrandolo.
 *  - Si nego el permiso de ubicacion, igual puede reportar: el mapa abre centrado en
 *    Gualeguaychu y el punto se pone tocando el mapa.
 */
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { CENTRO_GUALEGUAYCHU } from '../servicios/ubicacion';
import { colores, radios } from '../tema';
import type { Coordenadas } from '../tipos';

/** Zoom de media cuadra, que es la precision que necesita una cuadrilla para encontrar el pozo. */
const DELTA = 0.004;

export function SelectorUbicacion({
  punto,
  alMover,
  alto = 260,
}: {
  punto: Coordenadas | null;
  alMover: (coordenadas: Coordenadas) => void;
  alto?: number;
}) {
  const centro = punto ?? CENTRO_GUALEGUAYCHU;
  const mapa = useRef<MapView>(null);
  const yaCentrado = useRef(false);

  /**
   * `initialRegion` se evalua UNA sola vez, en el primer render. En ese momento todavia no
   * llego la ubicacion del GPS, asi que el mapa queda centrado en Gualeguaychu; cuando la
   * ubicacion llega, el marcador se dibuja en la posicion real y puede quedar fuera de la
   * pantalla (si el vecino no esta en la ciudad, a cientos de kilometros).
   *
   * Por eso, la primera vez que llega un punto, movemos la camara a mano. Solo la primera:
   * despues el vecino arrastra el marcador y seria molesto que el mapa se recentre solo.
   */
  useEffect(() => {
    if (!punto || yaCentrado.current) return;
    yaCentrado.current = true;
    mapa.current?.animateToRegion(
      {
        latitude: punto.latitud,
        longitude: punto.longitud,
        latitudeDelta: DELTA,
        longitudeDelta: DELTA,
      },
      500,
    );
  }, [punto]);

  return (
    <View style={[estilos.contenedor, { height: alto }]}>
      <MapView
        ref={mapa}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: centro.latitud,
          longitude: centro.longitud,
          latitudeDelta: DELTA,
          longitudeDelta: DELTA,
        }}
        // Tocar el mapa tambien mueve el punto: arrastrar un pin chiquito es dificil
        // para una mano de 70 anios.
        onPress={(evento) =>
          alMover({
            latitud: evento.nativeEvent.coordinate.latitude,
            longitud: evento.nativeEvent.coordinate.longitude,
          })
        }
      >
        {punto && (
          <Marker
            draggable
            coordinate={{ latitude: punto.latitud, longitude: punto.longitud }}
            pinColor={colores.acento}
            title="Acá esta el problema"
            description="Mantene apretado y arrastra para corregir"
            onDragEnd={(evento) =>
              alMover({
                latitud: evento.nativeEvent.coordinate.latitude,
                longitud: evento.nativeEvent.coordinate.longitude,
              })
            }
          />
        )}
      </MapView>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    borderRadius: radios.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colores.borde,
    backgroundColor: colores.superficieSuave,
  },
});
