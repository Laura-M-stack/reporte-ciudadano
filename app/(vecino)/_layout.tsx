/**
 * Guard + navegacion del vecino.
 *
 * El guard es una sola regla: si la sesion no esta activa, no se entra; si el que entro es
 * operador, se lo manda a su bandeja. El PRD es explicito: "al vecino no se le puede mostrar
 * el boton de cambiar estados", asi que los dos mundos son grupos de rutas distintos.
 */
import Ionicons from '@react-native-vector-icons/ionicons';
import { Redirect, Tabs } from 'expo-router';

import { useSesion } from '@/contexto/ContextoSesion';
import { TAMANO_TACTIL_MINIMO, colores, tipografia } from '@/tema';

export default function LayoutVecino() {
  const { estado, usuario } = useSesion();

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
        tabBarStyle: { height: TAMANO_TACTIL_MINIMO + 24, paddingBottom: 8, paddingTop: 8 },
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
