/**
 * Bandeja del operador. Reemplaza a la planilla de mil filas del PRD.
 *
 * PRD: "Lista de reportes con filtros por estado, tipo y zona". Los tres filtros estan,
 * y se combinan.
 *
 * El orden por defecto pone primero los que mas vecinos juntaron: "cuantos mas vecinos se
 * suman, mas arriba va en la lista de Obras". Entre dos con la misma cantidad, el mas viejo
 * primero, porque es el que mas tiempo lleva esperando.
 */
import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { listarCuadrillas, listarTiposDeReporte, listarZonas } from '@/servicios/catalogos';
import { listarReportes } from '@/servicios/reportes';
import { colores, espacio, radios, tipografia } from '@/tema';
import {
  ESTADOS_REPORTE,
  ETIQUETAS_ESTADO,
  type Cuadrilla,
  type EstadoReporte,
  type Reporte,
  type TipoDeReporte,
  type Zona,
} from '@/tipos';
import { formatearFechaHora } from '@/utils';
import {
  EstadoCarga,
  EstadoError,
  EstadoVacio,
  EtiquetaEstado,
  Parrafo,
  Tarjeta,
  Titulo,
} from '@/ui';

type Orden = 'adhesiones' | 'recientes';

export default function Bandeja() {
  const [reportes, setReportes] = useState<Reporte[] | null>(null);
  const [tipos, setTipos] = useState<TipoDeReporte[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [refrescando, setRefrescando] = useState(false);

  const [filtroEstado, setFiltroEstado] = useState<EstadoReporte | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [filtroZona, setFiltroZona] = useState<string | null>(null);
  const [orden, setOrden] = useState<Orden>('adhesiones');

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [pagina, listaTipos, listaZonas, listaCuadrillas] = await Promise.all([
        listarReportes({ porPagina: 200 }),
        listarTiposDeReporte(),
        listarZonas(),
        listarCuadrillas(),
      ]);
      setReportes(pagina.datos);
      setTipos(listaTipos);
      setZonas(listaZonas);
      setCuadrillas(listaCuadrillas);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function alRefrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  const visibles = useMemo(() => {
    if (!reportes) return [];
    const filtrados = reportes.filter((r) => {
      if (filtroEstado && r.estado !== filtroEstado) return false;
      if (filtroTipo && r.tipoId !== filtroTipo) return false;
      if (filtroZona && r.zonaId !== filtroZona) return false;
      return true;
    });
    return filtrados.sort((a, b) => {
      if (orden === 'adhesiones' && a.adhesiones !== b.adhesiones) {
        return b.adhesiones - a.adhesiones;
      }
      if (orden === 'adhesiones') return Date.parse(a.creadoEn) - Date.parse(b.creadoEn);
      return Date.parse(b.creadoEn) - Date.parse(a.creadoEn);
    });
  }, [reportes, filtroEstado, filtroTipo, filtroZona, orden]);

  const nombreTipo = (id: string) => tipos.find((t) => t.id === id)?.nombre ?? id;
  const nombreZona = (id: string) => zonas.find((z) => z.id === id)?.nombre ?? 'sin zona';
  const nombreCuadrilla = (id: string | null) =>
    id ? (cuadrillas.find((c) => c.id === id)?.nombre ?? id) : null;

  return (
    <ScrollView
      contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={alRefrescar} />}
    >
      <Titulo>Bandeja</Titulo>

      <Parrafo suave>Estado</Parrafo>
      <View style={estilos.chips}>
        <Chip texto="Todos" activo={filtroEstado === null} alTocar={() => setFiltroEstado(null)} />
        {ESTADOS_REPORTE.map((estado) => (
          <Chip
            key={estado}
            texto={ETIQUETAS_ESTADO[estado]}
            activo={filtroEstado === estado}
            alTocar={() => setFiltroEstado(filtroEstado === estado ? null : estado)}
          />
        ))}
      </View>

      <Parrafo suave>Tipo</Parrafo>
      <View style={estilos.chips}>
        <Chip texto="Todos" activo={filtroTipo === null} alTocar={() => setFiltroTipo(null)} />
        {tipos.map((tipo) => (
          <Chip
            key={tipo.id}
            texto={tipo.nombre}
            activo={filtroTipo === tipo.id}
            alTocar={() => setFiltroTipo(filtroTipo === tipo.id ? null : tipo.id)}
          />
        ))}
      </View>

      <Parrafo suave>Zona</Parrafo>
      <View style={estilos.chips}>
        <Chip texto="Todas" activo={filtroZona === null} alTocar={() => setFiltroZona(null)} />
        {zonas.map((zona) => (
          <Chip
            key={zona.id}
            texto={zona.nombre}
            activo={filtroZona === zona.id}
            alTocar={() => setFiltroZona(filtroZona === zona.id ? null : zona.id)}
          />
        ))}
      </View>

      <View style={estilos.chips}>
        <Chip
          texto="Mas vecinos primero"
          activo={orden === 'adhesiones'}
          alTocar={() => setOrden('adhesiones')}
        />
        <Chip
          texto="Mas nuevos primero"
          activo={orden === 'recientes'}
          alTocar={() => setOrden('recientes')}
        />
      </View>

      {error && <EstadoError error={error} alReintentar={cargar} />}
      {!error && !reportes && <EstadoCarga texto="Cargando reportes..." />}
      {!error && reportes && visibles.length === 0 && (
        <EstadoVacio
          titulo="No hay reportes con esos filtros"
          detalle="Probá sacando alguno de los tres."
          accion={{
            titulo: 'Limpiar filtros',
            alTocar: () => {
              setFiltroEstado(null);
              setFiltroTipo(null);
              setFiltroZona(null);
            },
          }}
        />
      )}

      {visibles.map((reporte) => (
        <Link key={reporte.id} href={{ pathname: '/reporte/[id]', params: { id: reporte.id } }} asChild>
          <Pressable accessibilityRole="button">
            <Tarjeta>
              <EtiquetaEstado estado={reporte.estado} />
              <Parrafo>{reporte.direccion}</Parrafo>
              <Parrafo suave>
                {nombreTipo(reporte.tipoId)} · {nombreZona(reporte.zonaId)}
              </Parrafo>
              <Parrafo suave>
                {reporte.codigo} · {formatearFechaHora(reporte.creadoEn)}
              </Parrafo>
              {reporte.adhesiones > 0 && (
                <Parrafo suave>{reporte.adhesiones} vecinos se sumaron</Parrafo>
              )}
              {!!nombreCuadrilla(reporte.cuadrillaId) && (
                <Parrafo suave>Asignado a {nombreCuadrilla(reporte.cuadrillaId)}</Parrafo>
              )}
              {!!reporte.duplicadoDe && (
                <Parrafo suave>Duplicado de {reporte.duplicadoDe}</Parrafo>
              )}
            </Tarjeta>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

function Chip({ texto, activo, alTocar }: { texto: string; activo: boolean; alTocar: () => void }) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={[estilos.chip, activo && estilos.chipActivo]}
    >
      <Text style={[estilos.chipTexto, activo && estilos.chipTextoActivo]}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.md, gap: espacio.sm, paddingBottom: espacio.xxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: espacio.md,
    borderRadius: radios.completo,
    borderWidth: 2,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  chipActivo: { backgroundColor: colores.primario, borderColor: colores.primario },
  chipTexto: { ...tipografia.chico, fontWeight: '700', color: colores.texto },
  chipTextoActivo: { color: colores.textoInverso },
});
