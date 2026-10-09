/**
 * Mapa con un punto que se puede arrastrar. Es el "corregir en el mapa" del mockup del PRD.
 *
 * Dos reglas que vienen del PRD y estan implementadas aca:
 *  - Si el GPS erro, el vecino corrige el punto arrastrandolo.
 *  - Si nego el permiso de ubicacion, igual puede reportar: el mapa abre centrado en
 *    Gualeguaychu y el punto se pone tocando el mapa.
 *
 * SONDA DE DIAGNOSTICO (temporal, solo en __DEV__)
 * El mapa se ve gris con el logo de Google y desde la terminal de Metro no se puede saber por
 * que: el SDK de Google Maps escribe sus errores en el logcat de Android, no en Metro. El
 * sintoma "gris con logo" tiene dos causas posibles y opuestas:
 *
 *   a) La vista nativa SI arranca pero no le llegan los mosaicos (clave rechazada, o sin red).
 *   b) La vista nativa NO arranca (modulo nativo incompatible, tamanio cero, etc).
 *
 * Para distinguirlas escuchamos los dos callbacks del ciclo de vida del mapa:
 *   - onMapReady  -> la vista nativa se creo y el SDK respondio.
 *   - onMapLoaded -> el mapa termino de DIBUJAR los mosaicos (solo Android).
 *
 * Como leer el cartelito que aparece arriba del mapa:
 *   "montando"  -> ni onMapReady llego. Es el caso (b): el problema es nativo, no la clave.
 *   "listo"     -> onMapReady llego pero onMapLoaded no. Es el caso (a): el mapa existe y no
 *                  consigue mosaicos. Clave rechazada o sin salida a internet.
 *   "dibujado"  -> el mapa cargo bien. Si aun asi se ve gris, el problema es de estilos
 *                  (algo tapa el mapa) y no del mapa.
 *
 * ESTO SE SACA cuando el mapa funcione. No va a la entrega.
 */
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CENTRO_GUALEGUAYCHU } from '../servicios/ubicacion';
import { colores, radios, tipografia } from '../tema';
import type { Coordenadas } from '../tipos';

/** Zoom de media cuadra, que es la precision que necesita una cuadrilla para encontrar el pozo. */
const DELTA = 0.004;

type EstadoMapa = 'montando' | 'listo' | 'dibujado';

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

  // Sonda de diagnostico. Ver el comentario de arriba.
  const [estadoMapa, setEstadoMapa] = useState<EstadoMapa>('montando');

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
        // Sonda de diagnostico, temporal.
        onMapReady={() => {
          console.log('[mapa] onMapReady: la vista nativa arranco');
          setEstadoMapa((previo) => (previo === 'dibujado' ? previo : 'listo'));
        }}
        onMapLoaded={() => {
          console.log('[mapa] onMapLoaded: los mosaicos se dibujaron');
          setEstadoMapa('dibujado');
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

      {/* Sonda de diagnostico, temporal. Se saca cuando el mapa funcione. */}
      {__DEV__ && (
        <View style={estilos.sonda} pointerEvents="none">
          <Text style={estilos.sondaTexto}>
            mapa: {estadoMapa} · {centro.latitud.toFixed(4)}, {centro.longitud.toFixed(4)}
          </Text>
        </View>
      )}
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
  sonda: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radios.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  sondaTexto: { ...tipografia.chico, fontSize: 11, color: '#FFFFFF', fontWeight: '700' },
});
