/**
 * Reingreso con huella o rostro. Persona 1.
 *
 * Requisito 2 de la catedra: "El reingreso se resuelve con expo-local-authentication, con
 * alternativa para el dispositivo que no la tenga". La alternativa esta siempre a la vista,
 * no escondida: el publico del PRD son mayores de 60 con telefonos sin sensor.
 */
import { useEffect, useState } from 'react';

import { useSesion } from '@/contexto/ContextoSesion';
import { mensajeParaUsuario } from '@/errores';
import { Aviso, Boton, Pantalla, Parrafo, Titulo } from '@/ui';

export default function Desbloquear() {
  const { usuario, desbloquearConBiometria, usarContrasena } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const [intentando, setIntentando] = useState(false);

  async function pedirHuella() {
    setError(null);
    setIntentando(true);
    try {
      const ok = await desbloquearConBiometria();
      if (!ok) setError('No se pudo confirmar tu identidad. Proba de nuevo o usa tu contraseña.');
    } catch (e) {
      setError(mensajeParaUsuario(e));
    } finally {
      setIntentando(false);
    }
  }

  // Un intento automatico al abrir: es lo que espera el usuario que activo la huella.
  useEffect(() => {
    // El reset de estado antes del await es intencional (limpia el error previo al recargar); cuesta un render extra al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void pedirHuella();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Pantalla>
      <Titulo>Hola de nuevo{usuario ? `, ${usuario.nombre.split(' ')[0]}` : ''}</Titulo>
      <Parrafo suave>Confirma que sos vos para entrar.</Parrafo>
      {!!error && <Aviso texto={error} tono="alerta" />}
      <Boton titulo="Usar huella o rostro" alTocar={pedirHuella} cargando={intentando} />
      <Boton titulo="Prefiero mi contraseña" variante="secundario" alTocar={usarContrasena} />
    </Pantalla>
  );
}
