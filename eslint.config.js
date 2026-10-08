// ESLint 9 (flat config).
// Reglas de arquitectura del equipo, ademas de las de Expo:
//  1. Ninguna pantalla de app/ puede importar src/mocks -> todo pasa por src/servicios.
//  2. Ninguna pantalla de app/ habla directo con expo-sqlite ni expo-secure-store ->
//     eso vive en src/datos y se expone via servicios/contexto.
//  3. Nadie importa src/servicios/* con rutas relativas largas: se usa el alias @/.
const expoConfig = require('eslint-config-expo/flat');

/** Patrones prohibidos dentro de app/ */
const prohibidoEnPantallas = [
  {
    group: ['@/mocks', '@/mocks/*', '**/src/mocks', '**/src/mocks/*', '**/mocks/*'],
    message:
      'Regla del PRD: ninguna pantalla importa el mock. Los datos se piden a src/servicios/*, que hoy devuelve el mock y manana hace fetch.',
  },
  {
    group: ['expo-sqlite', 'expo-sqlite/*'],
    message:
      'El acceso a SQLite vive en src/datos (db.ts, colaRepositorio.ts). Desde una pantalla se usa el servicio correspondiente.',
  },
  {
    group: ['expo-secure-store'],
    message:
      'El token solo se toca en src/datos/sesionSegura.ts. Desde una pantalla se usa useSesion().',
  },
  {
    group: ['@/datos', '@/datos/*', '**/src/datos/*'],
    message:
      'La capa de persistencia no se toca desde una pantalla. Pedilo a src/servicios/* (y si el servicio no lo expone todavia, agregalo ahi).',
  },
];

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'coverage/*', 'android/*', 'ios/*'],
  },
  {
    files: ['app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: prohibidoEnPantallas }],
    },
  },
  {
    // Los mocks pueden ser importados por servicios y por tests, no por pantallas.
    files: ['src/servicios/**/*.ts', 'src/utils/**/__tests__/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
