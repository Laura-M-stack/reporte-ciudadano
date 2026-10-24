import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AccionesOperador } from '@/componentes/AccionesOperador';
import { ReproductorAudio } from '@/componentes/Audio';
import { useSesion } from '@/contexto/ContextoSesion';
import { mensajeParaUsuario } from '@/errores';
import * as haptica from '@/servicios/haptica';
import {
  adherirseAReporte,
  historialDeReporte,
  obtenerReporte,
  yaAdherido,
} from '@/servicios/reportes';
import { colores, espacio, radios } from '@/tema';
import { ETIQUETAS_ESTADO, type CambioDeEstado, type Reporte } from '@/tipos';
import { formatearFechaHora } from '@/utils';
import {
  Aviso,
  Boton,
  EstadoCarga,
  EstadoError,
  EtiquetaEstado,
  Pantalla,
  Parrafo,
  Subtitulo,
  Tarjeta,
  Titulo,
} from '@/ui';

function contenidoQr(reporte: Reporte): string {
  return `reporteciudadano://reporte/${reporte.id}`;
}

export default function DetalleReporte() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { usuario, esOperador } = useSesion();

  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [historial, setHistorial] = useState<CambioDeEstado[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [accionError, setAccionError] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [sumando, setSumando] = useState(false);
  const [sumado, setSumado] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [datos, cambios] = await Promise.all([obtenerReporte(id), historialDeReporte(id)]);
      setReporte(datos);
      setHistorial(cambios);
      if (usuario && usuario.id !== datos.autorId) {
        setSumado(await yaAdherido(datos.id, usuario.id));
      }
    } catch (e) {
      setError(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, usuario?.id]);

  useEffect(() => {
    // El reset de estado antes del await es intencional (limpia el error previo al recargar); cuesta un render extra al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  async function sumarme() {
    if (!reporte || !usuario) return;
    setAccionError(null);
    setSumando(true);
    try {
      const actualizado = await adherirseAReporte(reporte.id, usuario.id);
      setReporte(actualizado);
      setSumado(true);
      void haptica.confirmarEnvio();
    } catch (e) {
      setAccionError(mensajeParaUsuario(e));
    } finally {
      setSumando(false);
    }
  }

  if (error) {
    return (
      <Pantalla>
        <EstadoError error={error} alReintentar={cargar} />
      </Pantalla>
    );
  }
  if (!reporte) {
    return (
      <Pantalla>
        <EstadoCarga texto="Buscando el reporte..." />
      </Pantalla>
    );
  }

  const fotosProblema = reporte.fotos.filter((f) => f.momento === 'problema');
  const fotosArreglo = reporte.fotos.filter((f) => f.momento === 'arreglo');
  const esMio = usuario?.id === reporte.autorId;
  // Ultimo comentario del operador: es lo que explica un rechazo.
  const ultimoCambio = historial[historial.length - 1];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: reporte.codigo }} />
      <Pantalla>
        <Titulo>{reporte.direccion}</Titulo>
        <EtiquetaEstado estado={reporte.estado} />

        {reporte.estado === 'rechazado' && (
          <Aviso
            tono="alerta"
            texto={
              ultimoCambio?.comentario
                ? `Rechazado: ${ultimoCambio.comentario}`
                : 'Rechazado. Si no dice por que, consultá en el Centro de Atención al Vecino.'
            }
          />
        )}

        {!!reporte.duplicadoDe && (
          <Boton
            titulo="Ver el reporte original"
            variante="secundario"
            alTocar={() =>
              router.push({ pathname: '/reporte/[id]', params: { id: reporte.duplicadoDe! } })
            }
          />
        )}

        {!!accionError && <Aviso texto={accionError} tono="error" />}

        {reporte.adhesiones > 0 && (
          <Parrafo suave>
            {reporte.adhesiones} vecino{reporte.adhesiones === 1 ? '' : 's'} se sumaron a este
            reclamo
          </Parrafo>
        )}

        {!!reporte.descripcion && <Parrafo>{reporte.descripcion}</Parrafo>}

        {!!reporte.audioUrl && (
          <>
            <Subtitulo>Lo que contó el vecino</Subtitulo>
            <ReproductorAudio uri={reporte.audioUrl} />
          </>
        )}

        {fotosProblema.length > 0 && (
          <>
            <Subtitulo>El problema</Subtitulo>
            <View style={estilos.fotos}>
              {fotosProblema.map((foto) => (
                <Image
                  key={foto.id}
                  source={{ uri: foto.url }}
                  style={estilos.foto}
                  accessibilityLabel="Foto del problema reportado"
                />
              ))}
            </View>
          </>
        )}

        {fotosArreglo.length > 0 && (
          <>
            <Subtitulo>Ya arreglado</Subtitulo>
            <View style={estilos.fotos}>
              {fotosArreglo.map((foto) => (
                <Image
                  key={foto.id}
                  source={{ uri: foto.url }}
                  style={estilos.foto}
                  accessibilityLabel="Foto del arreglo terminado"
                />
              ))}
            </View>
          </>
        )}

        <Subtitulo>Que fue pasando</Subtitulo>
        {historial.length === 0 ? (
          <Parrafo suave>Todavia no hay movimientos.</Parrafo>
        ) : (
          historial.map((cambio) => (
            <Tarjeta key={cambio.id}>
              <Parrafo>
                {formatearFechaHora(cambio.fechaHora)} — {ETIQUETAS_ESTADO[cambio.estado]}
              </Parrafo>
              {!!cambio.comentario && <Parrafo suave>{cambio.comentario}</Parrafo>}
            </Tarjeta>
          ))
        )}

        <Boton titulo="Mostrar código QR" variante="secundario" alTocar={() => setQrVisible(true)} />

        {!esMio && !esOperador && reporte.estado !== 'resuelto' && (
          <Boton
            titulo={sumado ? 'Ya te sumaste a este reclamo' : 'Me pasa lo mismo, sumarme'}
            alTocar={() => void sumarme()}
            cargando={sumando}
            deshabilitado={sumado}
          />
        )}

        {esOperador && <AccionesOperador reporte={reporte} alCambiar={cargar} />}
      </Pantalla>

      <Modal visible={qrVisible} animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={estilos.qrFondo}>
          <Titulo>{reporte.codigo}</Titulo>
          <Parrafo suave>Mostrá esta pantalla en el mostrador.</Parrafo>
          <View style={estilos.qrCaja}>
            <QRCode value={contenidoQr(reporte)} size={240} backgroundColor="#FFFFFF" />
          </View>
          <Boton titulo="Cerrar" alTocar={() => setQrVisible(false)} />
        </View>
      </Modal>
    </>
  );
}

const estilos = StyleSheet.create({
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
  foto: {
    width: '100%',
    height: 240,
    borderRadius: radios.md,
    backgroundColor: colores.superficieSuave,
  },
  qrFondo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.lg,
    padding: espacio.lg,
    backgroundColor: colores.fondo,
  },
  qrCaja: {
    padding: espacio.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: colores.borde,
  },
});
