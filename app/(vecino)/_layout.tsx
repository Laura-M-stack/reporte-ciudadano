/**
 * Guard + navegacion del vecino.
 *
 * El guard es una sola regla: si la sesion no esta activa, no se entra; si el que entro es
 * operador, se lo manda a su bandeja. El PRD es explicito: "al vecino no se le puede mostrar
 * el boton de cambiar estados", asi que los dos mundos son grupos de rutas distintos.
 */
import Ionicons from '@react-native-vector-icons/ionicons';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSesion } from '@/contexto/ContextoSesion';
import { TAMANO_TACTIL_MINIMO, colores, tipografia } from '@/tema';

export default function LayoutVecino() {
  const { estado, usuario } = useSesion();
  // Hook llamado siempre, antes de cualquier return condicional de abajo (regla de los hooks).
  const insetes = useSafeAreaInsets();

  if (estado === 'cargando') return null;
  if (estado === 'bloqueada') return <Redirect href="/(auth)/desbloquear" />;
  if (estado !== 'activa') return <Redirect href="/(auth)/ingresar" />;
  if (usuario?.rol === 'operador') return <Redirect href="/(operador)/bandeja" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.textoSuave,
        tabBarLabelStyle: { fontSize: tipografia.chico.fontSize, fontWeight: '600' },
        // La barra de tabs tiene que despejar la barra de navegacion del sistema (los gestos/
        // flechitas de Android, que en algunos equipos nunca se ocultan). insetes.bottom es la
        // altura de esa zona; se suma al alto y al padding fijos en vez de usar numeros fijos
        // solos, que es lo que hacia que el menu quedara tapado.
        tabBarStyle: {
          height: TAMANO_TACTIL_MINIMO + 24 + insetes.bottom,
          paddingBottom: 8 + insetes.bottom,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="reportar"
        options={{
          title: 'Reportar',
          tabBarIcon: ({ color, size }) => <Ionicons name="camera" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="mis-reportes"
        options={{
          title: 'Mis reclamos',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="mapa"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color, size }) => <Ionicons name="map" color={color} size={size} />,
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
