/**
 * Lectura del QR en el mostrador. Es la otra mitad del requisito del PRD: el vecino
 * muestra el QR en su telefono y "la chica de la ventanilla lo abre sin tipear nada".
 *
 * Usa expo-camera con barcodeScannerSettings, no una libreria aparte.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import * as haptica from '@/servicios/haptica';
import { abrirConfiguracion } from '@/servicios/ubicacion';
import { colores, espacio, radios } from '@/tema';
import { Aviso, Boton, Pantalla, Parrafo, Subtitulo, Titulo } from '@/ui';

/**
 * Del contenido del QR sacamos el id del reporte.
 * Aceptamos el deep link que genera la app y tambien un id pelado, por si alguien pega
 * el codigo a mano o la API decide otro formato (P-11).
 */
function idDesdeQr(contenido: string): string | null {
  const limpio = contenido.trim();
  const porEsquema = limpio.match(/^reporteciudadano:\/\/reporte\/([\w-]+)$/i);
  if (porEsquema?.[1]) return porEsquema[1];
  if (/^rep-[\w-]+$/i.test(limpio)) return limpio;
  return null;
}

export default function Escanear() {
  const router = useRouter();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  // Sin esto, la camara dispara el callback decenas de veces por segundo con el mismo QR
  // y se apilan decenas de navegaciones.
  const yaLeido = useRef(false);

  function alLeer(contenido: string) {
    if (yaLeido.current) return;
    const id = idDesdeQr(contenido);
    if (!id) {
      setError('Ese codigo no es de un reporte de esta app.');
      return;
    }
    yaLeido.current = true;
    void haptica.confirmarEnvio();
    router.push({ pathname: '/reporte/[id]', params: { id } });
    // Se rehabilita al volver a la pantalla.
    setTimeout(() => {
      yaLeido.current = false;
    }, 1500);
  }

  if (!permiso) return <Pantalla />;

  if (!permiso.granted) {
    return (
      <Pantalla>
        <Titulo>Escanear QR</Titulo>
        <Parrafo suave>
          Para leer el codigo del vecino en el mostrador necesitamos la camara.
        </Parrafo>
        {permiso.canAskAgain ? (
          <Boton titulo="Permitir la camara" alTocar={() => void pedirPermiso()} />
        ) : (
          <Boton titulo="Abrir configuracion" alTocar={() => void abrirConfiguracion()} />
        )}
      </Pantalla>
    );
  }

  return (
    <View style={estilos.pantalla}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(resultado) => alLeer(resultado.data)}
      />
      <View style={estilos.guia} pointerEvents="none" />
      <View style={estilos.pie}>
        <Subtitulo>Apuntá al codigo del vecino</Subtitulo>
        {!!error && <Aviso texto={error} tono="alerta" />}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#000000' },
  guia: {
    position: 'absolute',
    top: '28%',
    left: '12%',
    right: '12%',
    height: 260,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    borderRadius: radios.lg,
  },
  pie: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: espacio.md,
    gap: espacio.sm,
    backgroundColor: colores.superficie,
  },
});
