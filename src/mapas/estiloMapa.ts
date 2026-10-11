/**
 * Estilo del mapa para MapLibre: mosaicos raster de OpenStreetMap, sin clave ni tarjeta.
 *
 * Decisión del equipo (ver README, "Mapas con MapLibre"): se descarta Google Maps porque
 * exige asociar una forma de pago, aunque el SKU de apps nativas no cobre. MapLibre no pide
 * clave y es la base GL nativa; con un estilo "raster" se puede dibujar mosaicos tipo
 * Google/OSM clásicos sin tocar la lógica de capas vectoriales.
 *
 * SUPUESTO S-15: tile.openstreetmap.org tiene una política de uso que desaconseja (y puede
 * bloquear) el consumo "en bruto" desde una app sin cache propia:
 * https://operations.osmfoundation.org/policies/tiles/
 * Para esta entrega académica el volumen de uso es bajo y se acepta el riesgo; para un uso
 * real habría que levantar un proxy con cache propio o pasar a un proveedor con cuota
 * gratuita pensado para esto (MapTiler, Stadia Maps, etc. — piden clave igual que Google,
 * pero con capa gratuita más generosa y sin pedir tarjeta). Se documenta en vez de usarlo
 * como si no tuviera costo ni riesgo.
 */
import type { StyleSpecification } from '@maplibre/maplibre-react-native';

export const ESTILO_OSM_RASTER: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};
