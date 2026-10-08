import type { TipoDeReporte } from '../tipos';

/** Los ocho tipos de la lista corta del PRD, en el mismo orden que el mockup. */
export const TIPOS_DE_REPORTE: TipoDeReporte[] = [
  { id: 'tip-bache', nombre: 'Bache', icono: 'warning-outline', color: '#C1440E', areaResponsable: 'Obras Publicas' },
  { id: 'tip-luminaria', nombre: 'Luminaria', icono: 'bulb-outline', color: '#E8A33D', areaResponsable: 'Alumbrado' },
  { id: 'tip-basura', nombre: 'Basura', icono: 'trash-outline', color: '#4C6E3C', areaResponsable: 'Higiene Urbana' },
  { id: 'tip-rama', nombre: 'Rama o arbol', icono: 'leaf-outline', color: '#2E7D5B', areaResponsable: 'Espacios Verdes' },
  { id: 'tip-agua', nombre: 'Agua o cloaca', icono: 'water-outline', color: '#2A6F97', areaResponsable: 'Obras Sanitarias' },
  { id: 'tip-semaforo', nombre: 'Semaforo', icono: 'git-commit-outline', color: '#B02E2E', areaResponsable: 'Transito' },
  { id: 'tip-vereda', nombre: 'Vereda', icono: 'footsteps-outline', color: '#7A5C3E', areaResponsable: 'Obras Publicas' },
  { id: 'tip-otro', nombre: 'Otro', icono: 'ellipsis-horizontal-outline', color: '#5B6670', areaResponsable: 'Centro de Atencion al Vecino' },
];
