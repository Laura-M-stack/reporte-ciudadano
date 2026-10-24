/* eslint-disable no-undef */
/**
 * Mocks de modulos nativos para que la logica pura y los servicios se puedan testear en Node.
 *
 * Regla: aca solo van mocks de modulos NATIVOS (expo-*). Nada de mockear codigo propio:
 * si un servicio necesita un mock para testearse, es que le falta inyeccion de dependencias
 * (ver crearServicioCola en src/servicios/cola.ts).
 */

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
  WHEN_UNLOCKED: 'whenUnlocked',
}));

// La base real nunca se abre en tests: los tests de cola usan el repositorio en memoria
// (src/datos/colaEnMemoria.ts). Si algun test intenta abrirla, queremos que falle fuerte
// y no que escriba un archivo de verdad.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => {
    throw new Error('SQLite no esta disponible en tests. Usa crearRepositorioEnMemoria().');
  }),
}));

jest.mock('expo-sqlite/kv-store', () => {
  const memoria = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (clave) => memoria.get(clave) ?? null),
      setItem: jest.fn(async (clave, valor) => {
        memoria.set(clave, valor);
      }),
      removeItem: jest.fn(async (clave) => {
        memoria.delete(clave);
      }),
    },
  };
});

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documento/' },
  File: class {
    constructor(...partes) {
      this.uri = partes.join('/');
      this.exists = false;
      this.size = null;
    }
    create() {}
    delete() {}
    copy() {}
  },
  Directory: class {
    constructor(...partes) {
      this.uri = partes.join('/');
      this.exists = true;
    }
    create() {}
    list() {
      return [];
    }
  },
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  supportedAuthenticationTypesAsync: jest.fn(async () => [1]),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'id-notificacion'),
  AndroidImportance: { DEFAULT: 3 },
}));
