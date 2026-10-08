import type { Usuario } from '../tipos';

/** El vecino del ejemplo del PRD. */
export const VECINO_DEMO: Usuario = {
  id: 'usr-084',
  nombre: 'Norma Pereyra',
  email: 'norma@mail.com',
  telefono: '3446-412233',
  rol: 'vecino',
  zonaId: null,
  avisosActivos: true,
  creadoEn: '2026-08-30T19:10:00-03:00',
};

/** La operadora del Centro de Atencion al Vecino. */
export const OPERADORA_DEMO: Usuario = {
  id: 'usr-003',
  nombre: 'Claudia Benitez',
  email: 'claudia@gualeguaychu.gob.ar',
  telefono: '3446-410000',
  rol: 'operador',
  zonaId: 'zon-norte',
  avisosActivos: true,
  creadoEn: '2026-08-01T09:00:00-03:00',
};

export const USUARIOS: Usuario[] = [
  VECINO_DEMO,
  OPERADORA_DEMO,
  {
    id: 'usr-090',
    nombre: 'Hector Sosa',
    email: 'hector@mail.com',
    telefono: null,
    rol: 'vecino',
    zonaId: null,
    avisosActivos: false,
    creadoEn: '2026-09-02T08:15:00-03:00',
  },
];

/**
 * Credenciales de prueba mientras no hay API. Cualquier clave con 6 o mas caracteres
 * sirve; el email decide el rol. NO queda ninguna clave escrita en el codigo.
 */
export const EMAILS_DEMO = {
  vecino: VECINO_DEMO.email,
  operador: OPERADORA_DEMO.email,
} as const;
