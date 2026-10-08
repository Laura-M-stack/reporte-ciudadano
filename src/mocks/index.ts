/**
 * Datos falsos del proyecto.
 *
 * REGLA DEL PRD, hecha cumplir por ESLint (eslint.config.js): ninguna pantalla de app/
 * importa este archivo. Solo lo importa src/servicios/*, que hoy devuelve el mock y
 * manana hace fetch sin que las pantallas se enteren.
 */
import { CODIGOS, ErrorServicio } from '../errores';

export * from './cuadrillas';
export * from './reportes';
export * from './tiposDeReporte';
export * from './usuarios';
export * from './zonas';

/** Latencia simulada, para que los estados de carga se vean de verdad durante el desarrollo. */
export const DEMORA_MOCK_MS = 350;

/**
 * Caso feo obligatorio: error de red. Se usa desde la consola o desde una pantalla de
 * pruebas para verificar que el estado de error se ve en pantalla.
 */
export function simularErrorDeRed(): never {
  throw new ErrorServicio(CODIGOS.SIN_CONEXION, 'No hay conexion con el servidor.', {
    reintentable: true,
  });
}

/**
 * Interruptor global para forzar fallas mientras se desarrolla.
 * Se enciende desde la pantalla de ajustes (o a mano) y hace que los servicios en modo
 * mock lancen error.
 */
export const fallasSimuladas = {
  red: false,
  encender(): void {
    this.red = true;
  },
  apagar(): void {
    this.red = false;
  },
  verificar(): void {
    if (this.red) simularErrorDeRed();
  },
};
