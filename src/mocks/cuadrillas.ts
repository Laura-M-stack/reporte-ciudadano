import type { Cuadrilla } from '../tipos';

export const CUADRILLAS: Cuadrilla[] = [
  { id: 'cua-01', nombre: 'Cuadrilla 1 — Bacheo', zonaId: 'zon-norte', especialidad: 'pavimento', activa: true },
  { id: 'cua-02', nombre: 'Cuadrilla 2 — Bacheo', zonaId: 'zon-norte', especialidad: 'pavimento', activa: true },
  { id: 'cua-03', nombre: 'Cuadrilla 3 — Alumbrado', zonaId: 'zon-centro', especialidad: 'alumbrado', activa: true },
  { id: 'cua-04', nombre: 'Cuadrilla 4 — Poda', zonaId: 'zon-centro', especialidad: 'arbolado', activa: true },
  { id: 'cua-05', nombre: 'Cuadrilla 5 — Higiene', zonaId: 'zon-sur', especialidad: 'recoleccion', activa: true },
  { id: 'cua-06', nombre: 'Cuadrilla 6 — Sanitarias', zonaId: 'zon-sur', especialidad: 'agua y cloaca', activa: false },
  { id: 'cua-07', nombre: 'Cuadrilla 7 — Mixta', zonaId: 'zon-costanera', especialidad: 'general', activa: true },
];
