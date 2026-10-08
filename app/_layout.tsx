/**
 * Layout raiz. Lo unico que hace:
 *  1. Envolver toda la app en el proveedor de sesion.
 *  2. Arrancar lo que tiene que correr una sola vez: notificaciones y vaciado
 *     automatico de la cola offline cuando vuelve la senal.
 *  3. Sostener el splash hasta saber si hay sesion guardada.
 *
 * Las decisiones de a donde mandar a cada usuario NO estan aca: estan en app/index.tsx
 * y en el _layout de cada grupo.
 */
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ProveedorSesion, useSesion } from '@/contexto/ContextoSesion';
import { iniciarAutoSincronizacion } from '@/servicios/cola';
import {
  configurar as configurarNotificaciones,
  notificarReporteEnviado,
  pedirPermiso as pedirPermisoNotificaciones,
} from '@/servicios/notificaciones';
import { colores } from '@/tema';

// Se llama fuera del componente: si se llamara adentro, el splash parpadearia en cada render.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function LayoutRaiz() {
  return (
    <ProveedorSesion>
      <StatusBar style="light" />
      <Arranque />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />
    </ProveedorSesion>
  );
}

/** Efectos de arranque. Va separado porque necesita estar dentro del proveedor. */
function Arranque() {
  const { estado } = useSesion();

  useEffect(() => {
    if (estado === 'cargando') return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [estado]);

  useEffect(() => {
    if (estado !== 'activa') return;
    void (async () => {
      await configurarNotificaciones().catch(() => undefined);
      // El permiso se pide recien cuando hay sesion, no al abrir la app por primera vez:
      // un permiso pedido antes de que el vecino entienda para que sirve se deniega solo.
      await pedirPermisoNotificaciones().catch(() => undefined);
    })();

    // Requisito 6 de la catedra: la notificacion la dispara un hecho real de la app.
    // Aca el hecho es "la cola consiguio subir un reporte que estaba esperando senal".
    const frenar = iniciarAutoSincronizacion((resultado) => {
      if (resultado.enviados > 0) {
        void notificarReporteEnviado(`${resultado.enviados} reporte(s)`);
      }
    });
    return frenar;
  }, [estado]);

  return null;
}
