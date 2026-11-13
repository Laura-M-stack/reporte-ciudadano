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

import { mensajeParaUsuario } from '@/errores';
import * as haptica from '@/servicios/haptica';
import { obtenerReportePorCodigo } from '@/servicios/reportes';
import { abrirConfiguracion } from '@/servicios/ubicacion';
import { colores, espacio, radios } from '@/tema';
import { Aviso, Boton, EstadoCarga, Pantalla, Parrafo, Subtitulo, Titulo } from '@/ui';

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

/** Numero de seguimiento (GCHU-2026-00412): es lo que lleva el QR segun el README de la API. */
const PATRON_CODIGO = /^GCHU-\d{4}-\d{5}$/i;

export default function Escanear() {
  const router = useRouter();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  // Sin esto, la camara dispara el callback decenas de veces por segundo con el mismo QR
  // y se apilan decenas de navegaciones.
  const yaLeido = useRef(false);

  function alLeer(contenido: string) {
    if (yaLeido.current) return;
    const abrir = (id: string) => {
      void haptica.confirmarEnvio();
      router.push({ pathname: '/reporte/[id]', params: { id } });
      // Se rehabilita al volver a la pantalla.
      setTimeout(() => {
        yaLeido.current = false;
      }, 1500);
    };

    const id = idDesdeQr(contenido);
    if (id) {
      yaLeido.current = true;
      setError(null);
      abrir(id);
      return;
    }
    // P-11: el QR puede traer el numero de seguimiento en vez del id. Se busca en la API.
    if (PATRON_CODIGO.test(contenido.trim())) {
      yaLeido.current = true;
      setError(null);
      obtenerReportePorCodigo(contenido)
        .then((reporte) => abrir(reporte.id))
        .catch((e: unknown) => {
          setError(mensajeParaUsuario(e));
          yaLeido.current = false;
        });
      return;
    }
    setError('Ese código no es de un reporte de esta app.');
  }

  if (!permiso) {
    return (
      <Pantalla>
        <EstadoCarga texto="Preparando la cámara..." />
      </Pantalla>
    );
  }

  if (!permiso.granted) {
    return (
      <Pantalla>
        <Titulo>Escanear QR</Titulo>
        <Parrafo suave>
          Para leer el código del vecino en el mostrador necesitamos la cámara.
        </Parrafo>
        {permiso.canAskAgain ? (
          <Boton titulo="Permitir la cámara" alTocar={() => void pedirPermiso()} />
        ) : (
          <Boton titulo="Abrir configuración" alTocar={() => void abrirConfiguracion()} />
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
        <Subtitulo>Apuntá al código del vecino</Subtitulo>
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
