/**
 * Registro de vecino. Persona 1.
 *
 * SUPUESTO S-01: el registro publico solo crea vecinos. Las cuentas de operador las da
 * de alta la Municipalidad (pendiente de confirmar con el cliente, P-09).
 */
import { router } from 'expo-router';
import { useState } from 'react';

import { useSesion } from '@/contexto/ContextoSesion';
import { mensajeParaUsuario } from '@/errores';
import { Aviso, Boton, Campo, Pantalla, Parrafo, Titulo } from '@/ui';

export default function Registro() {
  const { registrar } = useSesion();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function alRegistrar() {
    setError(null);
    setEnviando(true);
    try {
      await registrar({ nombre, email, clave, telefono: telefono.trim() || null });
    } catch (e) {
      setError(mensajeParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla>
      <Titulo>Crear cuenta</Titulo>
      <Parrafo suave>Con la cuenta podes seguir tus reclamos y recibir avisos.</Parrafo>

      {!!error && <Aviso texto={error} tono="error" />}

      <Campo etiqueta="Nombre y apellido" value={nombre} onChangeText={setNombre} />
      <Campo
        etiqueta="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Campo
        etiqueta="Telefono (opcional)"
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
      />
      <Campo etiqueta="Contrasena" value={clave} onChangeText={setClave} secureTextEntry />

      <Boton titulo="Crear cuenta" alTocar={alRegistrar} cargando={enviando} />
      <Boton titulo="Ya tengo cuenta" variante="secundario" alTocar={() => router.back()} />
    </Pantalla>
  );
}
