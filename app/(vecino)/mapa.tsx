/**
 * Mapa publico de la ciudad.
 *
 * PRD: "Ver todos los reportes publicos sobre un mapa, con un color por estado",
 * "filtrar por tipo de problema y por estado", "ver que hay reportado cerca".
 *
 * Privacidad: en el mapa se ve el reporte, nunca quien lo hizo. Esta pantalla no muestra
 * autorId ni nombres, y tampoco los pide. Si la API los manda igual, el dato viaja al
 * telefono sin que lo usemos: por eso esta la pregunta P-10 al cliente.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import { listarTiposDeReporte } from '@/servicios/catalogos';
import { listarReportes } from '@/servicios/reportes';
import { CENTRO_GUALEGUAYCHU, ubicacionActual } from '@/servicios/ubicacion';
import { colores, coloresEstado, espacio, radios, tipografia } from '@/tema';
import {
  ESTADOS_REPORTE,
  ETIQUETAS_ESTADO,
  type Coordenadas,
  type EstadoReporte,
  type Reporte,
  type TipoDeReporte,
} from '@/tipos';
import { AtribucionOSM, URL_MOSAICOS_OSM, ZOOM_MAXIMO_OSM } from '@/componentes/MapaOSM';
import { EstadoCarga, EstadoError, EstadoVacio, Parrafo } from '@/ui';

/** Zoom inicial: la ciudad entera entra a esta escala. */
const DELTA_CIUDAD = 0.06;

export default function Mapa() {
  const router = useRouter();
  const [reportes, setReportes] = useState<Reporte[] | null>(null);
  const [tipos, setTipos] = useState<TipoDeReporte[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoReporte | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [yo, setYo] = useState<Coordenadas | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [pagina, listaTipos] = await Promise.all([
        listarReportes({ porPagina: 200 }),
        listarTiposDeReporte(),
      ]);
      setReportes(pagina.datos);
      setTipos(listaTipos);
    } catch (e) {
      setError(e);
    }
  }, []);

  // Se recarga al tomar foco: un reporte recien creado tiene que aparecer en el mapa.
  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  useEffect(() => {
    // Si no da permiso, el mapa igual se usa: arranca centrado en Gualeguaychú.
    void ubicacionActual().then((r) => setYo(r.coordenadas));
  }, []);

  // El filtrado es en memoria: ya tenemos los reportes y asi no hay un viaje a la API
  // por cada toque de filtro.
  const visibles = useMemo(() => {
    if (!reportes) return [];
    return reportes.filter((r) => {
      if (filtroEstado && r.estado !== filtroEstado) return false;
      if (filtroTipo && r.tipoId !== filtroTipo) return false;
      return true;
    });
  }, [reportes, filtroEstado, filtroTipo]);

  if (error) {
    return (
      <ScrollView contentContainerStyle={estilos.relleno}>
        <EstadoError error={error} alReintentar={cargar} />
      </ScrollView>
    );
  }
  if (!reportes) return <EstadoCarga texto="Cargando el mapa de la ciudad..." />;

  const centro = yo ?? CENTRO_GUALEGUAYCHU;

  return (
    <View style={estilos.pantalla}>
      {/* El contenedor da el marco para posicionar la atribucion sobre el mapa y no
          sobre el panel de filtros, que va debajo. */}
      <View style={estilos.contenedorMapa}>
        <MapView
        // Sin proveedor y sin mapa base: los mosaicos los pone OSM (ver MapaOSM.tsx).
        provider={null}
        mapType="none"
        style={estilos.mapa}
        showsUserLocation={!!yo}
        initialRegion={{
          latitude: centro.latitud,
          longitude: centro.longitud,
          latitudeDelta: yo ? 0.02 : DELTA_CIUDAD,
          longitudeDelta: yo ? 0.02 : DELTA_CIUDAD,
        }}
      >
        <UrlTile urlTemplate={URL_MOSAICOS_OSM} maximumZ={ZOOM_MAXIMO_OSM} />
        {visibles.map((reporte) => (
          <Marker
            key={reporte.id}
            coordinate={{
              latitude: reporte.coordenadas.latitud,
              longitude: reporte.coordenadas.longitud,
            }}
            // Un color por estado, el mismo que usan la lista y el detalle (src/tema).
            pinColor={coloresEstado[reporte.estado].punto}
            title={reporte.direccion}
            description={ETIQUETAS_ESTADO[reporte.estado]}
            onCalloutPress={() =>
              router.push({ pathname: '/reporte/[id]', params: { id: reporte.id } })
            }
          />
        ))}
        </MapView>
        <AtribucionOSM />
      </View>

      <View style={estilos.panel}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips}>
          <Chip texto="Todos" activo={filtroEstado === null} alTocar={() => setFiltroEstado(null)} />
          {ESTADOS_REPORTE.map((estado) => (
            <Chip
              key={estado}
              texto={ETIQUETAS_ESTADO[estado]}
              color={coloresEstado[estado].punto}
              activo={filtroEstado === estado}
              alTocar={() => setFiltroEstado(filtroEstado === estado ? null : estado)}
            />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips}>
          <Chip texto="Todo tipo" activo={filtroTipo === null} alTocar={() => setFiltroTipo(null)} />
          {tipos.map((tipo) => (
            <Chip
              key={tipo.id}
              texto={tipo.nombre}
              color={tipo.color}
              activo={filtroTipo === tipo.id}
              alTocar={() => setFiltroTipo(filtroTipo === tipo.id ? null : tipo.id)}
            />
          ))}
        </ScrollView>

        {visibles.length === 0 ? (
          <EstadoVacio
            titulo="No hay reportes con ese filtro"
            detalle="Probá sacando alguno de los filtros."
          />
        ) : (
          <Parrafo suave>
            {visibles.length} reporte{visibles.length === 1 ? '' : 's'} en el mapa. Tocá un punto y
            despues el cartel para ver el detalle.
          </Parrafo>
        )}
      </View>
    </View>
  );
}

function Chip({
  texto,
  activo,
  alTocar,
  color,
}: {
  texto: string;
  activo: boolean;
  alTocar: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={[estilos.chip, activo && estilos.chipActivo]}
    >
      {!!color && <View style={[estilos.chipPunto, { backgroundColor: color }]} />}
      <Text style={[estilos.chipTexto, activo && estilos.chipTextoActivo]}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenedorMapa: { flex: 1 },
  mapa: { flex: 1 },
  relleno: { padding: espacio.md },
  panel: {
    padding: espacio.sm,
    gap: espacio.sm,
    backgroundColor: colores.superficie,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  chips: { gap: espacio.sm, paddingHorizontal: espacio.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    minHeight: 44,
    paddingHorizontal: espacio.md,
    borderRadius: radios.completo,
    borderWidth: 2,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  chipActivo: { backgroundColor: colores.primario, borderColor: colores.primario },
  chipPunto: { width: 10, height: 10, borderRadius: radios.completo },
  chipTexto: { ...tipografia.chico, fontWeight: '700', color: colores.texto },
  chipTextoActivo: { color: colores.textoInverso },
});
