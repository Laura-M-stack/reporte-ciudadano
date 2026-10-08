# Reporte Ciudadano

App móvil para que los vecinos de Gualeguaychú reporten problemas urbanos (baches, luminarias,
ramas, basura) con foto y ubicación, y para que el Centro de Atención al Vecino los gestione.

Trabajo Integrador — **Desarrollo para Móviles**, Tecnicatura Universitaria en Desarrollo Web,
UNER. React Native + Expo + TypeScript + Expo Router. Entrega: APK de release con EAS.

La app está **completa**: los diez requisitos mínimos de la cátedra están implementados
(ver la tabla al final).

Estado de la verificación: `npm run verificar` pasa entero — typecheck sin errores, lint sin
advertencias y **101 de 101 tests**. Lo que todavía NO se probó es la app corriendo en un
teléfono: ahí pueden aparecer errores de ejecución que ni el typecheck ni los tests ven,
sobre todo en `expo-audio` y en la API nueva de `expo-file-system`. Presupuesten una sesión
para el primer `npx expo start`.

---

## Arrancar (PowerShell)

```powershell
# 1. Dependencias
npm install

# 2. Alinear versiones con las que espera el SDK de Expo instalado (fuente de verdad)
npx expo install --fix
npx expo-doctor

# 3. Variables de entorno
Copy-Item .env.example .env
# Dejar EXPO_PUBLIC_API_URL vacio hasta que la catedra publique la API:
# con la variable vacia, los servicios responden con los mocks de src/mocks.

# 4. Correr
npx expo start
# a  -> abrir en Android
# r  -> recargar
```

### Entrar a la app sin API

Con `EXPO_PUBLIC_API_URL` vacío, los servicios responden con los mocks de `src/mocks`. Para
ingresar sirve cualquiera de estos dos correos y **cualquier clave de 6 caracteres o más**
(no hay ninguna contraseña escrita en el código: el correo decide el rol):

| Correo | Rol | Qué se ve |
| --- | --- | --- |
| `norma@mail.com` | vecino | Reportar, Mis reclamos, Mapa, Ajustes |
| `claudia@gualeguaychu.gob.ar` | operador | Bandeja, Escanear QR, Cuadrillas, Ajustes |

### Guion de prueba manual

El orden importa: va de lo que más chance tiene de fallar a lo que menos.

1. **Abre y llega al ingreso.** Entrar como vecino.
2. **Nuevo reporte**: elegir tipo → sacar foto → ver que el mapa tome la ubicación → escribir
   o grabar la descripción → enviar. Es donde se concentran `expo-camera`, `expo-audio`,
   `expo-location` y `expo-file-system`.
3. **Modo avión + nuevo reporte.** Tiene que guardarse y aparecer en Mis reclamos como
   "pendiente de envío", sin código de seguimiento. Al volver la señal se sube solo.
4. **Duplicados**: crear un reporte del mismo tipo a menos de 50 m de uno existente. Tiene que
   ofrecer sumarse en vez de crear otro.
5. **Mapa.** Si sale gris, falta la clave de Google Maps, no es un bug.
6. **Como operadora**: cambiar un estado con comentario, intentar rechazar sin motivo (tiene
   que negarse), asignar una cuadrilla.
7. **Cerrar y reabrir la app.** La sesión tiene que sobrevivir.

Verificación antes de cada push:

```powershell
npm run verificar     # typecheck + lint + tests
npm test              # solo tests
npm run lint          # solo ESLint
```

Build instalable (lo que pide la cátedra):

```powershell
npm install -g eas-cli
eas login
eas build:configure          # completa extra.eas.projectId en app.json
npm run build:preview        # eas build --platform android --profile preview
```

> **Hacer el primer build de preview esta semana, no la última.** La consigna lo avisa y es
> cierto: el primer build siempre falla por un permiso, un asset o un identificador, y el cupo
> mensual de EAS es limitado.

### Versión de Expo

El proyecto está en el **SDK 57** (React Native 0.86.3, React 19.2.3). Se subió desde el 54 el
primer día, antes de escribir pantallas, por un motivo práctico: Expo Go solo soporta el SDK
más nuevo, así que con el 54 no se podía probar en el teléfono sin armar un APK cada vez.

Desde el SDK 55 los paquetes `expo-*` usan la misma versión mayor que el SDK (`57.x`), así que
no hay que adivinar versiones: `npx expo install --fix` las resuelve.

Dos salvedades del alineamiento actual:

- **`typescript` se queda en 5.9** aunque el SDK espere 6.0. Está en `expo.install.exclude` de
  `package.json` a propósito; el motivo está abajo, en "Problemas comunes".
- **`npm install` avisa por `react-native-worklets`.** Llega como dependencia opcional de
  `@expo/ui` (dentro de `expo-router`) y la versión no coincide con la que espera
  `expo-modules-core`. No hace fallar `verificar` ni `expo install --check`. Si al correr la app
  aparece algún error de worklets o de reanimated, empezar por ahí.

### Cosas que hay que completar a mano

| Dónde | Qué | Quién |
| --- | --- | --- |
| `app.json` → `android.config.googleMaps.apiKey` | Clave de Google Maps. Sin esto el mapa sale **gris en el APK** aunque en Expo Go se vea bien. | B |
| `app.json` → `extra.eas.projectId` | Lo completa `eas build:configure`. | B |
| `.env` → `EXPO_PUBLIC_API_URL` | Cuando la cátedra publique la API. | quien la reciba |

---

## Reparto del trabajo

El front lo hacemos nosotras dos. La app está completa: lo que sigue es repartir quién
**conoce** cada parte, porque en la defensa cada una tiene que poder explicar su código
línea por línea.

> **Cuestión abierta con el grupo, conviene resolverla ya.** Los otros dos integrantes
> quedaron en hacer el backend, pero la consigna dice que *"la aplicación consume la API
> provista por la cátedra detrás de una capa de servicios propia"* (requisito 3), y el PRD
> aclara que *"la API la provee la cátedra"*. Esa "capa de servicios propia" es `src/servicios/`
> dentro de la app, no un servidor aparte. Los diez requisitos mínimos son todos de la app
> móvil: no hay ni medio punto de backend. El riesgo concreto es que dos integrantes lleguen
> a la defensa sin código propio de la app que explicar, y la defensa es individual. Hay que
> preguntarle a la cátedra y, si el backend no cuenta, que ellos tomen un área de la app.

| Quién | Área | Archivos |
| --- | --- | --- |
| **A** | **Crear reporte y cola offline.** Cámara, galería, nota de voz, ubicación corregible, detección de duplicados a 50 m, cola en SQLite con reintentos, háptica. Es la mitad más difícil. | `app/(vecino)/reportar.tsx`, `src/componentes/CapturaFoto.tsx`, `src/componentes/Audio.tsx`, `src/componentes/SelectorUbicacion.tsx`, `src/servicios/cola.ts`, `src/servicios/adjuntos.ts`, `src/servicios/ubicacion.ts`, `src/servicios/haptica.ts`, `src/datos/colaRepositorio.ts`, `src/datos/archivos.ts`, `src/utils/geo.ts` |
| **B** | **Sesión, seguimiento, mapa y panel del operador.** Auth con biometría, guard por rol, lista y detalle del vecino, QR, mapa público, bandeja con filtros, zonas y cuadrillas, notificaciones. | `app/(auth)/**`, `app/(vecino)/mis-reportes.tsx`, `app/(vecino)/mapa.tsx`, `app/(vecino)/ajustes.tsx`, `app/(operador)/**`, `app/reporte/[id].tsx`, `src/componentes/AccionesOperador.tsx`, `src/contexto/ContextoSesion.tsx`, `src/servicios/auth.ts`, `src/servicios/biometria.ts`, `src/servicios/notificaciones.ts`, `src/servicios/sincronizacion.ts`, `src/servicios/catalogos.ts` |

No es parejo en cantidad de pantallas, pero sí en horas: la cola offline sola pesa lo que
tres pantallas de lectura.

**Compartido entre las dos** (avisar antes de tocar): `src/tipos/**`, `src/errores.ts`,
`src/servicios/http.ts`, `src/servicios/reportes.ts`, `src/ui/**`, `src/tema/**`,
`src/mocks/**`, `eslint.config.js`, `jest.config.js`, `package.json`, `app.json`.

### Lo que necesitamos de los compañeros de backend

Si la API la terminan haciendo ellos en vez de usarse directo la de la cátedra, lo único
que necesitamos es que respete el contrato que ya está escrito en `src/tipos/`:

- Respuestas `{ "datos": ..., "meta": {...} }` y errores `{ "error": { "codigo", "mensaje" } }`.
- Ids `string`, fechas ISO 8601 **con zona**, claves en `camelCase`, opcionales en `null`.
- `Authorization: Bearer <token>`.
- Las rutas que consume la app, listadas en `src/servicios/reportes.ts`, `auth.ts` y
  `catalogos.ts`: `/auth/ingresar`, `/auth/registro`, `/auth/yo`, `/reportes`,
  `/reportes/:id`, `/reportes/:id/cambios`, `/reportes/:id/adhesiones`,
  `/reportes/:id/duplicado`, `/reportes/:id/fotos`, `/reportes/cercanos`,
  `/tipos-de-reporte`, `/zonas`, `/cuadrillas`.
- Que acepte `multipart/form-data` para crear reportes (van las fotos y el audio) y que
  respete la cabecera `Idempotency-Key` (ver P-08).

Si eso se cumple, cuando nos pasen la URL solo completamos `.env` y no tocamos una sola
pantalla.

**En la defensa cada una explica su código.** Se puede usar IA para desarrollar; en la
defensa no. Reserven días para leer la app, no horas.

---

## Cómo trabajar sin pisarse

Repositorio: https://github.com/Laura-M-stack/reporte-ciudadano

Somos varias personas sobre el mismo repo, así que:

- **Una rama por tarea**, nunca commitear directo a `main`:
  `git switch -c feat/mapa-filtros`, y al terminar un Pull Request.
- **`git pull --rebase origin main` antes de empezar a trabajar cada día.** Evita el 90 % de
  los conflictos.
- **`npm run verificar` antes de cada push.** Si falla, no se pushea: el que viene después
  hereda el problema y no sabe de dónde salió.
- **Un commit = un cambio con sentido.** Mezclar un cambio de dependencias con uno de código
  hace imposible revertir solo uno.
- **Los archivos compartidos se avisan en el grupo antes de tocarlos.** Están listados arriba.
- **Si cambia `package.json`, va junto con `package-lock.json` en el mismo commit.** El lock es
  lo que garantiza que todas instalemos exactamente las mismas versiones.

Qué **no** se commitea (ya está en `.gitignore`): `node_modules/`, `.env`, `android/`, `ios/`,
`.expo/`, `coverage/`. Si alguno aparece en un `git status`, algo se configuró mal.

### Historial de decisiones grandes

| Cuándo | Qué | Por qué |
| --- | --- | --- |
| Día 1 | Base compartida: tipos del PRD, mocks, capa de servicios, cola offline, lógica pura con tests, esqueleto de pantallas | Que varias personas puedan trabajar en paralelo sin pisarse |
| Día 1 | App completa: los diez requisitos implementados | Sacarse la entrega de encima y dejar tiempo para entender el código antes de la defensa |
| Día 1 | Subida de SDK 54 a 57 | Expo Go solo soporta el SDK más nuevo; con el 54 no se podía probar en el teléfono sin armar un APK cada vez |

---

## Estructura

```
app/                        Rutas (Expo Router). Solo pantallas y navegacion.
  _layout.tsx               Proveedor de sesion, splash, arranque de la cola
  index.tsx                 Redirige segun sesion y rol
  (auth)/                   ingresar, registro, desbloquear  [B]
  (vecino)/                 reportar [A] · mis-reportes, mapa, ajustes [B]
  (operador)/               bandeja, escanear, cuadrillas, ajustes  [B]
  reporte/[id].tsx          Detalle, compartido vecino/operador

src/
  tipos/                    Entidades del PRD. Se escriben UNA vez y no se tocan.
  mocks/                    Datos falsos, tipados con esos mismos tipos.
  servicios/                Unica puerta entre pantallas y datos. Siempre async.
  datos/                    SQLite, kv-store, secure-store, archivos. Nadie mas los toca.
  utils/                    Logica pura testeada (geo, fechas, ids). Sin React, sin Expo.
  componentes/              Piezas con logica propia (camara, audio, mapa, panel operador).
  contexto/                 Estado global de React (sesion).
  ui/                       Componentes compartidos (boton, estados de carga/vacio/error).
  tema/                     Colores, tipografia, espaciado, area tactil minima.
  errores.ts                ErrorServicio: el unico error que se lanza en el proyecto.
```

### Reglas de dependencia (las hace cumplir ESLint)

```
app/  ->  src/servicios, src/contexto, src/ui, src/tema, src/tipos, src/utils
src/servicios  ->  src/datos, src/mocks, src/utils, src/tipos
src/datos      ->  src/utils, src/tipos
src/utils      ->  src/tipos          (y nada mas: es logica pura)
```

Prohibido y bloqueado por `eslint.config.js` dentro de `app/`:

- importar `src/mocks` — es la regla textual del PRD: *"ninguna pantalla importa el mock"*.
- importar `expo-sqlite` o `expo-secure-store` — eso vive en `src/datos`.
- importar `src/datos/*` — si una pantalla necesita algo de ahí, se expone en un servicio.

---

## Decisiones de arquitectura

### 1. La cola offline es parte del contrato, no una improvisación

`src/tipos/cola.ts` define `BorradorReporte`, `ReporteEnCola` y la interfaz `ServicioCola`
(`encolar`, `listarPendientes`, `reintentar`, `eliminar`, `suscribir`). La escribe A, la lee B
para mostrar "esperando señal" en la lista del vecino, y la consulta antes de cerrar sesión.

**El envío tiene un solo camino: siempre `cola.encolar()`, haya o no señal.** Nunca
`crearReporte()` desde una pantalla. Si hubiera dos caminos (uno online y otro offline), el
camino offline se probaría una vez por mes y se rompería sin que nadie se entere. Con uno solo,
el modo avión es el caso normal, no la excepción.

`crearServicioCola()` recibe todo por inyección (repositorio, función de envío, reloj,
generador de ids, chequeo de red). Por eso los reintentos y el tope de intentos se testean en
Node, sin SQLite ni red: `src/servicios/__tests__/cola.test.ts`.

Máquina de estados de una fila de la cola:

```
pendiente --(hay red)--> enviando --(ok)------------------> enviado
     ^                       |
     |                       +--(error de red, intentos<5)--> pendiente
     |                       +--(error de datos, o intentos=5)--> error
     +--(el vecino toca "reintentar")----------------------------+
```

Un error de red se reintenta; un error de datos (`FOTO_REQUERIDA`) no mejora reintentando, así
que queda en `error` de una y el vecino tiene que corregirlo.

### 2. El cálculo de zona está separado de la subida

`puntoEnPoligono` y `zonaIdDePunto` viven en `src/utils/geo.ts`: **lógica pura, sin red**. El
reporte se crea parado frente al pozo, posiblemente sin señal; si el cálculo de zona estuviera
dentro del servicio que habla con la API, no habría forma de asignar la zona offline ni de
testearlo sin mockear `fetch`.

El borrador llega a la cola con `zonaId` ya resuelto. La cola no calcula nada; la API tampoco
tiene que recalcularlo (aunque puede validarlo).

Lo mismo con la distancia: `distanciaEnMetros` (Haversine) resuelve los 50 m de duplicados sin
preguntarle nada al servidor.

### 3. IDs locales desde el día uno

Todo reporte nace con `local-<uuid>` (`src/utils/ids.ts`), nunca con un índice secuencial. Dos
teléfonos offline generarían `local-1` al mismo tiempo y se pisarían al sincronizar. Además el
`idLocal` viaja al servidor como **clave de idempotencia** (`Idempotency-Key`): si la red se
corta después de que el servidor guardó, el reintento no crea un duplicado. Falta confirmar que
la API lo respete (P-08).

### 4. Un solo tipo de error

Ningún servicio ni utilidad lanza `new Error("algo")`. Siempre
`new ErrorServicio(codigo, mensaje)`, con la misma forma que el cuerpo de error de la API:

```ts
{ codigo: 'FOTO_REQUERIDA', mensaje: 'El reporte necesita al menos una foto.' }
```

La UI decide que mostrar mirando `codigo`, nunca parseando el texto. `mensajeParaUsuario(e)`
traduce el código a una frase para el vecino. Así un error de red y un error del servidor se
manejan igual en la pantalla.

### 5. Los servicios ya son asíncronos aunque el mock responda al instante

Si hoy fueran síncronos, cuando llegue la API habría que tocar todas las pantallas. También por
eso todos los servicios devuelven `Promise` y las pantallas ya manejan los tres estados
(`EstadoCarga`, `EstadoVacio`, `EstadoError` en `src/ui`), que es lo que la cátedra verifica
sobre la app entregada.

### 6. Diseño pensado para el público del PRD

Cuerpo de 18 px (el default de React Native es 14), área táctil mínima de 56 px, contraste alto,
un color por estado consistente entre mapa, lista y detalle. No es gusto: *"buena parte de
quienes reclaman tienen más de 60. Letra grande, botones grandes"*, y se usa parado en la vereda,
al sol. Todo sale de `src/tema`; nadie escribe un color a mano en una pantalla.

---

## Convenciones de datos (del PRD, sin excepción)

- Los identificadores son `string`, nunca `number`.
- Fechas y horas: texto **ISO 8601 con zona** (`"2026-09-14T10:22:00-03:00"`). Nunca un `Date`,
  nunca un número. La conversión vive solo en `src/utils/fechas.ts`.
- Claves en `camelCase`.
- Un campo que puede no tener valor viene como `null`: no ausente y no `""`.
- La sesión viaja en `Authorization: Bearer <token>`. El token va a `expo-secure-store`,
  **nunca** a kv-store.
- Respuesta de la API: `{ "datos": ..., "meta": {...} }` en éxito,
  `{ "error": { "codigo": ..., "mensaje": ... } }` en error.

### Nombres en el código

El dominio está en castellano (`Reporte`, `Cuadrilla`, `zonaId`) porque así están los tipos del
PRD y así habla el cliente. El código acompaña: `listarReportes`, `encolar`, `puntoEnPoligono`.
No mezclar `getReports` con `listarReportes` en el mismo proyecto.

Los textos de la interfaz tratan al vecino de **vos** (como el mockup del PRD: *"a 12 m de vos"*).
Los comentarios del código van sin tildes a propósito, para no depender de la codificación de
archivo de cuatro máquinas distintas.

---

## Tests

```powershell
npm test
npm test -- --coverage
```

Lo que está cubierto hoy (101 casos):

- **`src/utils/__tests__/geo.test.ts`** — Haversine y point-in-polygon con sus casos límite:
  distancia 0, distancia conocida de 1 grado de latitud, el umbral exacto de 50 m, cruce del
  antimeridiano, coordenadas fuera de rango, punto sobre un vértice, punto sobre una arista,
  polígono abierto que se cierra solo, polígono con menos de 3 vértices, punto fuera de todas
  las zonas, filtrado por tipo de problema.
- **`src/utils/__tests__/ids.test.ts`** — formato `local-<uuid>`, detección de id local.
- **`src/utils/__tests__/fechas.test.ts`** — ISO con offset, formatos del mockup, orden
  descendente.
- **`src/servicios/__tests__/cola.test.ts`** — comportamiento de la cola: sin foto no encola,
  sin conexión no pierde nada, error de red se reintenta, error de datos no, tope de intentos,
  reintento forzado por el vecino, orden de envío, borrado de adjuntos al descartar.

Qué testear y qué no: **lógica pura y reglas de negocio, sí**. Pantallas, no (salvo que sobre
tiempo). El criterio es si el test se rompe cuando cambia el comportamiento, no cuando cambia
el color de un botón.

---

## Supuestos que tomamos

Están marcados en el código como `SUPUESTO S-xx`. Si el cliente contesta distinto, se cambian.

| # | Supuesto | Dónde |
| --- | --- | --- |
| S-01 | El registro público solo crea **vecinos**. Las cuentas de operador las da de alta la Municipalidad. En modo mock, el email decide el rol. | `src/tipos/usuario.ts`, `src/servicios/auth.ts` |
| S-02 | La foto puede venir de cámara **o** de galería, pero sin al menos una foto no se envía nada. Depende de P-01. | `src/servicios/cola.ts` |
| S-03 | Si no hay geocodificación inversa, la dirección se guarda como texto genérico y el punto manda. | `src/tipos/cola.ts` |
| S-04 | Point-in-polygon trata lat/lon como plano cartesiano (válido para polígonos de pocos km). Punto sobre el borde cuenta como **dentro**. El polígono puede venir abierto: se cierra solo. | `src/utils/geo.ts` |
| S-05 | Si el punto cae fuera de las 4 zonas, el reporte **se envía igual** con `zonaId` sin asignar y lo clasifica el operador. No se le bloquea el reclamo al vecino por un error de GPS. | `src/utils/geo.ts`, `src/servicios/reportes.ts` |
| S-06 | Los polígonos de zona del mock son cuatro franjas inventadas sobre el ejido. Sirven para probar el cálculo; no son los límites reales. | `src/mocks/zonas.ts` |
| S-07 | Mientras el reporte está en la cola **no se muestra un código de seguimiento inventado**: dice "pendiente de envío". El código `GCHU-...` lo asigna el servidor. Depende de P-02. | `app/(vecino)/mis-reportes.tsx` |
| S-08 | Cerrar sesión **no borra** la cola de reportes sin subir. Son del vecino; la pantalla avisa que quedan en el teléfono. | `src/servicios/auth.ts`, `app/(vecino)/ajustes.tsx` |
| S-09 | En respuestas de un solo elemento, `datos` es el objeto; en listas, el arreglo. El PRD solo muestra el caso lista. | `src/tipos/api.ts` |
| S-10 | Las notificaciones locales se disparan al detectar un cambio de estado durante la sincronización en primer plano, y al subirse un reporte que estaba en la cola. Sin push no hay aviso con la app cerrada. Depende de P-05. | `src/servicios/notificaciones.ts` |
| S-11 | La detección de duplicados compara contra la copia local cuando no hay red. Sin cache previo, offline no hay detección. Depende de P-03. | `src/servicios/reportes.ts` |
| S-12 | La biometría es un **atajo opcional**, no el camino principal: la contraseña siempre está a la vista. Nadie queda trabado por no tener sensor. | `src/servicios/biometria.ts` |

---

## Preguntas abiertas para el cliente

El PRD lo pide expreso: *"cuando encuentren huecos, avisen: no los resuelvan por su cuenta"*.
Estas son las que conviene mandar juntas, antes de seguir. Las cuatro primeras bloquean código.

| # | Pregunta | Por qué importa |
| --- | --- | --- |
| **P-01** | *"Sacar una foto es obligatorio"* y *"si no da permiso de cámara no puede reportar"*, pero también se pide galería (`expo-image-picker`) y el mockup tiene botón `[galeria]`. **¿Vale una foto de galería?** | Si vale, el permiso de cámara deja de ser bloqueante y se cae la garantía de "foto tomada parado frente al problema", que es lo que evita las discusiones. |
| **P-02** | El código `GCHU-2026-00412` es correlativo y lo asigna el servidor, pero el reporte se crea sin señal y el vecino *"tiene que llevarse un número de seguimiento"*. **¿Qué le mostramos mientras está en la cola?** | Si le mostramos un código provisorio que después cambia, la señora lo anota y en la ventanilla no existe. |
| **P-03** | Duplicados a 50 m: **¿contra reportes de cualquier tipo o solo del mismo tipo?** (un bache y una luminaria a 10 m no son el mismo problema). **¿Se excluyen los resueltos y rechazados? ¿Se acepta que offline no funcione** si el vecino nunca abrió la app con señal en esa zona? | Define la regla exacta y si hay que precargar un radio de reportes al abrir con conexión. |
| **P-04** | **Falta la entidad Adhesión.** `Reporte` solo tiene `adhesiones: number`. Con un contador no sabemos a quién avisar cuando cambia el estado, no podemos evitar que el mismo vecino se sume cinco veces, ni mostrar "los reportes a los que me sumé". | Hay que agregar `Adhesion { id, reporteId, usuarioId, fechaHora }` al modelo y a la API. |
| P-05 | La cátedra pide notificaciones **locales**; el hecho que le importa al vecino (el operador cambió el estado) pasa en el servidor. **Sin push, el aviso llega cuando el vecino abre la app.** ¿Alcanza? | Es exactamente el punto que más le importa a Claudia: *"se enoja porque nadie le dice nada"*. Mejor decirlo ahora. |
| P-06 | **¿Quién provee los polígonos reales de las cuatro zonas?** ¿Se solapan? ¿Qué pasa si el punto cae fuera de todas (quintas, ruta, el río)? El tipo `Reporte.zonaId` es `string`, no admite `null`. | Hoy asumimos S-05. Si el cliente quiere otra cosa, cambia el modelo. |
| P-07 | Existe `duplicadoDe` pero **"duplicado" no es uno de los cinco estados**. Cuando el operador marca A como duplicado de B: ¿qué estado toma A? ¿Las adhesiones de A pasan a B? ¿El autor de A sigue recibiendo avisos? ¿A sigue en el mapa público? | Sin esto no se puede cerrar la pantalla de duplicados del operador. |
| P-08 | **¿La API acepta una clave de idempotencia** (`Idempotency-Key` o el `idLocal` en el cuerpo)? | Sin eso, un corte de red en el momento justo crea el bache catorce veces otra vez, que es el problema que la app vino a resolver. |
| P-09 | **¿Cómo se crean las cuentas de operador?** ¿El rol viene en la respuesta del login? ¿Un operador ve solo su zona (`Usuario.zonaId`) o todas? | Define el guard de navegación y los filtros de la bandeja. |
| P-10 | El mapa público no debe mostrar quién reportó, pero `autorId` está en el modelo. **¿La API lo filtra en el endpoint público?** | Si no lo filtra el servidor, el dato sensible viaja igual al teléfono. |
| P-11 | QR: **¿qué lleva adentro y quién lo escanea?** ¿La chica de la ventanilla usa esta misma app con cuenta de operador? Si el QR lleva el código a secas, cualquiera que le saque una foto abre el reporte. | Define si hay que implementar lectura de QR además de generación. |
| P-12 | La API página de a 20. **¿Hay endpoint por área (bbox) para el mapa** o hay que paginar toda la ciudad? | Con paginado de 20 el mapa no se puede pintar. |
| P-13 | **¿Duración máxima de la nota de voz, peso máximo de foto, se comprime? ¿La API acepta multipart?** | Con señal intermitente, subir 8 MB por reporte no termina nunca. |
| P-14 | La cátedra pide biometría para el reingreso general; el PRD solo la menciona para el operador, y el público son mayores de 60 con teléfonos viejos. **¿Confirmamos que la contraseña es el camino principal?** | Hoy asumimos S-12. |
| P-15 | *"Un rechazado tiene que decir por qué"*, pero `CambioDeEstado.comentario` es `string \| null`. **¿Lo valida la API o solo la app?** | Hoy lo valida la app (`servicios/reportes.cambiarEstado`). Si la API no lo hace, entra basura por otro lado. |

---

## Los diez requisitos de la cátedra: dónde está cada uno

| # | Requisito | Dónde está |
| --- | --- | --- |
| 1 | Pantallas y navegación con Expo Router | `app/` con grupos `(auth)`, `(vecino)`, `(operador)`, detalle `reporte/[id]`, guard por rol en cada `_layout` |
| 2 | Autenticación, sesión persistente, `expo-secure-store`, biometría con alternativa | `src/contexto/ContextoSesion.tsx`, `src/servicios/auth.ts`, `src/servicios/biometria.ts`, `app/(auth)/desbloquear.tsx` |
| 3 | Consumo de API detrás de capa de servicios, con carga/vacío/error | `src/servicios/http.ts` (único `fetch`), `src/servicios/*.ts`; los tres estados en `src/ui` y usados en todas las listas |
| 4 | Cámara / galería + `expo-file-system` (File, Directory, Paths) | `src/componentes/CapturaFoto.tsx`, `src/servicios/adjuntos.ts`, `src/datos/archivos.ts` |
| 5 | `expo-location` + `react-native-maps`, usable sin permiso | `src/servicios/ubicacion.ts`, `src/componentes/SelectorUbicacion.tsx`, `app/(vecino)/mapa.tsx`. Si niega el permiso, el mapa abre en Gualeguaychú y el punto se marca tocando |
| 6 | Notificaciones locales por un hecho real | `src/servicios/notificaciones.ts` + `src/servicios/sincronizacion.ts`: avisa cuando la sincronización detecta un cambio de estado o una adhesión nueva, y cuando la cola logra subir un reporte. Nunca por un botón de prueba |
| 7 | `expo-sqlite` + kv-store + `expo-network`, abre sin conexión | `src/datos/db.ts` (migraciones), `colaRepositorio.ts`, `reportesCache.ts`, `preferencias.ts`, `src/servicios/red.ts` |
| 8 | Sensores o háptica justificada | `src/servicios/haptica.ts`: confirmación de envío (el vecino mira el pozo, no la pantalla), advertencia al detectar un duplicado cerca, obturador de la cámara |
| 9 | Multimedia (`expo-audio`) con controles a la vista | `src/componentes/Audio.tsx`: grabador con cronómetro y tope, reproductor con play/pausa, barra de avance y tiempos |
| 10 | Identidad: icono 1024x1024 sin transparencia, splash, nombre | `assets/icon.png` (1024x1024 RGB, sin alfa), `assets/splash-icon.png`, `app.json` |

---

## Problemas comunes

- **`npm install` falla por peer dependencies** → `npm install --legacy-peer-deps` y después
  `npx expo install --fix`.
- **Los tests tiran `Unexpected token 'export'`** → el `transformIgnorePatterns` de
  `jest.config.js` quedó mal cerrado. El paréntesis del grupo negado cierra al final.
- **El mapa sale gris en el APK pero se ve en Expo Go** → falta la clave de Google Maps en
  `app.json`.
- **`Cannot find module 'expo-sqlite'` en un test** → un test está tocando la capa de datos.
  Los tests de cola usan `crearRepositorioEnMemoria()`, no SQLite.
- **ESLint se queja al importar algo de `src/mocks` o `src/datos` en una pantalla** → no es un
  falso positivo. Pedilo a través de un servicio.
- **ESLint marca `react-hooks/set-state-in-effect` en un `useEffect(() => { void cargar(); })`**
  → la regla llegó con `eslint-config-expo` 57. En las 7 pantallas que cargan datos al abrir
  está silenciada con un `eslint-disable-next-line` puntual: el reset de estado antes del
  `await` es intencional (limpia el error previo al recargar) y el costo es un render extra al
  montar. La forma correcta sería mover ese reset a un wrapper que use el botón de Reintentar,
  y que el efecto de montaje llame a la carga sin resetear. **Pendiente para después de probar
  la app en el teléfono.** No silenciar la regla para todo `app/`: taparía casos reales.
- **`npx expo install --check` no marca `typescript`** → está en `expo.install.exclude` de
  `package.json` a propósito. El SDK 57 espera TypeScript 6, que es un salto mayor y puede
  sacar errores de tipos nuevos en todo el código; nos quedamos en 5.9 hasta haber corrido la
  app al menos una vez. Para subirlo: sacarlo del `exclude` y `npx expo install typescript -- -D`.
