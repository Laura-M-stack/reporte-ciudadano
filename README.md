# Reporte Ciudadano

Aplicación móvil para que los vecinos de Gualeguaychú informen problemas en la vía pública y
para que el Centro de Atención al Vecino gestione esos reportes.

Desarrollada con React Native, Expo, TypeScript y Expo Router como Trabajo Integrador de
Desarrollo para Móviles, Tecnicatura Universitaria en Desarrollo Web (UNER).

## Funcionalidades

- Crear reportes con fotos, ubicación y descripción escrita o grabada.
- Guardar reportes sin conexión y sincronizarlos cuando vuelva internet.
- Consultar reportes propios, su estado y su ubicación en el mapa.
- Gestionar reportes desde el perfil de operador: actualizar estados y asignar cuadrillas.
- Iniciar sesión y, si el dispositivo lo permite, volver a ingresar con biometría.

## Requisitos

- Node.js y npm.
- Android Studio o un dispositivo Android para ejecutar la aplicación.
- Una development build para probar las funciones nativas y el mapa. Expo Go no incluye
  MapLibre.

La aplicación funciona correctamente en Windows y Ubuntu. En distribuciones rolling release
de Linux, como Arch, puede fallar por incompatibilidades entre las versiones de los paquetes.

## Instalación y ejecución

Instalá las dependencias:

```bash
npm ci
```

Copiá `.env.example` como `.env`. Si la API todavía no está disponible, dejá
`EXPO_PUBLIC_API_URL` vacío; la aplicación usará los datos de prueba incluidos.

En PowerShell:

```powershell
Copy-Item .env.example .env
```

En Linux:

```bash
cp .env.example .env
```

Iniciá Expo:

```bash
npx expo start
```

Para abrir la aplicación en Android, usá una development build o instalá el APK generado con
EAS.

## Acceso con datos de prueba

Cuando `EXPO_PUBLIC_API_URL` está vacío, se usan cuentas de prueba. Se puede ingresar con
cualquiera de estos correos y una contraseña de al menos seis caracteres:

| Correo | Perfil |
| --- | --- |
| `norma@mail.com` | Vecino |
| `claudia@gualeguaychu.gob.ar` | Operador |

## Verificación

```bash
npm run typecheck
npm run lint
npm test
```

También se pueden ejecutar los tres controles juntos:

```bash
npm run verificar
```

## APK de Android

El proyecto usa EAS Build. Para generar un APK de prueba:

```bash
npm install -g eas-cli
eas login
npm run build:preview
```

## Tecnologías principales

- Expo y React Native para la aplicación móvil.
- Expo Router para la navegación.
- SQLite para la cola local de reportes pendientes.
- MapLibre y OpenStreetMap para los mapas.
- Jest para las pruebas automatizadas.
