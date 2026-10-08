import type { CambioDeEstado, Reporte } from '../tipos';

/**
 * Datos falsos, tipados con los tipos de src/tipos. Si un mock no compila contra el tipo,
 * esta mal el mock (regla del PRD).
 *
 * El PRD pide expresamente que los mocks incluyan los casos feos. Estan todos:
 *  - rep-00412  reporte "normal", asignado a cuadrilla, con 3 adhesiones y sin audio
 *  - rep-00415  sin descripcion escrita, solo nota de voz
 *  - rep-00418  RECHAZADO con motivo largo (para ver como se rompe el layout)
 *  - rep-00421  RESUELTO con foto del arreglo (momento: "arreglo")
 *  - rep-00422  marcado como DUPLICADO de rep-00412
 *  - rep-00430  con CINCO cambios de estado en el historial
 *  - rep-00431  sin sincronizar (sincronizado: false), como sale de la cola offline
 *  - rep-00432  con dos fotos
 *  - LISTA VACIA: usar `SIN_REPORTES`
 *  - ERROR DE RED: usar `simularErrorDeRed()` de src/mocks/index.ts
 */

export const REPORTES: Reporte[] = [
  {
    id: 'rep-00412',
    codigo: 'GCHU-2026-00412',
    tipoId: 'tip-bache',
    descripcion: 'Pozo grande en la mano hacia el centro, pasa el agua.',
    audioUrl: null,
    fotos: [{ id: 'fot-901', url: 'https://picsum.photos/seed/bache412/800/600', momento: 'problema' }],
    coordenadas: { latitud: -33.0089, longitud: -58.5142 },
    direccion: 'Rocamora 1240',
    zonaId: 'zon-centro',
    estado: 'asignado',
    autorId: 'usr-084',
    cuadrillaId: 'cua-02',
    duplicadoDe: null,
    adhesiones: 3,
    creadoEn: '2026-09-14T10:22:00-03:00',
    sincronizado: true,
  },
  {
    id: 'rep-00415',
    codigo: 'GCHU-2026-00415',
    tipoId: 'tip-luminaria',
    // Caso: el vecino no escribio nada, grabo una nota de voz.
    descripcion: null,
    audioUrl: 'https://api.gchu.gob.ar/a/415.m4a',
    fotos: [{ id: 'fot-905', url: 'https://picsum.photos/seed/luz415/800/600', momento: 'problema' }],
    coordenadas: { latitud: -32.9805, longitud: -58.5231 },
    direccion: 'Concordia 480',
    zonaId: 'zon-norte',
    estado: 'en_revision',
    autorId: 'usr-084',
    cuadrillaId: null,
    duplicadoDe: null,
    adhesiones: 0,
    creadoEn: '2026-09-15T21:03:00-03:00',
    sincronizado: true,
  },
  {
    id: 'rep-00418',
    codigo: 'GCHU-2026-00418',
    tipoId: 'tip-otro',
    descripcion: 'El vecino de al lado dejo un auto abandonado en la vereda hace meses.',
    audioUrl: null,
    fotos: [{ id: 'fot-909', url: 'https://picsum.photos/seed/otro418/800/600', momento: 'problema' }],
    coordenadas: { latitud: -33.0301, longitud: -58.5087 },
    direccion: 'Ayacucho 2150',
    zonaId: 'zon-sur',
    estado: 'rechazado',
    autorId: 'usr-090',
    cuadrillaId: null,
    duplicadoDe: null,
    adhesiones: 1,
    creadoEn: '2026-09-11T16:45:00-03:00',
    sincronizado: true,
  },
  {
    id: 'rep-00421',
    codigo: 'GCHU-2026-00421',
    tipoId: 'tip-rama',
    descripcion: 'Rama grande apoyada sobre el cable de luz.',
    audioUrl: null,
    fotos: [
      { id: 'fot-911', url: 'https://picsum.photos/seed/rama421/800/600', momento: 'problema' },
      // Caso: foto del arreglo, la que segun Claudia mas van a agradecer.
      { id: 'fot-912', url: 'https://picsum.photos/seed/rama421ok/800/600', momento: 'arreglo' },
    ],
    coordenadas: { latitud: -32.9712, longitud: -58.4954 },
    direccion: 'Chalup 355',
    zonaId: 'zon-norte',
    estado: 'resuelto',
    autorId: 'usr-084',
    cuadrillaId: 'cua-04',
    duplicadoDe: null,
    adhesiones: 5,
    creadoEn: '2026-09-05T08:12:00-03:00',
    sincronizado: true,
  },
  {
    id: 'rep-00422',
    codigo: 'GCHU-2026-00422',
    tipoId: 'tip-bache',
    descripcion: 'Bache en Rocamora, el mismo de siempre.',
    audioUrl: null,
    fotos: [{ id: 'fot-913', url: 'https://picsum.photos/seed/bache422/800/600', momento: 'problema' }],
    coordenadas: { latitud: -33.00893, longitud: -58.51425 }, // a ~5 m del rep-00412
    direccion: 'Rocamora 1244',
    zonaId: 'zon-centro',
    estado: 'recibido',
    autorId: 'usr-090',
    cuadrillaId: null,
    duplicadoDe: 'rep-00412',
    adhesiones: 0,
    creadoEn: '2026-09-16T11:30:00-03:00',
    sincronizado: true,
  },
  {
    id: 'rep-00430',
    codigo: 'GCHU-2026-00430',
    tipoId: 'tip-agua',
    descripcion: 'Perdida de agua en la esquina, hace una semana que corre.',
    audioUrl: 'https://api.gchu.gob.ar/a/430.m4a',
    fotos: [{ id: 'fot-920', url: 'https://picsum.photos/seed/agua430/800/600', momento: 'problema' }],
    coordenadas: { latitud: -33.0455, longitud: -58.5201 },
    direccion: 'Costanera y Andrade',
    zonaId: 'zon-costanera',
    estado: 'resuelto',
    autorId: 'usr-084',
    cuadrillaId: 'cua-07',
    duplicadoDe: null,
    adhesiones: 8,
    creadoEn: '2026-09-01T07:40:00-03:00',
    sincronizado: true,
  },
  {
    id: 'local-8c1f0b6e-4b7a-4f0e-9a1d-2c3d4e5f6a7b',
    // Caso: reporte que todavia esta en la cola. No tiene codigo del servidor (ver P-02).
    codigo: '',
    tipoId: 'tip-basura',
    descripcion: 'Montaña de bolsas en la esquina del terreno baldio.',
    audioUrl: null,
    fotos: [
      {
        id: 'local-adj-1',
        url: 'file:///data/user/0/ar.gob.gualeguaychu.reporteciudadano/files/adjuntos/local-adj-1.jpg',
        momento: 'problema',
      },
    ],
    coordenadas: { latitud: -32.9744, longitud: -58.5402 },
    direccion: 'Sin dirección (punto marcado en el mapa)',
    zonaId: 'zon-norte',
    estado: 'recibido',
    autorId: 'usr-084',
    cuadrillaId: null,
    duplicadoDe: null,
    adhesiones: 0,
    creadoEn: '2026-09-17T19:55:00-03:00',
    sincronizado: false,
  },
  {
    id: 'rep-00432',
    codigo: 'GCHU-2026-00432',
    tipoId: 'tip-vereda',
    descripcion: 'Vereda levantada por la raiz, ya se cayó una persona.',
    audioUrl: null,
    fotos: [
      { id: 'fot-931', url: 'https://picsum.photos/seed/vereda1/800/600', momento: 'problema' },
      { id: 'fot-932', url: 'https://picsum.photos/seed/vereda2/800/600', momento: 'problema' },
    ],
    coordenadas: { latitud: -33.0122, longitud: -58.5175 },
    direccion: 'Urquiza 1215',
    zonaId: 'zon-sur',
    estado: 'recibido',
    autorId: 'usr-090',
    cuadrillaId: null,
    duplicadoDe: null,
    adhesiones: 2,
    creadoEn: '2026-09-17T09:05:00-03:00',
    sincronizado: true,
  },
];

/** Caso "lista vacía" para probar el estado vacio de las pantallas. */
export const SIN_REPORTES: Reporte[] = [];

const MOTIVO_LARGO =
  'Rechazado porque el vehiculo se encuentra en un terreno privado y la Municipalidad no tiene ' +
  'facultades para removerlo. Corresponde iniciar el reclamo en la Dirección de Inspeccion General, ' +
  'presentando nota firmada en Mesa de Entradas de calle Uruguay 875, de lunes a viernes de 7 a 13. ' +
  'Si el vehiculo estuviera sobre la vereda o la calzada, se puede volver a reportar por esta via ' +
  'indicandolo en la descripción y adjuntando una foto donde se vea la línea municipal.';

export const CAMBIOS_DE_ESTADO: CambioDeEstado[] = [
  // rep-00412: el historial del mockup del PRD
  { id: 'cam-1175', reporteId: 'rep-00412', estado: 'recibido', comentario: null, operadorId: null, fechaHora: '2026-09-14T10:22:00-03:00' },
  { id: 'cam-1177', reporteId: 'rep-00412', estado: 'en_revision', comentario: 'Verificado en el lugar', operadorId: 'usr-003', fechaHora: '2026-09-15T08:40:00-03:00' },
  { id: 'cam-1181', reporteId: 'rep-00412', estado: 'asignado', comentario: 'Cuadrilla 2', operadorId: 'usr-003', fechaHora: '2026-09-18T09:10:00-03:00' },

  { id: 'cam-1190', reporteId: 'rep-00415', estado: 'recibido', comentario: null, operadorId: null, fechaHora: '2026-09-15T21:03:00-03:00' },
  { id: 'cam-1191', reporteId: 'rep-00415', estado: 'en_revision', comentario: null, operadorId: 'usr-003', fechaHora: '2026-09-16T07:55:00-03:00' },

  // rep-00418: rechazado con motivo largo
  { id: 'cam-1200', reporteId: 'rep-00418', estado: 'recibido', comentario: null, operadorId: null, fechaHora: '2026-09-11T16:45:00-03:00' },
  { id: 'cam-1201', reporteId: 'rep-00418', estado: 'rechazado', comentario: MOTIVO_LARGO, operadorId: 'usr-003', fechaHora: '2026-09-12T10:20:00-03:00' },

  { id: 'cam-1210', reporteId: 'rep-00421', estado: 'recibido', comentario: null, operadorId: null, fechaHora: '2026-09-05T08:12:00-03:00' },
  { id: 'cam-1211', reporteId: 'rep-00421', estado: 'asignado', comentario: 'Urgente, toca el cable', operadorId: 'usr-003', fechaHora: '2026-09-05T09:00:00-03:00' },
  { id: 'cam-1212', reporteId: 'rep-00421', estado: 'resuelto', comentario: 'Podada y retirada', operadorId: 'usr-003', fechaHora: '2026-09-06T15:30:00-03:00' },

  { id: 'cam-1220', reporteId: 'rep-00422', estado: 'recibido', comentario: null, operadorId: null, fechaHora: '2026-09-16T11:30:00-03:00' },

  // rep-00430: CINCO cambios de estado, incluido un paso atras
  { id: 'cam-1230', reporteId: 'rep-00430', estado: 'recibido', comentario: null, operadorId: null, fechaHora: '2026-09-01T07:40:00-03:00' },
  { id: 'cam-1231', reporteId: 'rep-00430', estado: 'en_revision', comentario: 'Se pide informe a Obras Sanitarias', operadorId: 'usr-003', fechaHora: '2026-09-01T11:00:00-03:00' },
  { id: 'cam-1232', reporteId: 'rep-00430', estado: 'asignado', comentario: 'Cuadrilla 7', operadorId: 'usr-003', fechaHora: '2026-09-03T08:30:00-03:00' },
  { id: 'cam-1233', reporteId: 'rep-00430', estado: 'en_revision', comentario: 'La cuadrilla no encontro la perdida, se revisa de nuevo', operadorId: 'usr-003', fechaHora: '2026-09-04T17:10:00-03:00' },
  { id: 'cam-1234', reporteId: 'rep-00430', estado: 'resuelto', comentario: 'Reparada la conexión domiciliaria', operadorId: 'usr-003', fechaHora: '2026-09-08T12:00:00-03:00' },

  { id: 'cam-1240', reporteId: 'rep-00432', estado: 'recibido', comentario: null, operadorId: null, fechaHora: '2026-09-17T09:05:00-03:00' },
];
