/**
 * Franja que avisa el estado de la red (requisito 7: "avisar el estado de la red con
 * expo-network"). Va una sola vez, en el layout raiz, asi se ve en todas las pantallas.
 *
 * - Sin conexion: queda fija mientras dure. Le dice al vecino que puede seguir reportando,
 *   porque la cola guarda el reporte y lo manda solo (ver src/servicios/cola.ts).
 * - Cuando vuelve: "Volvio la conexion" durante unos segundos y desaparece. Sin ese aviso el
 *   vecino no sabe si lo pendiente ya se esta enviando.
 *
 * `internetAlcanzable === null` (algunos Android no saben decirlo) cuenta como "hay red": un
 * falso "sin conexion" asusta mas de lo que ayuda.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { escucharRed, estadoRed, type EstadoRed } from '../servicios/red';
import { colores, espacio, tipografia } from '../tema';

const MS_AVISO_VOLVIO = 4000;

type Mostrar = 'nada' | 'sinRed' | 'volvio';

const conRed = (estado: EstadoRed) =>
  estado.hayConexion && estado.internetAlcanzable !== false;

export function AvisoDeRed() {
  const [mostrar, setMostrar] = useState<Mostrar>('nada');
  const huboCorte = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let activo = true;
    const aplicar = (estado: EstadoRed) => {
      if (!activo) return;
      if (temporizador.current) clearTimeout(temporizador.current);
      if (!conRed(estado)) {
        huboCorte.current = true;
        setMostrar('sinRed');
        return;
      }
      // Solo se anuncia la vuelta si antes se vio un corte (no al abrir la app con red).
      if (!huboCorte.current) {
        setMostrar('nada');
        return;
      }
      huboCorte.current = false;
      setMostrar('volvio');
      temporizador.current = setTimeout(() => {
        if (activo) setMostrar('nada');
      }, MS_AVISO_VOLVIO);
    };

    void estadoRed().then(aplicar);
    const dejarDeEscuchar = escucharRed(aplicar);
    return () => {
      activo = false;
      if (temporizador.current) clearTimeout(temporizador.current);
      dejarDeEscuchar();
    };
  }, []);

  if (mostrar === 'nada') return null;
  const sinRed = mostrar === 'sinRed';
  return (
    <View
      style={[estilos.franja, sinRed ? estilos.sinRed : estilos.volvio]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={[estilos.texto, { color: sinRed ? colores.alerta : colores.exito }]}>
        {sinRed
          ? 'Sin conexión. Podés seguir reportando: se envía solo cuando vuelva la señal.'
          : 'Volvió la conexión. Enviando lo pendiente.'}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  franja: { paddingHorizontal: espacio.md, paddingVertical: espacio.sm },
  sinRed: { backgroundColor: colores.alertaSuave },
  volvio: { backgroundColor: colores.exitoSuave },
  texto: { ...tipografia.chico, fontWeight: '700', textAlign: 'center' },
});
