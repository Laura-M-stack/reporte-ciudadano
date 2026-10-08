/**
 * Ingreso. Persona 1.
 *
 * Funciona contra el mock: cualquiera de los dos emails de prueba + una clave de 6 o mas
 * caracteres. Sirve como ejemplo del patron que usan todas las pantallas:
 * estado local -> servicio -> ErrorServicio -> mensajeParaUsuario.
 */
import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useSesion } from '@/contexto/ContextoSesion';
import { mensajeParaUsuario } from '@/errores';
import { Aviso, Boton, Campo, Pantalla, Parrafo, Titulo } from '@/ui';

export default function Ingresar() {
  const { ingresar } = useSesion();
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function alIngresar() {
    setError(null);
    setEnviando(true);
    try {
      await ingresar({ email, clave });
    } catch (e) {
      setError(mensajeParaUsuario(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla>
      <Titulo>Reporte Ciudadano</Titulo>
      <Parrafo suave>Municipalidad de Gualeguaychú</Parrafo>

      {!!error && <Aviso texto={error} tono="error" />}

      <Campo
        etiqueta="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="tunombre@correo.com"
      />
      <Campo
        etiqueta="Contraseña"
        value={clave}
        onChangeText={setClave}
        secureTextEntry
        autoComplete="current-password"
        placeholder="Al menos 6 caracteres"
      />

      <Boton titulo="Ingresar" alTocar={alIngresar} cargando={enviando} />

      <View>
        <Link href="/(auth)/registro">
          <Parrafo>No tengo cuenta. Quiero registrarme.</Parrafo>
        </Link>
      </View>

      {/* TODO Persona 1: ofrecer "entrar con huella" si hay sesion guardada y biometria activa. */}
    </Pantalla>
  );
}
