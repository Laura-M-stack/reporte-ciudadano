/**
 * Nuevo reporte. Es la pantalla mas importante de la app: el PRD pide que se pueda
 * completar "en menos de un minuto, parado en la vereda".
 *
 * Decisiones que vienen de ese requisito:
 *  - Todo en UNA pantalla con scroll, no un asistente de cinco pasos. Cada pantalla nueva
 *    es gente que abandona y vuelve al WhatsApp.
 *  - El boton de enviar esta siempre visible al final y dice por que no se puede enviar
 *    todavia, en vez de estar gris y mudo.
 *  - El envio pasa SIEMPRE por la cola (cola.encolar), haya o no senal. Un solo camino.
 *
 * Reglas del PRD implementadas aca:
 *  - Foto obligatoria (la valida tambien la cola, por las dudas).
 *  - Ubicacion del GPS, corregible a mano; si niega el permiso, igual puede reportar.
 *  - Antes de crear, mostrar los reportes a menos de 50 m y ofrecer sumarse.
 *  - Descripcion escrita o hablada.
 *  - Al terminar, numero de seguimiento visible (o "pendiente de envío", ver S-07).
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GrabadorAudio } from '@/componentes/Audio';
import { CapturaFoto } from '@/componentes/CapturaFoto';
import { SelectorUbicacion } from '@/componentes/SelectorUbicacion';
import { useSesion } from '@/contexto/ContextoSesion';
import { mensajeParaUsuario } from '@/errores';
import { elegirDeGaleria, registrarAudio, registrarFoto } from '@/servicios/adjuntos';
import { listarTiposDeReporte, listarZonas } from '@/servicios/catalogos';
import { cola } from '@/servicios/cola';
import * as haptica from '@/servicios/haptica';
import { adherirseAReporte, reportesCercaDe } from '@/servicios/reportes';
import {
  DIRECCION_SIN_RESOLVER,
  PUNTOS_DE_PRUEBA,
  direccionDe,
  ubicacionActual,
} from '@/servicios/ubicacion';
import { colores, espacio, radios, tipografia } from '@/tema';
import type { AdjuntoLocal, Coordenadas, Reporte, TipoDeReporte, Zona } from '@/tipos';
import {
  RADIO_DUPLICADOS_M,
  codigoProvisorio,
  distanciaEnMetros,
  formatearDistancia,
  zonaIdDePunto,
} from '@/utils';
import {
  Aviso,
  Boton,
  EstadoCarga,
  EstadoError,
  Pantalla,
  Parrafo,
  Subtitulo,
  Tarjeta,
  Titulo,
} from '@/ui';

/** Hasta dos fotos, como pide el PRD ("poder agregar una segunda foto"). */
const MAX_FOTOS = 2;

export default function Reportar() {
  const router = useRouter();
  const { usuario } = useSesion();

  // Catalogos
  const [tipos, setTipos] = useState<TipoDeReporte[] | null>(null);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [errorCarga, setErrorCarga] = useState<unknown>(null);

  // Borrador en pantalla
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [fotos, setFotos] = useState<AdjuntoLocal[]>([]);
  const [audio, setAudio] = useState<AdjuntoLocal | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [punto, setPunto] = useState<Coordenadas | null>(null);
  const [direccion, setDireccion] = useState(DIRECCION_SIN_RESOLVER);
  const [movidoAMano, setMovidoAMano] = useState(false);
  const [permisoUbicacion, setPermisoUbicacion] = useState<boolean | null>(null);

  // Duplicados
  const [cercanos, setCercanos] = useState<Reporte[]>([]);
  const [ignorarCercanos, setIgnorarCercanos] = useState(false);

  // Interaccion
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<{
    codigo: string | null;
    enCola: boolean;
    idLocal: string;
  } | null>(null);

  const puntoChequeado = useRef<string>('');

  /* ------------------------------------------------------------ carga inicial */

  const cargar = useCallback(async () => {
    setErrorCarga(null);
    try {
      const [listaTipos, listaZonas] = await Promise.all([listarTiposDeReporte(), listarZonas()]);
      setTipos(listaTipos);
      setZonas(listaZonas);
    } catch (e) {
      setErrorCarga(e);
    }
  }, []);

  useEffect(() => {
    // El reset de estado antes del await es intencional (limpia el error previo al recargar); cuesta un render extra al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  // Ubicacion al abrir la pantalla: el PRD pide que se tome sola.
  useEffect(() => {
    void (async () => {
      const resultado = await ubicacionActual();
      setPermisoUbicacion(resultado.permisoConcedido);
      if (resultado.coordenadas) {
        setPunto(resultado.coordenadas);
        setDireccion(await direccionDe(resultado.coordenadas));
      }
    })();
  }, []);

  /* -------------------------------------------------------------- duplicados */

  // Cada vez que hay tipo + punto, buscamos que hay cerca. Se vuelve a chequear si el
  // vecino mueve el punto o cambia el tipo, porque las dos cosas cambian la respuesta.
  useEffect(() => {
    if (!punto || !tipoId) return;
    const clave = `${tipoId}|${punto.latitud.toFixed(5)}|${punto.longitud.toFixed(5)}`;
    if (puntoChequeado.current === clave) return;
    puntoChequeado.current = clave;

    void (async () => {
      try {
        // P-03 (resuelto en el foro): mismo tipo de problema, y ya resuelto o rechazado no
        // cuenta. Las dos reglas viven en un solo lugar (reportesCercanos, en
        // src/utils/geo.ts) para que esta pantalla y la cache offline no se desalineen.
        const encontrados = await reportesCercaDe(punto, RADIO_DUPLICADOS_M, tipoId);
        setCercanos(encontrados);
        setIgnorarCercanos(false);
        if (encontrados.length > 0) void haptica.avisarDuplicadoCerca();
      } catch {
        // Sin red y sin copia local no hay deteccion de duplicados. No bloquea el reporte.
        setCercanos([]);
      }
    })();
  }, [punto, tipoId]);

  /* ------------------------------------------------------------------ acciones */

  function agregarFotoTemporal(uriTemporal: string) {
    try {
      setFotos((actuales) => [...actuales, registrarFoto(uriTemporal)].slice(0, MAX_FOTOS));
      setCamaraAbierta(false);
      setError(null);
    } catch (e) {
      setError(mensajeParaUsuario(e));
    }
  }

  async function agregarDeGaleria() {
    try {
      const elegida = await elegirDeGaleria();
      if (elegida) setFotos((actuales) => [...actuales, elegida].slice(0, MAX_FOTOS));
    } catch (e) {
      setError(mensajeParaUsuario(e));
    }
  }

  async function moverPunto(nuevo: Coordenadas) {
    setPunto(nuevo);
    setMovidoAMano(true);
    setDireccion(await direccionDe(nuevo));
  }

  async function sumarseA(reporte: Reporte) {
    if (!usuario) return;
    setEnviando(true);
    try {
      await adherirseAReporte(reporte.id, usuario.id);
      void haptica.confirmarEnvio();
      router.push({ pathname: '/reporte/[id]', params: { id: reporte.id } });
    } catch (e) {
      setError(mensajeParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  function limpiar() {
    setTipoId(null);
    setFotos([]);
    setAudio(null);
    setDescripcion('');
    setCercanos([]);
    setIgnorarCercanos(false);
    setMovidoAMano(false);
    puntoChequeado.current = '';
  }

  async function enviar() {
    if (!tipoId || !punto) return;
    setError(null);
    setEnviando(true);
    try {
      const adjuntos = audio ? [...fotos, audio] : fotos;
      const item = await cola.encolar({
        tipoId,
        descripcion: descripcion.trim() || null,
        coordenadas: punto,
        direccion,
        // El calculo de zona es logica pura y corre offline: no depende de la API.
        zonaId: zonaIdDePunto(punto, zonas),
        adjuntos,
        adhiereAReporteId: null,
        ubicacionCorregidaAMano: movidoAMano,
      });

      // Si hay senal se sube en el acto; si no, queda en la cola y se sube solo despues.
      const resultado = await cola.reintentar(item.idLocal);
      const guardado = await cola.obtener(item.idLocal);

      void haptica.confirmarEnvio();
      setExito({
        codigo: guardado?.codigoRemoto ?? null,
        enCola: resultado.enviados === 0,
        idLocal: item.idLocal,
      });
      limpiar();
    } catch (e) {
      void haptica.errorAlEnviar();
      setError(mensajeParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  /* -------------------------------------------------------------- validacion */

  const faltante = !tipoId
    ? 'Elegí qué tipo de problema es'
    : fotos.length === 0
      ? 'Sacá una foto del problema'
      : !punto
        ? 'Marcá en el mapa dónde está'
        : null;

  /* ------------------------------------------------------------------ render */

  if (errorCarga) {
    return (
      <Pantalla>
        <EstadoError error={errorCarga} alReintentar={cargar} />
      </Pantalla>
    );
  }
  if (!tipos) {
    return (
      <Pantalla>
        <EstadoCarga texto="Preparando el formulario..." />
      </Pantalla>
    );
  }

  if (exito) {
    return (
      <Pantalla>
        <Titulo>Listo, lo recibimos</Titulo>
        {exito.enCola ? (
          <>
            {/*
              P-02 (resuelto): mostramos un código PROVISORIO, derivado del idLocal, para
              que el vecino tenga algo para anotar. El oficial (GCHU-2026-xxxxx) lo asigna
              el servidor recien al sincronizar.
            */}
            <Aviso
              tono="alerta"
              texto={`Tu código provisorio es ${codigoProvisorio(exito.idLocal)}. Quedó guardado en el teléfono y se va a enviar solo cuando vuelva la señal. No hace falta que hagas nada.`}
            />
            <Parrafo suave>
              Cuando se sincronice vas a ver el número de seguimiento oficial en Mis reclamos.
            </Parrafo>
          </>
        ) : (
          <>
            <Aviso tono="info" texto={`Tu número de seguimiento es ${exito.codigo ?? '—'}`} />
            <Parrafo suave>Anotalo o sacale una foto a esta pantalla.</Parrafo>
          </>
        )}
        <Boton titulo="Ver mis reclamos" alTocar={() => router.push('/(vecino)/mis-reportes')} />
        <Boton titulo="Reportar otra cosa" variante="secundario" alTocar={() => setExito(null)} />
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <Titulo>¿Qué pasa?</Titulo>

      {!!error && <Aviso texto={error} tono="error" />}

      {/* 1. Tipo de problema */}
      <View style={estilos.grilla}>
        {tipos.map((tipo) => {
          const activo = tipoId === tipo.id;
          return (
            <Pressable
              key={tipo.id}
              onPress={() => {
                void haptica.seleccion();
                setTipoId(tipo.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={tipo.nombre}
              style={[estilos.opcion, activo && { borderColor: tipo.color, borderWidth: 3 }]}
            >
              <View style={[estilos.punto, { backgroundColor: tipo.color }]} />
              <Text style={estilos.opcionTexto}>{tipo.nombre}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 2. Fotos */}
      <Subtitulo>Foto (obligatoria)</Subtitulo>
      {fotos.length > 0 && (
        <View style={estilos.fotos}>
          {fotos.map((foto) => (
            <View key={foto.id} style={estilos.miniatura}>
              <Image source={{ uri: foto.uri }} style={estilos.miniaturaImagen} />
              <Pressable
                onPress={() => setFotos((actuales) => actuales.filter((f) => f.id !== foto.id))}
                accessibilityRole="button"
                accessibilityLabel="Quitar esta foto"
                style={estilos.quitar}
              >
                <Text style={estilos.quitarTexto}>Quitar</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {fotos.length < MAX_FOTOS && (
        <View style={estilos.fila}>
          <View style={estilos.mitad}>
            <Boton titulo="Tomar foto" alTocar={() => setCamaraAbierta(true)} />
          </View>
          <View style={estilos.mitad}>
            <Boton
              titulo="Galería"
              variante="secundario"
              alTocar={() => void agregarDeGaleria()}
            />
          </View>
        </View>
      )}
      {fotos.length === 1 && (
        <Parrafo suave>Si con una foto no se entiende, agregá una segunda.</Parrafo>
      )}

      {/* 3. Ubicacion */}
      <Subtitulo>Donde</Subtitulo>
      {permisoUbicacion === false && (
        <Aviso
          tono="alerta"
          texto="No nos diste la ubicación, no hay problema: tocá el mapa para marcar dónde está."
        />
      )}
      <Parrafo>{direccion}</Parrafo>
      {/*
        Las coordenadas a la vista: mientras el mapa no renderice son la unica forma de
        confirmar que el punto es el correcto. Tambien sirven para leerlas en voz alta al
        reportar un problema del propio mapa.
      */}
      {!!punto && (
        <Parrafo suave>
          {punto.latitud.toFixed(5)}, {punto.longitud.toFixed(5)}
        </Parrafo>
      )}
      <SelectorUbicacion punto={punto} alMover={(c) => void moverPunto(c)} />

      {/*
        Solo en desarrollo. El equipo esta repartido en cuatro provincias y ninguno vive en
        Gualeguaychú: sin estos atajos no hay forma de probar la asignación de zona ni la
        detección de duplicados a 50 m, que solo funcionan dentro del ejido.
        `__DEV__` es false en el APK de entrega, asi que esta fila no se ve ahi.
      */}
      {__DEV__ && (
        <View style={estilos.pruebas}>
          <Parrafo suave>Solo en desarrollo: saltar a un punto de Gualeguaychú</Parrafo>
          <View style={estilos.grillaPruebas}>
            {PUNTOS_DE_PRUEBA.map((p) => {
              // Se marca el que coincide con el punto actual, para que se vea que el toque
              // hizo algo: sin el mapa renderizando, no habia ninguna senal.
              const activo =
                !!punto &&
                Math.abs(punto.latitud - p.punto.latitud) < 1e-6 &&
                Math.abs(punto.longitud - p.punto.longitud) < 1e-6;
              return (
                <Pressable
                  key={p.nombre}
                  onPress={() => void moverPunto(p.punto)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activo }}
                  style={[estilos.chipPrueba, activo && estilos.chipPruebaActivo]}
                >
                  <Text style={[estilos.chipPruebaTexto, activo && estilos.chipPruebaTextoActivo]}>
                    {p.nombre}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      <Parrafo suave>
        {punto
          ? 'Si el punto no quedó bien, tocá el mapa o arrastrá el marcador.'
          : 'Tocá el mapa para marcar dónde está el problema.'}
      </Parrafo>

      {/* 4. Duplicados a 50 m */}
      {cercanos.length > 0 && !ignorarCercanos && (
        <View style={estilos.duplicados}>
          <Subtitulo>Ya hay un reclamo parecido acá cerca</Subtitulo>
          <Parrafo suave>
            Si es el mismo problema, sumate en vez de crear otro: cuantos más vecinos se suman,
            más arriba va en la lista de Obras.
          </Parrafo>
          {cercanos.map((reporte) => (
            <Tarjeta key={reporte.id}>
              <Parrafo>{reporte.direccion}</Parrafo>
              <Parrafo suave>
                {punto ? formatearDistancia(distanciaEnMetros(punto, reporte.coordenadas)) : ''} ·{' '}
                {reporte.adhesiones} vecinos ya se sumaron
              </Parrafo>
              <Boton
                titulo="Es el mismo, sumarme"
                alTocar={() => void sumarseA(reporte)}
                cargando={enviando}
              />
            </Tarjeta>
          ))}
          <Boton
            titulo="No, es otro problema"
            variante="secundario"
            alTocar={() => setIgnorarCercanos(true)}
          />
        </View>
      )}

      {/* 5. Descripcion */}
      <Subtitulo>Contanos</Subtitulo>
      <TextInput
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Escribí qué pasa (opcional)"
        placeholderTextColor={colores.textoSuave}
        multiline
        numberOfLines={4}
        accessibilityLabel="Descripción del problema"
        style={estilos.area}
      />
      <Parrafo suave>O contalo hablando, si te resulta más cómodo:</Parrafo>
      <GrabadorAudio
        uriGrabada={audio?.uri ?? null}
        alGrabar={(uriTemporal) => {
          try {
            setAudio(registrarAudio(uriTemporal));
          } catch (e) {
            setError(mensajeParaUsuario(e));
          }
        }}
        alBorrar={() => setAudio(null)}
      />

      {/* 6. Enviar */}
      {faltante ? (
        <Aviso tono="alerta" texto={`Para enviar falta: ${faltante}.`} />
      ) : (
        <Boton titulo="E N V I A R" alTocar={() => void enviar()} cargando={enviando} />
      )}

      <CapturaFoto
        visible={camaraAbierta}
        alTomar={agregarFotoTemporal}
        alCerrar={() => setCamaraAbierta(false)}
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
  opcion: {
    minWidth: '47%',
    flexGrow: 1,
    minHeight: 76,
    borderRadius: radios.md,
    borderWidth: 2,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.xs,
    padding: espacio.sm,
  },
  punto: { width: 16, height: 16, borderRadius: radios.completo },
  opcionTexto: { ...tipografia.cuerpoFuerte, color: colores.texto, textAlign: 'center' },

  fila: { flexDirection: 'row', gap: espacio.sm },
  mitad: { flex: 1 },

  fotos: { flexDirection: 'row', gap: espacio.sm, flexWrap: 'wrap' },
  miniatura: { gap: espacio.xs },
  miniaturaImagen: {
    width: 140,
    height: 140,
    borderRadius: radios.md,
    backgroundColor: colores.superficieSuave,
  },
  quitar: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  quitarTexto: { ...tipografia.cuerpo, color: colores.error, textDecorationLine: 'underline' },

  pruebas: {
    gap: espacio.sm,
    padding: espacio.sm,
    borderRadius: radios.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colores.bordeFuerte,
  },
  grillaPruebas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
  chipPrueba: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: espacio.md,
    borderRadius: radios.completo,
    borderWidth: 1,
    borderColor: colores.bordeFuerte,
    backgroundColor: colores.superficie,
  },
  chipPruebaTexto: { ...tipografia.chico, color: colores.textoSuave },
  chipPruebaActivo: { backgroundColor: colores.primario, borderColor: colores.primario },
  chipPruebaTextoActivo: { color: colores.textoInverso, fontWeight: '700' },

  duplicados: {
    gap: espacio.sm,
    padding: espacio.md,
    borderRadius: radios.md,
    borderWidth: 2,
    borderColor: colores.alerta,
    backgroundColor: colores.alertaSuave,
  },

  area: {
    minHeight: 110,
    borderWidth: 2,
    borderColor: colores.bordeFuerte,
    borderRadius: radios.md,
    padding: espacio.md,
    backgroundColor: colores.superficie,
    textAlignVertical: 'top',
    ...tipografia.cuerpo,
    color: colores.texto,
  },
});
