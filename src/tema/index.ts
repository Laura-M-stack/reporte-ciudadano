import type { EstadoReporte } from '../tipos';

export const colores = {
  fondo: '#F4F1EC',
  superficie: '#FFFFFF',
  superficieSuave: '#EDE8E0',

  texto: '#16242B',
  textoSuave: '#53656E',
  textoInverso: '#FFFFFF',

  primario: '#0B4F6C',
  primarioOscuro: '#073A50',
  primarioSuave: '#DCE9EF',

  acento: '#C1440E',
  acentoSuave: '#F6E2D8',

  exito: '#1C6E4F',
  exitoSuave: '#DCEFE5',
  alerta: '#9A5B00',
  alertaSuave: '#FBECD5',
  error: '#A32C1E',
  errorSuave: '#F7DED9',

  borde: '#D8D1C6',
  bordeFuerte: '#B9AF9F',
  sombra: '#16242B',
} as const;

/** Color por estado del reporte. Mismo valor en el mapa, la lista y el detalle. */
export const coloresEstado: Record<EstadoReporte, { fondo: string; texto: string; punto: string }> = {
  recibido: { fondo: colores.primarioSuave, texto: colores.primarioOscuro, punto: '#0B4F6C' },
  en_revision: { fondo: colores.alertaSuave, texto: colores.alerta, punto: '#C98A14' },
  asignado: { fondo: colores.acentoSuave, texto: colores.acento, punto: '#C1440E' },
  resuelto: { fondo: colores.exitoSuave, texto: colores.exito, punto: '#1C6E4F' },
  rechazado: { fondo: colores.superficieSuave, texto: colores.textoSuave, punto: '#7A7268' },
};

/** Escala de 4 px. Todo margen y padding sale de aca. */
export const espacio = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const tipografia = {
  titulo: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  subtitulo: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  cuerpo: { fontSize: 18, lineHeight: 26, fontWeight: '400' as const },
  cuerpoFuerte: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  chico: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  boton: { fontSize: 19, lineHeight: 24, fontWeight: '700' as const },
} as const;

export const radios = { sm: 8, md: 12, lg: 20, completo: 999 } as const;

export const TAMANO_TACTIL_MINIMO = 56;

export const sombras = {
  tarjeta: {
    shadowColor: colores.sombra,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;
