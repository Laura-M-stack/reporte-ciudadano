/**
 * Componentes compartidos. Los usan las cuatro personas para que la app se vea igual
 * de punta a punta y para no reimplementar cuatro veces el estado de carga.
 *
 * Los tres estados que la catedra verifica sobre la app entregada (carga, vacio, error)
 * estan resueltos aca: <EstadoCarga />, <EstadoVacio />, <EstadoError />. Usarlos.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { mensajeParaUsuario } from '../errores';
import { ETIQUETAS_ESTADO, type EstadoReporte } from '../tipos';
import {
  TAMANO_TACTIL_MINIMO,
  colores,
  coloresEstado,
  espacio,
  radios,
  sombras,
  tipografia,
} from '../tema';

/* ------------------------------------------------------------------ textos */

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={estilos.titulo}>{children}</Text>;
}

export function Subtitulo({ children }: { children: ReactNode }) {
  return <Text style={estilos.subtitulo}>{children}</Text>;
}

export function Parrafo({ children, suave }: { children: ReactNode; suave?: boolean }) {
  return <Text style={[estilos.parrafo, suave && estilos.parrafoSuave]}>{children}</Text>;
}

/* ------------------------------------------------------------------ layout */

export function Pantalla({
  children,
  desplazable = true,
  estilo,
}: {
  children: ReactNode;
  desplazable?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  if (!desplazable) {
    return <View style={[estilos.pantalla, estilo]}>{children}</View>;
  }
  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={[estilos.contenido, estilo]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Tarjeta({
  children,
  alTocar,
}: {
  children: ReactNode;
  alTocar?: () => void;
}) {
  if (!alTocar) return <View style={estilos.tarjeta}>{children}</View>;
  return (
    <Pressable
      onPress={alTocar}
      style={({ pressed }) => [estilos.tarjeta, pressed && estilos.tarjetaTocada]}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ botones */

type VarianteBoton = 'primario' | 'secundario' | 'peligro';

export function Boton({
  titulo,
  alTocar,
  variante = 'primario',
  cargando = false,
  deshabilitado = false,
}: {
  titulo: string;
  alTocar: () => void;
  variante?: VarianteBoton;
  cargando?: boolean;
  deshabilitado?: boolean;
}) {
  const inactivo = deshabilitado || cargando;
  return (
    <Pressable
      onPress={alTocar}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [
        estilos.boton,
        estilos[`boton_${variante}`],
        pressed && !inactivo && estilos.botonTocado,
        inactivo && estilos.botonInactivo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={variante === 'secundario' ? colores.primario : colores.textoInverso} />
      ) : (
        <Text style={[estilos.botonTexto, variante === 'secundario' && estilos.botonTextoSecundario]}>
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ campos */

export function Campo({
  etiqueta,
  error,
  ...props
}: TextInputProps & { etiqueta: string; error?: string | null }) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        {...props}
        style={[estilos.campoEntrada, !!error && estilos.campoEntradaError]}
        placeholderTextColor={colores.textoSuave}
        accessibilityLabel={etiqueta}
      />
      {!!error && <Text style={estilos.campoError}>{error}</Text>}
    </View>
  );
}

/* ------------------------------------------------------------------ estados */

export function EstadoCarga({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <View style={estilos.estado} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colores.primario} />
      <Text style={estilos.estadoTexto}>{texto}</Text>
    </View>
  );
}

export function EstadoVacio({
  titulo,
  detalle,
  accion,
}: {
  titulo: string;
  detalle?: string;
  accion?: { titulo: string; alTocar: () => void };
}) {
  return (
    <View style={estilos.estado}>
      <Text style={estilos.estadoTitulo}>{titulo}</Text>
      {!!detalle && <Text style={estilos.estadoTexto}>{detalle}</Text>}
      {!!accion && (
        <View style={estilos.estadoAccion}>
          <Boton titulo={accion.titulo} alTocar={accion.alTocar} variante="secundario" />
        </View>
      )}
    </View>
  );
}

export function EstadoError({
  error,
  alReintentar,
}: {
  error: unknown;
  alReintentar?: () => void;
}) {
  return (
    <View style={estilos.estado} accessibilityLiveRegion="polite">
      <Text style={estilos.estadoTitulo}>No pudimos cargar esto</Text>
      <Text style={estilos.estadoTexto}>{mensajeParaUsuario(error)}</Text>
      {!!alReintentar && (
        <View style={estilos.estadoAccion}>
          <Boton titulo="Reintentar" alTocar={alReintentar} variante="secundario" />
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ dominio */

export function EtiquetaEstado({ estado }: { estado: EstadoReporte }) {
  const paleta = coloresEstado[estado];
  return (
    <View style={[estilos.etiqueta, { backgroundColor: paleta.fondo }]}>
      <View style={[estilos.etiquetaPunto, { backgroundColor: paleta.punto }]} />
      <Text style={[estilos.etiquetaTexto, { color: paleta.texto }]}>
        {ETIQUETAS_ESTADO[estado]}
      </Text>
    </View>
  );
}

/** Banda de aviso. Se usa para "sin conexion" y para "N reportes esperando senal". */
export function Aviso({
  texto,
  tono = 'info',
}: {
  texto: string;
  tono?: 'info' | 'alerta' | 'error';
}) {
  const fondo =
    tono === 'error' ? colores.errorSuave : tono === 'alerta' ? colores.alertaSuave : colores.primarioSuave;
  const color =
    tono === 'error' ? colores.error : tono === 'alerta' ? colores.alerta : colores.primarioOscuro;
  return (
    <View style={[estilos.aviso, { backgroundColor: fondo }]} accessibilityLiveRegion="polite">
      <Text style={[estilos.avisoTexto, { color }]}>{texto}</Text>
    </View>
  );
}

/** Marca visible en las pantallas que todavia son un esqueleto de la Fase 0. */
export function PendienteDeImplementar({
  persona,
  descripcion,
}: {
  persona: string;
  descripcion: string;
}) {
  return (
    <View style={estilos.pendiente}>
      <Text style={estilos.pendienteTitulo}>Pendiente — {persona}</Text>
      <Text style={estilos.pendienteTexto}>{descripcion}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.md, gap: espacio.md, paddingBottom: espacio.xxl },

  titulo: { ...tipografia.titulo, color: colores.texto },
  subtitulo: { ...tipografia.subtitulo, color: colores.texto },
  parrafo: { ...tipografia.cuerpo, color: colores.texto },
  parrafoSuave: { color: colores.textoSuave },

  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: espacio.md,
    gap: espacio.sm,
    ...sombras.tarjeta,
  },
  tarjetaTocada: { backgroundColor: colores.superficieSuave },

  boton: {
    minHeight: TAMANO_TACTIL_MINIMO,
    borderRadius: radios.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espacio.lg,
  },
  boton_primario: { backgroundColor: colores.primario },
  boton_secundario: {
    backgroundColor: colores.superficie,
    borderWidth: 2,
    borderColor: colores.primario,
  },
  boton_peligro: { backgroundColor: colores.error },
  botonTocado: { opacity: 0.85 },
  botonInactivo: { opacity: 0.5 },
  botonTexto: { ...tipografia.boton, color: colores.textoInverso },
  botonTextoSecundario: { color: colores.primario },

  campo: { gap: espacio.xs },
  campoEtiqueta: { ...tipografia.cuerpoFuerte, color: colores.texto },
  campoEntrada: {
    minHeight: TAMANO_TACTIL_MINIMO,
    borderWidth: 2,
    borderColor: colores.bordeFuerte,
    borderRadius: radios.md,
    paddingHorizontal: espacio.md,
    backgroundColor: colores.superficie,
    ...tipografia.cuerpo,
    color: colores.texto,
  },
  campoEntradaError: { borderColor: colores.error },
  campoError: { ...tipografia.chico, color: colores.error },

  estado: { padding: espacio.xl, alignItems: 'center', gap: espacio.sm },
  estadoTitulo: { ...tipografia.subtitulo, color: colores.texto, textAlign: 'center' },
  estadoTexto: { ...tipografia.cuerpo, color: colores.textoSuave, textAlign: 'center' },
  estadoAccion: { marginTop: espacio.sm, alignSelf: 'stretch' },

  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    alignSelf: 'flex-start',
    paddingVertical: espacio.xs,
    paddingHorizontal: espacio.sm,
    borderRadius: radios.completo,
  },
  etiquetaPunto: { width: 10, height: 10, borderRadius: radios.completo },
  etiquetaTexto: { ...tipografia.chico, fontWeight: '700' },

  aviso: { padding: espacio.md, borderRadius: radios.md },
  avisoTexto: { ...tipografia.cuerpo },

  pendiente: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colores.bordeFuerte,
    borderRadius: radios.md,
    padding: espacio.md,
    gap: espacio.xs,
    backgroundColor: colores.superficieSuave,
  },
  pendienteTitulo: { ...tipografia.cuerpoFuerte, color: colores.textoSuave },
  pendienteTexto: { ...tipografia.chico, color: colores.textoSuave },
});
