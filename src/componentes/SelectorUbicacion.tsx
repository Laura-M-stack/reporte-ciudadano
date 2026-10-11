/**
 * Mapa con un punto que se puede corregir. Es el "corregir en el mapa" del mockup del PRD.
 *
 * Dos reglas que vienen del PRD y estan implementadas aca:
 *  - Si el GPS erro, el vecino corrige el punto tocando el mapa en el lugar correcto.
 *  - Si nego el permiso de ubicacion, igual puede reportar: el mapa abre centrado en
 *    Gualeguaychu y el punto se pone tocando el mapa.
 *
 * MIGRADO A MAPLIBRE. El equipo decidio no conseguir una clave real de Google Maps y usar
 * MapLibre (motor GL nativo, sin clave) con mosaicos de OpenStreetMap — ver README y S-15.
 * Como consecuencia se sacó la sonda de diagnostico "montando/listo/dibujado" que existia
 * solo para distinguir "el SDK de Google no arranca" de "el SDK arranca pero la clave esta
 * mal": ese problema ya no existe porque no hay SDK de Google ni clave.
 *
 * SIN ARRASTRE DEL PIN (cambio respecto a la version con react-native-maps): el `Marker` de
 * `@maplibre/maplibre-react-native` 11.x (API leida directo de
 * node_modules/@maplibre/maplibre-react-native/src, no de la documentacion — ver mas abajo)
 * no tiene props `draggable`/`onDragEnd`; es una View nativa posicionada por coordenada, sin
 * gesto de arrastre incorporado. La correccion del punto queda SOLO por "tocar el mapa"
 * (`onPress` de `Map`), que ya cubre lo que pide el PRD ("si nego el permiso, se marca
 * tocando"). Arrastrar el pin se podria agregar despues con PanResponder + `mapRef.unproject`,
 * pero es un round-trip asincronico por cada movimiento y no vale la complejidad para esta
 * entrega.
 *
 * OJO CON LAS COORDENADAS: MapLibre usa tuplas `[longitud, latitud]` (`LngLat`), al reves que
 * el tipo `Coordenadas` de este proyecto (`{ latitud, longitud }`). La conversion queda
 * aislada aca, en los dos bordes (lo que se le pasa al mapa, y lo que llega de sus eventos).
 */
import { Camera, type CameraRef, Map, Marker } from '@maplibre/maplibre-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { ESTILO_OSM_RASTER } from '../mapas/estiloMapa';
import { CENTRO_GUALEGUAYCHU } from '../servicios/ubicacion';
import { colores, radios } from '../tema';
import type { Coordenadas } from '../tipos';

/** Zoom de media cuadra, que es la precision que necesita una cuadrilla para encontrar el pozo. */
const ZOOM = 17;

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
  const camara = useRef<CameraRef>(null);
  const yaCentrado = useRef(false);

  /**
   * El mapa arranca centrado en Gualeguaychu (al montar todavia no llego la ubicacion real
   * del GPS). La primera vez que llega un punto real, movemos la camara a mano; despues el
   * vecino toca el mapa para corregir y no queremos que se recentre solo.
   */
  useEffect(() => {
    if (!punto || yaCentrado.current) return;
    yaCentrado.current = true;
    camara.current?.flyTo({
      center: [punto.longitud, punto.latitud],
      zoom: ZOOM,
      duration: 500,
    });
  }, [punto]);

  return (
    <View style={[estilos.contenedor, { height: alto }]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={ESTILO_OSM_RASTER}
        // Tocar el mapa mueve el punto: es como se corrige la ubicacion con este mapa
        // (sin arrastre de pin, ver el comentario de arriba del archivo).
        onPress={(evento) => {
          const [longitud, latitud] = evento.nativeEvent.lngLat;
          alMover({ latitud, longitud });
        }}
      >
        <Camera
          ref={camara}
          initialViewState={{
            center: [centro.longitud, centro.latitud],
            zoom: ZOOM,
          }}
        />

        {punto && (
          <Marker id="punto-seleccionado" lngLat={[punto.longitud, punto.latitud]}>
            <View style={estilos.pin} />
          </Marker>
        )}
      </Map>
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
  pin: {
    width: 28,
    height: 28,
    borderRadius: radios.completo,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: colores.acento,
  },
});
