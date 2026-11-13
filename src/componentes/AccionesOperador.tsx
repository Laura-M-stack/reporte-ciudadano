/**
 * Acciones del operador sobre un reporte. Va dentro del detalle y solo se renderiza si el
 * que entro tiene rol operador: "al vecino no se le puede mostrar el boton de cambiar
 * estados" (PRD).
 *
 * Esconder el boton no alcanza como seguridad — es solo la primera capa. Las otras dos:
 * el guard de rutas por rol, y la API, que tiene que rechazar el cambio de estado de
 * cualquiera que no sea operador. En la app hacemos las dos primeras.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CapturaFoto } from './CapturaFoto';
import { mensajeParaUsuario } from '../errores';
import { listarCuadrillas, listarZonas } from '../servicios/catalogos';
import * as haptica from '../servicios/haptica';
import {
  cambiarEstado,
  corregirZona,
  marcarDuplicado,
  subirFotoDeArreglo,
} from '../servicios/reportes';
import { colores, espacio, radios, tipografia } from '../tema';
import {
  ESTADOS_REPORTE,
  ETIQUETAS_ESTADO,
  ID_FUERA_DE_ZONA,
  type Cuadrilla,
  type EstadoReporte,
  type Reporte,
  type Zona,
} from '../tipos';
import { Aviso, Boton, Campo, Parrafo, Subtitulo } from '../ui';

export function AccionesOperador({
  reporte,
  alCambiar,
}: {
  reporte: Reporte;
  /** Se llama despues de cualquier cambio para que el detalle recargue. */
  alCambiar: () => void;
}) {
  const [estado, setEstado] = useState<EstadoReporte>(reporte.estado);
  const [comentario, setComentario] = useState('');
  const [cuadrillaId, setCuadrillaId] = useState<string | null>(reporte.cuadrillaId);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [idDuplicado, setIdDuplicado] = useState('');
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [zonas, setZonas] = useState<Zona[]>([]);
  // null = el operador no eligio otra; se muestra la del reporte. Derivado en vez de copiar
  // la prop al estado, asi no queda desfasado cuando el detalle recarga.
  const [zonaElegida, setZonaElegida] = useState<string | null>(null);
  const zonaNueva = zonaElegida ?? reporte.zonaId;

  // S-14: zonaId ahora siempre trae algo (una zona real o ID_FUERA_DE_ZONA), asi que para
  // "sin zona utilizable" hay que comparar contra el sentinel, no contra string vacio.
  const sinZonaUtilizable = reporte.zonaId === ID_FUERA_DE_ZONA;

  useEffect(() => {
    // Solo las cuadrillas de la zona del reporte: asignar una cuadrilla de la otra punta
    // de la ciudad es un error caro y evitable. No hace falta un caso aparte para
    // ID_FUERA_DE_ZONA: no matchea ninguna cuadrilla real, asi que el filtro normal ya da
    // una lista vacia (y el setState queda dentro del .then, no sincronico en el efecto).
    void listarCuadrillas(reporte.zonaId)
      .then((lista) => {
        const activas = lista.filter((c) => c.activa);
        setCuadrillas(activas);
        // Si la cuadrilla elegida ya no es de esta zona (por ejemplo, despues de corregir la
        // zona), se deselecciona: si no, el boton quedaria habilitado con una cuadrilla que
        // la API rechaza por ser de otra zona.
        setCuadrillaId((elegida) => (activas.some((c) => c.id === elegida) ? elegida : null));
      })
      .catch(() => setCuadrillas([]));
  }, [reporte.zonaId]);

  useEffect(() => {
    void listarZonas()
      .then(setZonas)
      .catch(() => setZonas([]));
  }, []);

  async function guardarCambio() {
    setError(null);
    setAviso(null);
    setGuardando(true);
    try {
      // El servicio valida que un rechazo traiga motivo y que un "asignado" traiga
      // cuadrilla. Aca solo mostramos el mensaje que devuelve.
      await cambiarEstado(reporte.id, {
        estado,
        comentario: comentario.trim() || null,
        cuadrillaId,
      });
      void haptica.confirmarEnvio();
      setComentario('');
      setAviso('Estado actualizado. El vecino va a recibir el aviso.');
      alCambiar();
    } catch (e) {
      void haptica.errorAlEnviar();
      setError(mensajeParaUsuario(e));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarDuplicado() {
    setError(null);
    setGuardando(true);
    try {
      await marcarDuplicado(reporte.id, idDuplicado.trim());
      // P-07: este reporte pasa a rechazado y el original suma la adhesion; el vecino que
      // lo hizo se entera solo, al sincronizar (ver src/servicios/notificaciones.ts).
      setAviso('Marcado como duplicado: este reclamo queda rechazado y la adhesión pasa al original.');
      setIdDuplicado('');
      alCambiar();
    } catch (e) {
      setError(mensajeParaUsuario(e));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarFotoArreglo(uriTemporal: string) {
    setCamaraAbierta(false);
    setError(null);
    setGuardando(true);
    try {
      await subirFotoDeArreglo(reporte.id, uriTemporal);
      void haptica.confirmarEnvio();
      setAviso('Foto del arreglo subida.');
      alCambiar();
    } catch (e) {
      setError(mensajeParaUsuario(e));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarZona() {
    setError(null);
    setAviso(null);
    setGuardando(true);
    try {
      const actualizado = await corregirZona(reporte.id, zonaNueva);
      void haptica.confirmarEnvio();
      setZonaElegida(null);
      setAviso(
        reporte.cuadrillaId && !actualizado.cuadrillaId
          ? 'Zona corregida. La cuadrilla era de otra zona: se soltó y el reporte volvió a revisión.'
          : 'Zona corregida.',
      );
      alCambiar();
    } catch (e) {
      void haptica.errorAlEnviar();
      setError(mensajeParaUsuario(e));
    } finally {
      setGuardando(false);
    }
  }

  const reporteAbierto =
    reporte.estado === 'recibido' || reporte.estado === 'en_revision' || reporte.estado === 'asignado';
  const rechazoSinMotivo = estado === 'rechazado' && !comentario.trim();
  const asignadoSinCuadrilla = estado === 'asignado' && !cuadrillaId;

  return (
    <View style={estilos.caja}>
      <Subtitulo>Gestion (operador)</Subtitulo>

      {!!error && <Aviso texto={error} tono="error" />}
      {!!aviso && <Aviso texto={aviso} tono="info" />}

      <Parrafo>Cambiar estado</Parrafo>
      <View style={estilos.chips}>
        {ESTADOS_REPORTE.map((posible) => (
          <Pressable
            key={posible}
            onPress={() => setEstado(posible)}
            accessibilityRole="button"
            accessibilityState={{ selected: estado === posible }}
            style={[estilos.chip, estado === posible && estilos.chipActivo]}
          >
            <Text style={[estilos.chipTexto, estado === posible && estilos.chipTextoActivo]}>
              {ETIQUETAS_ESTADO[posible]}
            </Text>
          </Pressable>
        ))}
      </View>

      {estado === 'asignado' && (
        <>
          <Parrafo>A que cuadrilla</Parrafo>
          {cuadrillas.length === 0 ? (
            <Parrafo suave>
              No hay cuadrillas activas en esta zona
              {sinZonaUtilizable ? ' (el reporte quedó fuera de zona)' : ''}.
            </Parrafo>
          ) : (
            <View style={estilos.chips}>
              {cuadrillas.map((cuadrilla) => (
                <Pressable
                  key={cuadrilla.id}
                  onPress={() => setCuadrillaId(cuadrilla.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: cuadrillaId === cuadrilla.id }}
                  style={[estilos.chip, cuadrillaId === cuadrilla.id && estilos.chipActivo]}
                >
                  <Text
                    style={[
                      estilos.chipTexto,
                      cuadrillaId === cuadrilla.id && estilos.chipTextoActivo,
                    ]}
                  >
                    {cuadrilla.nombre}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      <Campo
        etiqueta={estado === 'rechazado' ? 'Motivo del rechazo (obligatorio)' : 'Comentario'}
        value={comentario}
        onChangeText={setComentario}
        multiline
        placeholder={
          estado === 'rechazado'
            ? 'Por que se rechaza. "Rechazado" a secas genera mas enojo que no contestar.'
            : 'Lo que ve el vecino en el historial'
        }
        error={rechazoSinMotivo ? 'Un rechazo tiene que decir por que.' : null}
      />

      <Boton
        titulo="Guardar cambio de estado"
        alTocar={() => void guardarCambio()}
        cargando={guardando}
        deshabilitado={rechazoSinMotivo || asignadoSinCuadrilla}
      />

      {(estado === 'resuelto' || reporte.estado === 'resuelto') && (
        <>
          <Parrafo suave>
            Subí la foto del arreglo: es lo que más agradecen los vecinos.
          </Parrafo>
          <Boton
            titulo="Sacar foto del arreglo"
            variante="secundario"
            alTocar={() => setCamaraAbierta(true)}
          />
        </>
      )}

      {reporteAbierto && zonas.length > 0 && (
        <>
          <View style={estilos.separador} />
          <Parrafo>Corregir la zona</Parrafo>
          <Parrafo suave>
            La zona se calcula sola con el punto del mapa. Si el punto quedó cerca del borde y cayó
            en la que no corresponde, corregila acá.
          </Parrafo>
          <View style={estilos.chips}>
            {zonas.map((zona) => (
              <Pressable
                key={zona.id}
                onPress={() => setZonaElegida(zona.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: zonaNueva === zona.id }}
                style={[estilos.chip, zonaNueva === zona.id && estilos.chipActivo]}
              >
                <Text style={[estilos.chipTexto, zonaNueva === zona.id && estilos.chipTextoActivo]}>
                  {zona.nombre}
                </Text>
              </Pressable>
            ))}
          </View>
          <Boton
            titulo="Guardar zona"
            variante="secundario"
            alTocar={() => void guardarZona()}
            cargando={guardando}
            deshabilitado={zonaNueva === reporte.zonaId}
          />
        </>
      )}

      <View style={estilos.separador} />

      <Parrafo>Marcar como duplicado de otro reporte</Parrafo>
      <Campo
        etiqueta="Id del reporte original"
        value={idDuplicado}
        onChangeText={setIdDuplicado}
        autoCapitalize="none"
        placeholder="rep-00412"
      />
      <Boton
        titulo="Marcar duplicado"
        variante="secundario"
        alTocar={() => void guardarDuplicado()}
        cargando={guardando}
        deshabilitado={!idDuplicado.trim()}
      />
      <Parrafo suave>
        Este reporte queda rechazado y deja de listarse aparte en el mapa público; el
        original suma esta adhesión y el vecino que hizo este reclamo recibe un aviso con
        un enlace al original (resuelto en el foro, P-07).
      </Parrafo>

      <CapturaFoto
        visible={camaraAbierta}
        alTomar={(uri) => void guardarFotoArreglo(uri)}
        alCerrar={() => setCamaraAbierta(false)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: {
    gap: espacio.sm,
    padding: espacio.md,
    borderRadius: radios.md,
    borderWidth: 2,
    borderColor: colores.primario,
    backgroundColor: colores.primarioSuave,
  },
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
  separador: { height: 1, backgroundColor: colores.borde, marginVertical: espacio.sm },
});
