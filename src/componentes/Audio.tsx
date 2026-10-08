/**
 * Grabacion y reproduccion de la nota de voz (expo-audio, NO expo-av: ya no existe).
 *
 * Por que la app tiene audio: el PRD lo pide por un motivo concreto, no por capricho
 * tecnico — "mucha gente grande no escribe en el celular pero habla sin problema".
 * Por eso grabar esta al mismo nivel que escribir, no escondido en un menu.
 *
 * Requisito 9 de la catedra: controles de reproduccion a la vista.
 */
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colores, espacio, radios, tipografia } from '../tema';
import { Parrafo } from '../ui';

/** Tope de duracion. Pendiente de confirmar con el cliente (P-13). */
export const MAX_SEGUNDOS_AUDIO = 120;

function mmss(milisegundos: number): string {
  const total = Math.max(0, Math.floor(milisegundos / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/* ------------------------------------------------------------------ grabador */

export function GrabadorAudio({
  uriGrabada,
  alGrabar,
  alBorrar,
}: {
  uriGrabada: string | null;
  /** Recibe la uri TEMPORAL del grabador. */
  alGrabar: (uriTemporal: string) => void;
  alBorrar: () => void;
}) {
  const grabador = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const estado = useAudioRecorderState(grabador);
  const [error, setError] = useState<string | null>(null);

  async function empezar() {
    setError(null);
    try {
      const permiso = await AudioModule.requestRecordingPermissionsAsync();
      if (!permiso.granted) {
        setError('Sin permiso de microfono no podemos grabar. Podes escribir la descripcion.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await grabador.prepareToRecordAsync();
      grabador.record();
    } catch {
      setError('No se pudo empezar a grabar. Probá escribiendo la descripcion.');
    }
  }

  async function frenar() {
    try {
      await grabador.stop();
      // Al frenar hay que devolver el modo de audio a reproduccion: si queda en modo
      // grabacion, el reproductor suena por el auricular y casi no se escucha.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (grabador.uri) alGrabar(grabador.uri);
    } catch {
      setError('No se pudo guardar la grabacion.');
    }
  }

  // Corte automatico al llegar al tope.
  if (estado.isRecording && (estado.durationMillis ?? 0) > MAX_SEGUNDOS_AUDIO * 1000) {
    void frenar();
  }

  if (uriGrabada) {
    return (
      <View style={estilos.bloque}>
        <ReproductorAudio uri={uriGrabada} />
        <Pressable onPress={alBorrar} accessibilityRole="button" style={estilos.enlace}>
          <Text style={estilos.enlaceTexto}>Borrar la grabacion y hacerla de nuevo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={estilos.bloque}>
      <Pressable
        onPress={() => void (estado.isRecording ? frenar() : empezar())}
        accessibilityRole="button"
        accessibilityLabel={estado.isRecording ? 'Frenar la grabacion' : 'Grabar una nota de voz'}
        style={[estilos.botonGrabar, estado.isRecording && estilos.botonGrabando]}
      >
        <View style={[estilos.puntoRojo, estado.isRecording && estilos.cuadradoRojo]} />
        <Text style={estilos.botonGrabarTexto}>
          {estado.isRecording
            ? `Grabando ${mmss(estado.durationMillis ?? 0)} — tocá para frenar`
            : 'Grabar nota de voz'}
        </Text>
      </Pressable>
      {!!error && <Parrafo suave>{error}</Parrafo>}
    </View>
  );
}

/* -------------------------------------------------------------- reproductor */

export function ReproductorAudio({ uri }: { uri: string }) {
  const reproductor = useAudioPlayer(uri);
  const estado = useAudioPlayerStatus(reproductor);

  const duracion = (estado.duration ?? 0) * 1000;
  const actual = (estado.currentTime ?? 0) * 1000;
  const avance = duracion > 0 ? Math.min(1, actual / duracion) : 0;

  function alternar() {
    if (estado.playing) {
      reproductor.pause();
      return;
    }
    // Si termino, volver al principio antes de reproducir de nuevo.
    if (duracion > 0 && actual >= duracion - 250) reproductor.seekTo(0);
    reproductor.play();
  }

  return (
    <View style={estilos.reproductor}>
      <Pressable
        onPress={alternar}
        accessibilityRole="button"
        accessibilityLabel={estado.playing ? 'Pausar' : 'Escuchar la nota de voz'}
        style={estilos.botonReproducir}
      >
        <Text style={estilos.botonReproducirTexto}>{estado.playing ? 'Pausar' : 'Escuchar'}</Text>
      </Pressable>

      <View style={estilos.barra}>
        <View style={[estilos.barraAvance, { width: `${avance * 100}%` }]} />
      </View>

      <Text style={estilos.tiempo}>
        {mmss(actual)} / {mmss(duracion)}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.sm },
  botonGrabar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    paddingHorizontal: espacio.md,
    borderRadius: radios.md,
    borderWidth: 2,
    borderColor: colores.bordeFuerte,
    backgroundColor: colores.superficie,
  },
  botonGrabando: { borderColor: colores.error, backgroundColor: colores.errorSuave },
  botonGrabarTexto: { ...tipografia.cuerpoFuerte, color: colores.texto, flexShrink: 1 },
  puntoRojo: { width: 18, height: 18, borderRadius: radios.completo, backgroundColor: colores.error },
  cuadradoRojo: { borderRadius: 3 },

  reproductor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    padding: espacio.sm,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  botonReproducir: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: espacio.md,
    borderRadius: radios.sm,
    backgroundColor: colores.primario,
  },
  botonReproducirTexto: { ...tipografia.cuerpoFuerte, color: colores.textoInverso },
  barra: {
    flex: 1,
    height: 8,
    borderRadius: radios.completo,
    backgroundColor: colores.superficieSuave,
    overflow: 'hidden',
  },
  barraAvance: { height: 8, backgroundColor: colores.primario },
  tiempo: { ...tipografia.chico, color: colores.textoSuave, minWidth: 86, textAlign: 'right' },

  enlace: { minHeight: 44, justifyContent: 'center' },
  enlaceTexto: { ...tipografia.cuerpo, color: colores.primario, textDecorationLine: 'underline' },
});
