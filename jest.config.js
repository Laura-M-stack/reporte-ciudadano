const path = require('path');

/**
 * expo-modules-core es dependencia de `expo`, no del proyecto. Con las versiones de SDK 57
 * npm lo deja instalado ADENTRO de expo (node_modules/expo/node_modules/expo-modules-core) y
 * no en la raiz, y el preset jest-expo lo busca desde la raiz: sin este mapeo, todos los
 * tests fallan con "Cannot find module 'expo-modules-core'". Se resuelve desde `expo`, asi
 * anda este donde este. Solo afecta a Jest: la app y el build lo resuelven solos.
 */
const carpetaExpo = path.dirname(require.resolve('expo/package.json'));
const expoModulesCore = path.dirname(
  require.resolve('expo-modules-core/package.json', { paths: [carpetaExpo] }),
);

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    'src/servicios/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    // La logica pura (geo, ids, fechas) y la cola tienen que quedarse cerca del 100%.
    global: { branches: 60, functions: 70, lines: 70, statements: 70 },
  },
  // Los paquetes de Expo y React Native se publican en ESM: hay que transpilarlos.
  // El grupo negado va entero adentro del (?! ... ): un parentesis mal cerrado aca
  // se manifiesta como "Unexpected token 'export'" al correr los tests.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-maps))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-modules-core$': expoModulesCore,
    '^expo-modules-core/(.*)$': `${expoModulesCore}/$1`,
  },
};