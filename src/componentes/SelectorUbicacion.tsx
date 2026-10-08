/**
 * Mapa con un punto que se puede arrastrar. Es el "corregir en el mapa" del mockup del PRD.
 *
 * Dos reglas que vienen del PRD y estan implementadas aca:
 *  - Si el GPS erro, el vecino corrige el punto arrastrandolo.
 *  - Si nego el permiso de ubicacion, igual puede reportar: el mapa abre centrado en
 *    Gualeguaychu y el punto se pone tocando el mapa.
 */
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
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

  return (
    <View style={[estilos.contenedor, { height: alto }]}>
      <MapView
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
