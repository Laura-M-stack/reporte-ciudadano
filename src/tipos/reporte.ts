export interface Coordenadas {
  latitud: number;
  longitud: number;
}

/** Momento en el que se saco la foto: el problema o el arreglo ya hecho. */
export type MomentoFoto = 'problema' | 'arreglo';

export interface Foto {
  id: string;
  /** URL remota, o ruta local (file://) mientras el reporte no se subio. */
  url: string;
  momento: MomentoFoto;
}

export type EstadoReporte = 'recibido' | 'en_revision' | 'asignado' | 'resuelto' | 'rechazado';

/** Orden y etiquetas visibles de los estados. Unico lugar donde se traducen. */
export const ETIQUETAS_ESTADO: Record<EstadoReporte, string> = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  asignado: 'Asignado a cuadrilla',
  resuelto: 'Resuelto',
  rechazado: 'Rechazado',
};

export const ESTADOS_REPORTE: readonly EstadoReporte[] = [
  'recibido',
  'en_revision',
  'asignado',
  'resuelto',
  'rechazado',
] as const;

export interface Reporte {
  id: string;
  codigo: string;
  tipoId: string;
  descripcion: string | null;
  audioUrl: string | null;
  fotos: Foto[];
  coordenadas: Coordenadas;
  direccion: string;
  zonaId: string;
  estado: EstadoReporte;
  autorId: string;
  cuadrillaId: string | null;
  duplicadoDe: string | null;
  adhesiones: number;
  creadoEn: string;
  sincronizado: boolean;
}

export interface TipoDeReporte {
  id: string;
  nombre: string;
  /** Nombre de icono de @react-native-vector-icons/ionicons, ej. "warning-outline". */
  icono: string;
  color: string;
  areaResponsable: string;
}

export interface CambioDeEstado {
  id: string;
  reporteId: string;
  estado: EstadoReporte;
  comentario: string | null;
  operadorId: string | null;
  fechaHora: string;
}
