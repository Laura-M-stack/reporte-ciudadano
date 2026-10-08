/**
 * Camara a pantalla completa (expo-camera, CameraView).
 *
 * Va como overlay dentro de la pantalla de reporte y no como ruta aparte: una ruta tendria
 * que devolver la foto por parametros de navegacion, y una uri de archivo viajando por la
 * URL es fragil. Aca la foto vuelve por callback, tipada.
 *
 * El PRD es tajante: "Si el vecino no da permiso de camara, no puede reportar, y la app
 * tiene que explicarselo con buenos modos y ofrecerle abrir la configuracion". Eso es
 * exactamente lo que hace el bloque de permiso denegado de abajo.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import * as haptica from '../servicios/haptica';
import { abrirConfiguracion } from '../servicios/ubicacion';
import { colores, espacio, radios, tipografia } from '../tema';
import { Boton, Parrafo, Subtitulo } from '../ui';

export function CapturaFoto({
  visible,
  alTomar,
  alCerrar,
}: {
  visible: boolean;
  /** Recibe la uri TEMPORAL; quien la recibe decide si la guarda como adjunto. */
  alTomar: (uriTemporal: string) => void;
  alCerrar: () => void;
}) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const camara = useRef<CameraView>(null);
  const [tomando, setTomando] = useState(false);

  async function disparar() {
    if (tomando) return;
    setTomando(true);
    try {
      const foto = await camara.current?.takePictureAsync({ quality: 0.7 });
      if (foto?.uri) {
        void haptica.fotoTomada();
        alTomar(foto.uri);
      }
    } finally {
      setTomando(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={alCerrar}>
      <View style={estilos.fondo}>
        {!permiso ? (
          // Todavia cargando el estado del permiso.
          <View style={estilos.centro} />
        ) : !permiso.granted ? (
          <View style={estilos.explicacion}>
            <Subtitulo>Necesitamos la cámara</Subtitulo>
            <Parrafo suave>
              La foto es lo único que evita las discusiones sobre qué había en el lugar. Sin
              foto no podemos tomar el reporte.
            </Parrafo>
            {permiso.canAskAgain ? (
              <Boton titulo="Permitir la cámara" alTocar={() => void pedirPermiso()} />
            ) : (
              <Boton titulo="Abrir configuración" alTocar={() => void abrirConfiguracion()} />
            )}
            <Boton titulo="Volver" variante="secundario" alTocar={alCerrar} />
          </View>
        ) : (
          <>
            <CameraView ref={camara} style={estilos.camara} facing="back" />
            <View style={estilos.controles}>
              <Pressable
                onPress={alCerrar}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
                style={estilos.secundario}
              >
                <Text style={estilos.secundarioTexto}>Cancelar</Text>
              </Pressable>

              <Pressable
                onPress={disparar}
                disabled={tomando}
                accessibilityRole="button"
                accessibilityLabel="Sacar foto"
                style={[estilos.obturador, tomando && estilos.obturadorInactivo]}
              >
                <View style={estilos.obturadorInterior} />
              </Pressable>

              {/* Hueco del mismo ancho que "Cancelar" para que el obturador quede centrado. */}
              <View style={estilos.secundario} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#000000' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  camara: { flex: 1 },
  explicacion: {
    flex: 1,
    justifyContent: 'center',
    gap: espacio.md,
    padding: espacio.lg,
    backgroundColor: colores.fondo,
  },
  controles: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: espacio.lg,
    paddingHorizontal: espacio.md,
    backgroundColor: '#000000',
  },
  secundario: { minWidth: 96, minHeight: 56, justifyContent: 'center' },
  secundarioTexto: { ...tipografia.boton, color: '#FFFFFF' },
  obturador: {
    width: 84,
    height: 84,
    borderRadius: radios.completo,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  obturadorInactivo: { opacity: 0.5 },
  obturadorInterior: {
    width: 64,
    height: 64,
    borderRadius: radios.completo,
    backgroundColor: '#FFFFFF',
  },
});
