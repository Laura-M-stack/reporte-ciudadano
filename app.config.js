/**
 * Configuracion dinamica de Expo.
 *
 * POR QUE EXISTE ESTE ARCHIVO Y NO ALCANZA CON app.json
 * La clave de Google Maps es un secreto: si queda escrita en app.json, viaja al repositorio,
 * y este repositorio es publico. Cualquiera podria levantarla y usarla contra la cuenta de
 * Google Cloud de quien la creo.
 *
 * Expo lee este archivo DESPUES de app.json y recibe su contenido en `config`. Aca inyectamos
 * la clave desde una variable de entorno, asi el valor real nunca toca el control de versiones:
 *
 *   - En la maquina de cada uno: en `.env` (que esta en .gitignore).
 *   - En los builds de EAS: como secreto del proyecto.
 *       eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_ANDROID --value <la-clave>
 *
 * Si la variable no esta, la app igual arranca y compila; lo unico que pasa es que el mapa
 * se ve en blanco. Preferimos eso a que el build falle: alguien que clona el repo para mirar
 * el codigo no deberia necesitar una clave de Google.
 *
 * ADEMAS DE NO COMMITEARLA, restringir la clave en Google Cloud a:
 *   - Aplicaciones Android
 *   - Nombre de paquete: ar.gob.gualeguaychu.reporteciudadano
 *   - Huella SHA-1 del keystore (se obtiene con `eas credentials`)
 * Con esas restricciones, una clave filtrada no le sirve a nadie mas.
 */

const CLAVE_MAPAS = process.env.GOOGLE_MAPS_API_KEY_ANDROID ?? '';

module.exports = ({ config }) => {
  // Se quita cualquier entrada previa de react-native-maps para no duplicarla, y se
  // vuelve a agregar con la clave que venga del entorno.
  const plugins = (config.plugins ?? []).filter((p) =>
    Array.isArray(p) ? p[0] !== 'react-native-maps' : p !== 'react-native-maps',
  );

  if (CLAVE_MAPAS) {
    plugins.push(['react-native-maps', { androidGoogleMapsApiKey: CLAVE_MAPAS }]);
  } else {
    // Aviso visible al correr `expo start` o `eas build`, para que nadie pierda media hora
    // preguntandose por que el mapa esta en blanco.
    console.warn(
      '[app.config.js] GOOGLE_MAPS_API_KEY_ANDROID no esta definida: el mapa se va a ver ' +
        'en blanco. Ver la seccion "Mapas" del README.',
    );
  }

  return { ...config, plugins };
};
