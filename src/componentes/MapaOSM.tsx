/**
 * Configuracion compartida del mapa: mosaicos de OpenStreetMap en vez de Google Maps.
 *
 * POR QUE OSM Y NO GOOGLE
 * Google Maps en Android necesita una clave propia, y para obtenerla hace falta una cuenta
 * de Google Cloud con facturacion habilitada, habilitar "Maps SDK for Android" y restringir
 * la clave al paquete y al SHA-1 de cada build. Para un trabajo de facultad entregado como
 * APK eso es una fuente de problemas que no aporta nada: el mapa solo tiene que mostrar
 * calles y marcadores. OSM no pide clave.
 *
 * COMO FUNCIONA
 * `provider={null}` apaga el proveedor por defecto y `mapType="none"` oculta el mapa base,
 * asi que la vista queda vacia y encima se dibujan los mosaicos de OSM con <UrlTile>.
 *
 * ATRIBUCION: NO ES OPCIONAL
 * Los datos de OpenStreetMap estan bajo licencia ODbL, que EXIGE acreditar a los
 * colaboradores de forma visible. Por eso existe <AtribucionOSM /> y por eso va en las dos
 * pantallas que muestran mapa. Si alguien la saca, la app queda incumpliendo la licencia.
 *
 * LIMITE DE USO
 * El servidor publico de mosaicos de OSM es gratuito pero tiene una politica de uso: esta
 * pensado para trafico modesto, no para aplicaciones masivas. Para esta entrega y para la
 * defensa alcanza de sobra. Si la Municipalidad algun dia pone la app en produccion, hay que
 * pasar a un proveedor de mosaicos propio o contratado.
 * Politica: https://operations.osmfoundation.org/policies/tiles/
 */
import { StyleSheet, Text, View } from 'react-native';

import { colores, espacio, radios, tipografia } from '../tema';

/** Servidor publico de mosaicos de OpenStreetMap. */
export const URL_MOSAICOS_OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** OSM no publica mosaicos mas alla de este zoom. */
export const ZOOM_MAXIMO_OSM = 19;

/**
 * Acreditacion de OpenStreetMap. Obligatoria por licencia en toda pantalla con mapa.
 * Va arriba del mapa, en una esquina, como hace cualquier aplicacion que usa OSM.
 */
export function AtribucionOSM() {
  return (
    <View style={estilos.caja} pointerEvents="none">
      <Text style={estilos.texto}>© OpenStreetMap</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: {
    position: 'absolute',
    right: espacio.xs,
    bottom: espacio.xs,
    paddingHorizontal: espacio.sm,
    paddingVertical: 2,
    borderRadius: radios.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  texto: { ...tipografia.chico, fontSize: 11, color: colores.textoSuave },
});
