/**
 * Guard + navegacion del operador.
 *
 * "Alcanza con que la app sepa quien entro y le muestre lo que le corresponde" (PRD).
 * Un vecino que llegue a una ruta de /(operador) por un deep link rebota a su seccion.
 */
import Ionicons from '@react-native-vector-icons/ionicons';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSesion } from '@/contexto/ContextoSesion';
import { TAMANO_TACTIL_MINIMO, colores, tipografia } from '@/tema';

export default function LayoutOperador() {
  const { estado, usuario } = useSesion();
  // Hook llamado siempre, antes de cualquier return condicional de abajo (regla de los hooks).
  const insetes = useSafeAreaInsets();

  if (estado === 'cargando') return null;
  if (estado === 'bloqueada') return <Redirect href="/(auth)/desbloquear" />;
  if (estado !== 'activa') return <Redirect href="/(auth)/ingresar" />;
  if (usuario?.rol !== 'operador') return <Redirect href="/(vecino)/reportar" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.textoSuave,
        tabBarLabelStyle: { fontSize: tipografia.chico.fontSize, fontWeight: '600' },
        // Mismo ajuste que en (vecino)/_layout.tsx: sumar el inset inferior real del sistema
        // (la barra/gestos de navegacion de Android) en vez de un numero fijo, para que no
        // tape el menu en equipos donde esa barra nunca se oculta.
        tabBarStyle: {
          height: TAMANO_TACTIL_MINIMO + 24 + insetes.bottom,
          paddingBottom: 8 + insetes.bottom,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="bandeja"
        options={{
          title: 'Bandeja',
          tabBarIcon: ({ color, size }) => <Ionicons name="file-tray-full" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="escanear"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ color, size }) => <Ionicons name="qr-code" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="cuadrillas"
        options={{
          title: 'Cuadrillas',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
