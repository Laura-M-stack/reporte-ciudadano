# Reporte Ciudadano

App movil para que los vecinos de Gualeguaychu reporten problemas urbanos (baches, luminarias,
ramas, basura) con foto y ubicacion, y para que el Centro de Atencion al Vecino los gestione.

Trabajo Integrador — **Desarrollo para Moviles**, Tecnicatura Universitaria en Desarrollo Web,
UNER. React Native + Expo + TypeScript + Expo Router. Entrega: APK de release con EAS.

Esto es la **Fase 0**: la base compartida. Los tipos, los servicios, la cola offline, la logica
pura testeada, el guard de navegacion y el esqueleto de pantallas ya estan. Cada persona
implementa su parte encima, sin tocar la de las otras.

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

Verificacion antes de cada push:

```powershell
npm run verificar     # typecheck + lint + tests
npm test              # solo tests
npm run lint          # solo ESLint
```

Build instalable (lo que pide la catedra):

```powershell
npm install -g eas-cli
eas login
eas build:configure          # completa extra.eas.projectId en app.json
npm run build:preview        # eas build --platform android --profile preview
```

> **Hacer el primer build de preview esta semana, no la ultima.** La consigna lo avisa y es
> cierto: el primer build siempre falla por un permiso, un asset o un identificador, y el cupo
> mensual de EAS es limitado.

### Version de Expo

`package.json` esta pineado al **SDK 54**, con versiones verificadas de cada paquete. Si el
equipo prefiere arrancar en el SDK mas nuevo (hay SDK 57 disponible), el camino correcto es:

```powershell
npm install expo@^57.0.0
npx expo install --fix       # reacomoda TODOS los expo-* y react-native
npx expo-doctor
```

Desde el SDK 55 los paquetes `expo-*` usan la misma version mayor que el SDK (`57.x`), asi que
no hay que adivinar versiones: `expo install --fix` las resuelve. Conviene decidirlo **el primer
dia**, antes de que alguien escriba una pantalla: subir de SDK a mitad del cuatrimestre cuesta.

### Cosas que hay que completar a mano

| Donde | Que | Quien |
| --- | --- | --- |
| `app.json` → `android.config.googleMaps.apiKey` | Clave de Google Maps. Sin esto el mapa sale **gris en el APK** aunque en Expo Go se vea bien. | Persona 3 |
| `app.json` → `extra.eas.projectId` | Lo completa `eas build:configure`. | Persona 1 |
| `.env` → `EXPO_PUBLIC_API_URL` | Cuando la catedra publique la API. | quien la reciba |

---

## Reparto del trabajo

El front lo hacemos nosotras dos; los otros dos integrantes se ocupan del backend. La app
esta completa: lo que sigue es repartir quien **conoce** cada parte, porque en la defensa
cada una tiene que poder explicar su codigo linea por linea.

| Quien | Area | Archivos |
| --- | --- | --- |
| **A** | **Crear reporte y cola offline.** Camara, galeria, nota de voz, ubicacion corregible, deteccion de duplicados a 50 m, cola en SQLite con reintentos, haptica. Es la mitad mas dificil. | `app/(vecino)/reportar.tsx`, `src/componentes/CapturaFoto.tsx`, `src/componentes/Audio.tsx`, `src/componentes/SelectorUbicacion.tsx`, `src/servicios/cola.ts`, `src/servicios/adjuntos.ts`, `src/servicios/ubicacion.ts`, `src/servicios/haptica.ts`, `src/datos/colaRepositorio.ts`, `src/datos/archivos.ts`, `src/utils/geo.ts` |
| **B** | **Sesion, seguimiento, mapa y panel del operador.** Auth con biometria, guard por rol, lista y detalle del vecino, QR, mapa publico, bandeja con filtros, zonas y cuadrillas, notificaciones. | `app/(auth)/**`, `app/(vecino)/mis-reportes.tsx`, `app/(vecino)/mapa.tsx`, `app/(vecino)/ajustes.tsx`, `app/(operador)/**`, `app/reporte/[id].tsx`, `src/componentes/AccionesOperador.tsx`, `src/contexto/ContextoSesion.tsx`, `src/servicios/auth.ts`, `src/servicios/biometria.ts`, `src/servicios/notificaciones.ts`, `src/servicios/sincronizacion.ts`, `src/servicios/catalogos.ts` |

No es parejo en cantidad de pantallas, pero si en horas: la cola offline sola pesa lo que
tres pantallas de lectura.

**Compartido entre las dos** (avisar antes de tocar): `src/tipos/**`, `src/errores.ts`,
`src/servicios/http.ts`, `src/servicios/reportes.ts`, `src/ui/**`, `src/tema/**`,
`src/mocks/**`, `eslint.config.js`, `jest.config.js`, `package.json`, `app.json`.

### Lo que necesitamos de los companeros de backend

Si la API la terminan haciendo ellos en vez de usarse directo la de la catedra, lo unico
que necesitamos es que respete el contrato que ya esta escrito en `src/tipos/`:

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

**En la defensa cada una explica su codigo.** Se puede usar IA para desarrollar; en la
defensa no. Reserven dias para leer la app, no horas.

---

## Estructura

```
app/                        Rutas (Expo Router). Solo pantallas y navegacion.
  _layout.tsx               Proveedor de sesion, splash, arranque de la cola
  index.tsx                 Redirige segun sesion y rol
  (auth)/                   ingresar, registro, desbloquear  [Persona 1]
  (vecino)/                 reportar, mis-reportes, mapa, ajustes  [2 y 3]
  (operador)/               bandeja, cuadrillas, ajustes  [Persona 4]
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
- importar `src/datos/*` — si una pantalla necesita algo de ahi, se expone en un servicio.

---

## Decisiones de arquitectura

### 1. La cola offline es parte del contrato, no una improvisacion

`src/tipos/cola.ts` define `BorradorReporte`, `ReporteEnCola` y la interfaz `ServicioCola`
(`encolar`, `listarPendientes`, `reintentar`, `eliminar`, `suscribir`). Persona 2 la implementa,
Persona 3 la lee para mostrar "esperando senal" y Persona 1 la consulta antes de cerrar sesion.

**El envio tiene un solo camino: siempre `cola.encolar()`, haya o no senal.** Nunca
`crearReporte()` desde una pantalla. Si hubiera dos caminos (uno online y otro offline), el
camino offline se probaria una vez por mes y se romperia sin que nadie se entere. Con uno solo,
el modo avion es el caso normal, no la excepcion.

`crearServicioCola()` recibe todo por inyeccion (repositorio, funcion de envio, reloj,
generador de ids, chequeo de red). Por eso los reintentos y el tope de intentos se testean en
Node, sin SQLite ni red: `src/servicios/__tests__/cola.test.ts`.

Maquina de estados de una fila de la cola:

```
pendiente --(hay red)--> enviando --(ok)------------------> enviado
     ^                       |
     |                       +--(error de red, intentos<5)--> pendiente
     |                       +--(error de datos, o intentos=5)--> error
     +--(el vecino toca "reintentar")----------------------------+
```

Un error de red se reintenta; un error de datos (`FOTO_REQUERIDA`) no mejora reintentando, asi
que queda en `error` de una y el vecino tiene que corregirlo.

### 2. El calculo de zona esta separado de la subida

`puntoEnPoligono` y `zonaIdDePunto` viven en `src/utils/geo.ts`: **logica pura, sin red**. El
reporte se crea parado frente al pozo, posiblemente sin senal; si el calculo de zona estuviera
dentro del servicio que habla con la API, no habria forma de asignar la zona offline ni de
testearlo sin mockear `fetch`.

El borrador llega a la cola con `zonaId` ya resuelto. La cola no calcula nada; la API tampoco
tiene que recalcularlo (aunque puede validarlo).

Lo mismo con la distancia: `distanciaEnMetros` (Haversine) resuelve los 50 m de duplicados sin
preguntarle nada al servidor.

### 3. IDs locales desde el dia uno

Todo reporte nace con `local-<uuid>` (`src/utils/ids.ts`), nunca con un indice secuencial. Dos
telefonos offline generarian `local-1` al mismo tiempo y se pisarian al sincronizar. Ademas el
`idLocal` viaja al servidor como **clave de idempotencia** (`Idempotency-Key`): si la red se
corta despues de que el servidor guardo, el reintento no crea un duplicado. Falta confirmar que
la API lo respete (P-08).

### 4. Un solo tipo de error

Ningun servicio ni utilidad lanza `new Error("algo")`. Siempre
`new ErrorServicio(codigo, mensaje)`, con la misma forma que el cuerpo de error de la API:

```ts
{ codigo: 'FOTO_REQUERIDA', mensaje: 'El reporte necesita al menos una foto.' }
```

La UI decide que mostrar mirando `codigo`, nunca parseando el texto. `mensajeParaUsuario(e)`
traduce el codigo a una frase para el vecino. Asi un error de red y un error del servidor se
manejan igual en la pantalla.

### 5. Los servicios ya son asincronos aunque el mock responda al instante

Si hoy fueran sincronos, cuando llegue la API habria que tocar todas las pantallas. Tambien por
eso todos los servicios devuelven `Promise` y las pantallas ya manejan los tres estados
(`EstadoCarga`, `EstadoVacio`, `EstadoError` en `src/ui`), que es lo que la catedra verifica
sobre la app entregada.

### 6. Diseno pensado para el publico del PRD

Cuerpo de 18 px (el default de React Native es 14), area tactil minima de 56 px, contraste alto,
un color por estado consistente entre mapa, lista y detalle. No es gusto: *"buena parte de
quienes reclaman tienen mas de 60. Letra grande, botones grandes"*, y se usa parado en la vereda,
al sol. Todo sale de `src/tema`; nadie escribe un color a mano en una pantalla.

---

## Convenciones de datos (del PRD, sin excepcion)

- Los identificadores son `string`, nunca `number`.
- Fechas y horas: texto **ISO 8601 con zona** (`"2026-09-14T10:22:00-03:00"`). Nunca un `Date`,
  nunca un numero. La conversion vive solo en `src/utils/fechas.ts`.
- Claves en `camelCase`.
- Un campo que puede no tener valor viene como `null`: no ausente y no `""`.
- La sesion viaja en `Authorization: Bearer <token>`. El token va a `expo-secure-store`,
  **nunca** a kv-store.
- Respuesta de la API: `{ "datos": ..., "meta": {...} }` en exito,
  `{ "error": { "codigo": ..., "mensaje": ... } }` en error.

### Nombres en el codigo

El dominio esta en castellano (`Reporte`, `Cuadrilla`, `zonaId`) porque asi estan los tipos del
PRD y asi habla el cliente. El codigo acompana: `listarReportes`, `encolar`, `puntoEnPoligono`.
No mezclar `getReports` con `listarReportes` en el mismo proyecto.

Los textos de la interfaz tratan al vecino de **vos** (como el mockup del PRD: *"a 12 m de vos"*).
Los comentarios del codigo van sin tildes a proposito, para no depender de la codificacion de
archivo de cuatro maquinas distintas.

---

## Tests

```powershell
npm test
npm test -- --coverage
```

Lo que esta cubierto hoy (101 casos):

- **`src/utils/__tests__/geo.test.ts`** — Haversine y point-in-polygon con sus casos limite:
  distancia 0, distancia conocida de 1 grado de latitud, el umbral exacto de 50 m, cruce del
  antimeridiano, coordenadas fuera de rango, punto sobre un vertice, punto sobre una arista,
  poligono abierto que se cierra solo, poligono con menos de 3 vertices, punto fuera de todas
  las zonas, filtrado por tipo de problema.
- **`src/utils/__tests__/ids.test.ts`** — formato `local-<uuid>`, deteccion de id local.
- **`src/utils/__tests__/fechas.test.ts`** — ISO con offset, formatos del mockup, orden
  descendente.
- **`src/servicios/__tests__/cola.test.ts`** — comportamiento de la cola: sin foto no encola,
  sin conexion no pierde nada, error de red se reintenta, error de datos no, tope de intentos,
  reintento forzado por el vecino, orden de envio, borrado de adjuntos al descartar.

Que testear y que no: **logica pura y reglas de negocio, si**. Pantallas, no (salvo que sobre
tiempo). El criterio es si el test se rompe cuando cambia el comportamiento, no cuando cambia
el color de un boton.

---

## Supuestos que tomamos

Estan marcados en el codigo como `SUPUESTO S-xx`. Si el cliente contesta distinto, se cambian.

| # | Supuesto | Donde |
| --- | --- | --- |
| S-01 | El registro publico solo crea **vecinos**. Las cuentas de operador las da de alta la Municipalidad. En modo mock, el email decide el rol. | `src/tipos/usuario.ts`, `src/servicios/auth.ts` |
| S-02 | La foto puede venir de camara **o** de galeria, pero sin al menos una foto no se envia nada. Depende de P-01. | `src/servicios/cola.ts` |
| S-03 | Si no hay geocodificacion inversa, la direccion se guarda como texto generico y el punto manda. | `src/tipos/cola.ts` |
| S-04 | Point-in-polygon trata lat/lon como plano cartesiano (valido para poligonos de pocos km). Punto sobre el borde cuenta como **dentro**. El poligono puede venir abierto: se cierra solo. | `src/utils/geo.ts` |
| S-05 | Si el punto cae fuera de las 4 zonas, el reporte **se envia igual** con `zonaId` sin asignar y lo clasifica el operador. No se le bloquea el reclamo al vecino por un error de GPS. | `src/utils/geo.ts`, `src/servicios/reportes.ts` |
| S-06 | Los poligonos de zona del mock son cuatro franjas inventadas sobre el ejido. Sirven para probar el calculo; no son los limites reales. | `src/mocks/zonas.ts` |
| S-07 | Mientras el reporte esta en la cola **no se muestra un codigo de seguimiento inventado**: dice "pendiente de envio". El codigo `GCHU-...` lo asigna el servidor. Depende de P-02. | `app/(vecino)/mis-reportes.tsx` |
| S-08 | Cerrar sesion **no borra** la cola de reportes sin subir. Son del vecino; la pantalla avisa que quedan en el telefono. | `src/servicios/auth.ts`, `app/(vecino)/ajustes.tsx` |
| S-09 | En respuestas de un solo elemento, `datos` es el objeto; en listas, el arreglo. El PRD solo muestra el caso lista. | `src/tipos/api.ts` |
| S-10 | Las notificaciones locales se disparan al detectar un cambio de estado durante la sincronizacion en primer plano, y al subirse un reporte que estaba en la cola. Sin push no hay aviso con la app cerrada. Depende de P-05. | `src/servicios/notificaciones.ts` |
| S-11 | La deteccion de duplicados compara contra la copia local cuando no hay red. Sin cache previo, offline no hay deteccion. Depende de P-03. | `src/servicios/reportes.ts` |
| S-12 | La biometria es un **atajo opcional**, no el camino principal: la contrasena siempre esta a la vista. Nadie queda trabado por no tener sensor. | `src/servicios/biometria.ts` |

---

## Preguntas abiertas para el cliente

El PRD lo pide expreso: *"cuando encuentren huecos, avisen: no los resuelvan por su cuenta"*.
Estas son las que conviene mandar juntas, antes de seguir. Las cuatro primeras bloquean codigo.

| # | Pregunta | Por que importa |
| --- | --- | --- |
| **P-01** | *"Sacar una foto es obligatorio"* y *"si no da permiso de camara no puede reportar"*, pero tambien se pide galeria (`expo-image-picker`) y el mockup tiene boton `[galeria]`. **¿Vale una foto de galeria?** | Si vale, el permiso de camara deja de ser bloqueante y se cae la garantia de "foto tomada parado frente al problema", que es lo que evita las discusiones. |
| **P-02** | El codigo `GCHU-2026-00412` es correlativo y lo asigna el servidor, pero el reporte se crea sin senal y el vecino *"tiene que llevarse un numero de seguimiento"*. **¿Que le mostramos mientras esta en la cola?** | Si le mostramos un codigo provisorio que despues cambia, la señora lo anota y en la ventanilla no existe. |
| **P-03** | Duplicados a 50 m: **¿contra reportes de cualquier tipo o solo del mismo tipo?** (un bache y una luminaria a 10 m no son el mismo problema). **¿Se excluyen los resueltos y rechazados? ¿Se acepta que offline no funcione** si el vecino nunca abrio la app con senal en esa zona? | Define la regla exacta y si hay que precargar un radio de reportes al abrir con conexion. |
| **P-04** | **Falta la entidad Adhesion.** `Reporte` solo tiene `adhesiones: number`. Con un contador no sabemos a quien avisar cuando cambia el estado, no podemos evitar que el mismo vecino se sume cinco veces, ni mostrar "los reportes a los que me sumé". | Hay que agregar `Adhesion { id, reporteId, usuarioId, fechaHora }` al modelo y a la API. |
| P-05 | La catedra pide notificaciones **locales**; el hecho que le importa al vecino (el operador cambio el estado) pasa en el servidor. **Sin push, el aviso llega cuando el vecino abre la app.** ¿Alcanza? | Es exactamente el punto que mas le importa a Claudia: *"se enoja porque nadie le dice nada"*. Mejor decirlo ahora. |
| P-06 | **¿Quien provee los poligonos reales de las cuatro zonas?** ¿Se solapan? ¿Que pasa si el punto cae fuera de todas (quintas, ruta, el rio)? El tipo `Reporte.zonaId` es `string`, no admite `null`. | Hoy asumimos S-05. Si el cliente quiere otra cosa, cambia el modelo. |
| P-07 | Existe `duplicadoDe` pero **"duplicado" no es uno de los cinco estados**. Cuando el operador marca A como duplicado de B: ¿que estado toma A? ¿Las adhesiones de A pasan a B? ¿El autor de A sigue recibiendo avisos? ¿A sigue en el mapa publico? | Sin esto no se puede cerrar la pantalla de duplicados del operador. |
| P-08 | **¿La API acepta una clave de idempotencia** (`Idempotency-Key` o el `idLocal` en el cuerpo)? | Sin eso, un corte de red en el momento justo crea el bache catorce veces otra vez, que es el problema que la app vino a resolver. |
| P-09 | **¿Como se crean las cuentas de operador?** ¿El rol viene en la respuesta del login? ¿Un operador ve solo su zona (`Usuario.zonaId`) o todas? | Define el guard de navegacion y los filtros de la bandeja. |
| P-10 | El mapa publico no debe mostrar quien reporto, pero `autorId` esta en el modelo. **¿La API lo filtra en el endpoint publico?** | Si no lo filtra el servidor, el dato sensible viaja igual al telefono. |
| P-11 | QR: **¿que lleva adentro y quien lo escanea?** ¿La chica de la ventanilla usa esta misma app con cuenta de operador? Si el QR lleva el codigo a secas, cualquiera que le saque una foto abre el reporte. | Define si hay que implementar lectura de QR ademas de generacion. |
| P-12 | La API pagina de a 20. **¿Hay endpoint por area (bbox) para el mapa** o hay que paginar toda la ciudad? | Con paginado de 20 el mapa no se puede pintar. |
| P-13 | **¿Duracion maxima de la nota de voz, peso maximo de foto, se comprime? ¿La API acepta multipart?** | Con senal intermitente, subir 8 MB por reporte no termina nunca. |
| P-14 | La catedra pide biometria para el reingreso general; el PRD solo la menciona para el operador, y el publico son mayores de 60 con telefonos viejos. **¿Confirmamos que la contrasena es el camino principal?** | Hoy asumimos S-12. |
| P-15 | *"Un rechazado tiene que decir por que"*, pero `CambioDeEstado.comentario` es `string \| null`. **¿Lo valida la API o solo la app?** | Hoy lo valida la app (`servicios/reportes.cambiarEstado`). Si la API no lo hace, entra basura por otro lado. |

---

## Los diez requisitos de la catedra: donde esta cada uno

| # | Requisito | Donde esta |
| --- | --- | --- |
| 1 | Pantallas y navegacion con Expo Router | `app/` con grupos `(auth)`, `(vecino)`, `(operador)`, detalle `reporte/[id]`, guard por rol en cada `_layout` |
| 2 | Autenticacion, sesion persistente, `expo-secure-store`, biometria con alternativa | `src/contexto/ContextoSesion.tsx`, `src/servicios/auth.ts`, `src/servicios/biometria.ts`, `app/(auth)/desbloquear.tsx` |
| 3 | Consumo de API detras de capa de servicios, con carga/vacio/error | `src/servicios/http.ts` (unico `fetch`), `src/servicios/*.ts`; los tres estados en `src/ui` y usados en todas las listas |
| 4 | Camara / galeria + `expo-file-system` (File, Directory, Paths) | `src/componentes/CapturaFoto.tsx`, `src/servicios/adjuntos.ts`, `src/datos/archivos.ts` |
| 5 | `expo-location` + `react-native-maps`, usable sin permiso | `src/servicios/ubicacion.ts`, `src/componentes/SelectorUbicacion.tsx`, `app/(vecino)/mapa.tsx`. Si niega el permiso, el mapa abre en Gualeguaychu y el punto se marca tocando |
| 6 | Notificaciones locales por un hecho real | `src/servicios/notificaciones.ts` + `src/servicios/sincronizacion.ts`: avisa cuando la sincronizacion detecta un cambio de estado o una adhesion nueva, y cuando la cola logra subir un reporte. Nunca por un boton de prueba |
| 7 | `expo-sqlite` + kv-store + `expo-network`, abre sin conexion | `src/datos/db.ts` (migraciones), `colaRepositorio.ts`, `reportesCache.ts`, `preferencias.ts`, `src/servicios/red.ts` |
| 8 | Sensores o haptica justificada | `src/servicios/haptica.ts`: confirmacion de envio (el vecino mira el pozo, no la pantalla), advertencia al detectar un duplicado cerca, obturador de la camara |
| 9 | Multimedia (`expo-audio`) con controles a la vista | `src/componentes/Audio.tsx`: grabador con cronometro y tope, reproductor con play/pausa, barra de avance y tiempos |
| 10 | Identidad: icono 1024x1024 sin transparencia, splash, nombre | `assets/icon.png` (1024x1024 RGB, sin alfa), `assets/splash-icon.png`, `app.json` |

---

## Problemas comunes

- **`npm install` falla por peer dependencies** → `npm install --legacy-peer-deps` y despues
  `npx expo install --fix`.
- **Los tests tiran `Unexpected token 'export'`** → el `transformIgnorePatterns` de
  `jest.config.js` quedo mal cerrado. El parentesis del grupo negado cierra al final.
- **El mapa sale gris en el APK pero se ve en Expo Go** → falta la clave de Google Maps en
  `app.json`.
- **`Cannot find module 'expo-sqlite'` en un test** → un test esta tocando la capa de datos.
  Los tests de cola usan `crearRepositorioEnMemoria()`, no SQLite.
- **ESLint se queja al importar algo de `src/mocks` o `src/datos` en una pantalla** → no es un
  falso positivo. Pedilo a traves de un servicio.
