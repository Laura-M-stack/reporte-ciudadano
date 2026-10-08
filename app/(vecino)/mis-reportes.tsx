/**
 * Mis reclamos. PRD: "ver la lista de reportes propios, del más nuevo al más viejo".
 *
 * Mezcla dos fuentes, y esa mezcla es la parte importante:
 *   - lo que ya esta en el servidor (servicios/reportes)
 *   - lo que todavia espera senal en la cola del telefono (servicios/cola)
 *
 * Si la lista solo mostrara lo del servidor, el vecino que reporto sin senal no veria su
 * reporte por ningun lado y lo cargaria de nuevo. Eso es exactamente el problema de los
 * catorce baches repetidos.
 *
 * Al refrescar no solo recarga: compara con la copia local y dispara las notificaciones
 * locales por los cambios de estado (ver src/servicios/sincronizacion.ts).
 */
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useSesion } from '@/contexto/ContextoSesion';
import { mensajeParaUsuario } from '@/errores';
import { cola } from '@/servicios/cola';
import { listarMisReportes } from '@/servicios/reportes';
import { refrescarYAvisar } from '@/servicios/sincronizacion';
import { espacio } from '@/tema';
import type { Reporte, ReporteEnCola } from '@/tipos';
import { formatearFechaHora, tiempoRelativo } from '@/utils';
import {
  Aviso,
  Boton,
  EstadoCarga,
  EstadoError,
  EstadoVacio,
  EtiquetaEstado,
  Parrafo,
  Tarjeta,
  Titulo,
} from '@/ui';

export default function MisReportes() {
  const { usuario } = useSesion();
  const [reportes, setReportes] = useState<Reporte[] | null>(null);
  const [pendientes, setPendientes] = useState<ReporteEnCola[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [accionError, setAccionError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    if (!usuario) return;
    setError(null);
    try {
      const pagina = await listarMisReportes(usuario.id);
      setReportes(pagina.datos);
    } catch (e) {
      setError(e);
    }
  }, [usuario]);

  useEffect(() => {
    // El reset de estado antes del await es intencional (limpia el error previo al recargar); cuesta un render extra al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
    // La cola avisa sola cuando cambia: no hace falta refrescar a mano despues de encolar.
    return cola.suscribir((items) => {
      setPendientes(items.filter((i) => i.estadoEnvio !== 'enviado'));
    });
  }, [cargar]);

  async function alRefrescar() {
    if (!usuario) return;
    setRefrescando(true);
    try {
      // Primero intenta vaciar la cola: si volvio la señal, lo pendiente sube ahora.
      await cola.reintentar();
      // Despues compara con la copia local y notifica los cambios de estado.
      await refrescarYAvisar(usuario.id);
      await cargar();
    } finally {
      setRefrescando(false);
    }
  }

  async function reintentarUno(idLocal: string) {
    setAccionError(null);
    try {
      const resultado = await cola.reintentar(idLocal);
      if (resultado.fallados > 0) {
        setAccionError(resultado.errores[0]?.mensaje ?? 'No se pudo enviar todavia.');
      }
      await cargar();
    } catch (e) {
      setAccionError(mensajeParaUsuario(e));
    }
  }

  async function descartar(idLocal: string) {
    setAccionError(null);
    try {
      await cola.eliminar(idLocal);
    } catch (e) {
      setAccionError(mensajeParaUsuario(e));
    }
  }

  if (error) {
    return (
      <ScrollView contentContainerStyle={{ padding: espacio.md }}>
        <EstadoError error={error} alReintentar={cargar} />
      </ScrollView>
    );
  }
  if (!reportes) return <EstadoCarga texto="Buscando tus reclamos..." />;

  const vacio = reportes.length === 0 && pendientes.length === 0;

  return (
    <ScrollView
      contentContainerStyle={{ padding: espacio.md, gap: espacio.md, paddingBottom: espacio.xxl }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={alRefrescar} />}
    >
      <Titulo>Mis reclamos</Titulo>

      {!!accionError && <Aviso texto={accionError} tono="error" />}

      {pendientes.length > 0 && (
        <Aviso
          tono="alerta"
          texto={`${pendientes.length} reporte${pendientes.length === 1 ? '' : 's'} esperando señal. Se envían solos cuando vuelva la conexión.`}
        />
      )}

      {vacio && (
        <EstadoVacio
          titulo="Todavia no reportaste nada"
          detalle="Cuando veas un problema en la calle, sacale una foto y contanos."
        />
      )}

      {/* Primero lo pendiente: es lo que el vecino acaba de cargar y quiere ver. */}
      {pendientes.map((item) => (
        <Tarjeta key={item.idLocal}>
          <Parrafo>{item.borrador.direccion}</Parrafo>
          {/* S-07: no mostramos un codigo inventado. El oficial lo asigna el servidor. */}
          <Parrafo suave>
            {item.estadoEnvio === 'error' ? 'No se pudo enviar' : 'Pendiente de envío'} ·{' '}
            {tiempoRelativo(item.creadoEn)}
          </Parrafo>
          {!!item.ultimoError && <Parrafo suave>{item.ultimoError.mensaje}</Parrafo>}
          {item.estadoEnvio === 'error' && (
            <View style={{ gap: espacio.sm }}>
              <Boton
                titulo="Reintentar ahora"
                variante="secundario"
                alTocar={() => void reintentarUno(item.idLocal)}
              />
              <Boton
                titulo="Descartar este reporte"
                variante="peligro"
                alTocar={() => void descartar(item.idLocal)}
              />
            </View>
          )}
        </Tarjeta>
      ))}

      {reportes.map((reporte) => (
        <Link key={reporte.id} href={{ pathname: '/reporte/[id]', params: { id: reporte.id } }} asChild>
          <Pressable accessibilityRole="button">
            <Tarjeta>
              <EtiquetaEstado estado={reporte.estado} />
              <Parrafo>{reporte.direccion}</Parrafo>
              <Parrafo suave>
                {reporte.codigo} · {formatearFechaHora(reporte.creadoEn)}
              </Parrafo>
              {reporte.adhesiones > 0 && (
                <Parrafo suave>{reporte.adhesiones} vecinos se sumaron</Parrafo>
              )}
            </Tarjeta>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}
