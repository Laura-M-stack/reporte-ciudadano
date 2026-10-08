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
import { listarCuadrillas } from '../servicios/catalogos';
import * as haptica from '../servicios/haptica';
import { cambiarEstado, marcarDuplicado, subirFotoDeArreglo } from '../servicios/reportes';
import { colores, espacio, radios, tipografia } from '../tema';
import {
  ESTADOS_REPORTE,
  ETIQUETAS_ESTADO,
  type Cuadrilla,
  type EstadoReporte,
  type Reporte,
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

  useEffect(() => {
    // Solo las cuadrillas de la zona del reporte: asignar una cuadrilla de la otra punta
    // de la ciudad es un error caro y evitable.
    void listarCuadrillas(reporte.zonaId || undefined)
      .then((lista) => setCuadrillas(lista.filter((c) => c.activa)))
      .catch(() => setCuadrillas([]));
  }, [reporte.zonaId]);

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
      setAviso('Marcado como duplicado.');
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
              {reporte.zonaId ? '' : ' (el reporte todavia no tiene zona asignada)'}.
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
            Subí la foto del arreglo: es lo que mas agradecen los vecinos.
          </Parrafo>
          <Boton
            titulo="Sacar foto del arreglo"
            variante="secundario"
            alTocar={() => setCamaraAbierta(true)}
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
        Pendiente de definir con el cliente (P-07): que estado queda el duplicado, y si sus
        adhesiones pasan al reporte original.
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
