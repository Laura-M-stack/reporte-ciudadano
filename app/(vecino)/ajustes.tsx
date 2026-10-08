/**
 * Ajustes del vecino. Persona 1 (sesion y biometria) + Persona 3 (avisos).
 */
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { useSesion } from '@/contexto/ContextoSesion';
import { mensajeParaUsuario } from '@/errores';
import * as biometria from '@/servicios/biometria';
import { actualizarAvisos, avisosActivos } from '@/servicios/auth';
import { cola } from '@/servicios/cola';
import { espacio } from '@/tema';
import { Aviso, Boton, Pantalla, Parrafo, Tarjeta, Titulo } from '@/ui';

export default function Ajustes() {
  const { usuario, salir } = useSesion();
  const [avisos, setAvisos] = useState(true);
  const [huella, setHuella] = useState(false);
  const [hayHuella, setHayHuella] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setAvisos(await avisosActivos());
      setHuella(await biometria.estaHabilitada());
      setHayHuella((await biometria.disponibilidad()).hayRegistro);
    })();
    return cola.suscribir((items) => {
      setPendientes(items.filter((i) => i.estadoEnvio !== 'enviado').length);
    });
  }, []);

  async function cambiarAvisos(valor: boolean) {
    setAvisos(valor);
    try {
      await actualizarAvisos(valor);
    } catch (e) {
      setError(mensajeParaUsuario(e));
      setAvisos(!valor);
    }
  }

  async function cambiarHuella(valor: boolean) {
    setError(null);
    try {
      await biometria.habilitar(valor);
      setHuella(valor);
    } catch (e) {
      setError(mensajeParaUsuario(e));
    }
  }

  return (
    <Pantalla>
      <Titulo>Ajustes</Titulo>
      {!!usuario && <Parrafo suave>{usuario.nombre} - {usuario.email}</Parrafo>}
      {!!error && <Aviso texto={error} tono="error" />}

      <Tarjeta>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.md }}>
          <Parrafo>Recibir avisos de mis reclamos</Parrafo>
          <Switch value={avisos} onValueChange={cambiarAvisos} />
        </View>
      </Tarjeta>

      <Tarjeta>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.md }}>
          <Parrafo>Entrar con huella o rostro</Parrafo>
          <Switch value={huella} onValueChange={cambiarHuella} disabled={!hayHuella} />
        </View>
        {!hayHuella && (
          <Parrafo suave>Este telefono no tiene huella ni rostro configurados.</Parrafo>
        )}
      </Tarjeta>

      {pendientes > 0 && (
        <Aviso
          tono="alerta"
          texto={`Tenes ${pendientes} reporte(s) sin enviar. Si cerras sesion se siguen guardando en este telefono.`}
        />
      )}

      <Boton titulo="Cerrar sesion" variante="secundario" alTocar={() => void salir()} />
    </Pantalla>
  );
}
