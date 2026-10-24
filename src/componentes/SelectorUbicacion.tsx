import { Camera, type CameraRef, Map, Marker } from '@maplibre/maplibre-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { ESTILO_OSM_RASTER } from '../mapas/estiloMapa';
import { CENTRO_GUALEGUAYCHU } from '../servicios/ubicacion';
import { colores, radios } from '../tema';
import type { Coordenadas } from '../tipos';
import { distanciaEnMetros } from '../utils/geo';

const ZOOM = 17;

const UMBRAL_RECENTRADO_M = 300;

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
  const anterior = useRef<Coordenadas | null>(null);

  useEffect(() => {
    if (!punto) return;
    const esSalto = !anterior.current || distanciaEnMetros(anterior.current, punto) > UMBRAL_RECENTRADO_M;
    anterior.current = punto;
    if (!esSalto) return;
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
