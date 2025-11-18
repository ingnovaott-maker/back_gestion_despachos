/* eslint-disable max-len */
import { GeneradorContrasena } from 'App/Dominio/GenerarContrasena/GenerarContrasena'
import { ServicioUsuarios } from './ServicioUsuarios'
import { ServicioAutenticacionJWT } from 'App/Dominio/Datos/Servicios/ServicioJWT'
import { Exception } from '@adonisjs/core/build/standalone'
import { RespuestaInicioSesion } from 'App/Dominio/Dto/RespuestaInicioSesion'
import { Usuario } from '../Entidades/Usuario'
import { Encriptador } from 'App/Dominio/Encriptacion/Encriptador'
import { RepositorioBloqueoUsuario } from 'App/Dominio/Repositorios/RepositorioBloqueoUsuario'
import { RegistroBloqueo } from '../Entidades/Usuarios/RegistroBloqueo'
import { v4 as uuid } from 'uuid'
import { RepositorioAutorizacion } from 'App/Dominio/Repositorios/RepositorioAutorizacion'
import { RepositorioUsuario } from 'App/Dominio/Repositorios/RepositorioUsuario'
import { EnviadorEmail } from 'App/Dominio/Email/EnviadorEmail'
import { RolDto } from 'App/Presentacion/Autenticacion/Dtos/RolDto'
import Env from '@ioc:Adonis/Core/Env';
import { ServicioAutenticacionExterna } from 'App/Dominio/Datos/Servicios/ServicioAutenticacionExterna'
import { TokenExterno } from 'App/Dominio/Utilidades/TokenExterno'
import { RepositorioUsuarioModuloDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioUsuarioModuloDB'

export class ServicioAutenticacion {
  private servicioUsuario: ServicioUsuarios

  constructor(
    private encriptador: Encriptador,
    private enviadorEmail: EnviadorEmail,
    private repositorioBloqueo: RepositorioBloqueoUsuario,
    private repositorioAutorizacion: RepositorioAutorizacion,
    private repositorioUsuario: RepositorioUsuario,
  ) {
    this.servicioUsuario = new ServicioUsuarios(
      this.repositorioUsuario,
      new GeneradorContrasena(),
      this.encriptador,
      this.enviadorEmail
    )
  }

  public async cambiarClave(identificacion: string, clave: string, nuevaClave: string) {
    const usuario = await this.verificarUsuario(identificacion)
    if (usuario instanceof Usuario) {
      if (!(await this.encriptador.comparar(clave, usuario.clave))) {
        throw new Exception('Credenciales incorrectas, por favor intente recuperar contraseña con su correo', 400)
      }
      usuario.clave = nuevaClave
      usuario.claveTemporal = false;
      this.servicioUsuario.actualizarUsuario(usuario.id, usuario)
      return;
    }
    throw new Exception('Credenciales incorrectas, por favor intente recuperar contraseña con su correo', 400)
  }

  public async iniciarSesion(usuario: string, contrasena: string): Promise<RespuestaInicioSesion> {
    const usuarioVerificado = await this.verificarUsuario(usuario)


    // 1. Autenticación externa obligatoria usando credenciales de entorno
    let tokenExterno: string
    try {
      const servicioExterno = new ServicioAutenticacionExterna()
      tokenExterno = await servicioExterno.iniciarSesionConEnv()
      // Guardar token globalmente para usos posteriores
      TokenExterno.set(tokenExterno)
    } catch (error) {
      // Si falla, no permitir acceso a la plataforma
      throw new Exception('Fallo el inicio de sesión contra el aplicativo externo. Acceso denegado.', 502)
    }

    const rolUsuario = await this.repositorioAutorizacion.obtenerRolConModulosYPermisos(usuarioVerificado.idRol)
    const token = ServicioAutenticacionJWT.generarToken({
      documento: usuarioVerificado.identificacion,
      idRol: usuarioVerificado.idRol,
      id: usuarioVerificado.id
    })

    // Obtener módulos del usuario (personalizados o del rol)
    const repositorioModulos = new RepositorioUsuarioModuloDB()
    const modulos = await repositorioModulos.obtenerModulosDeUsuario(usuarioVerificado.id)

    return new RespuestaInicioSesion(
      {
        id: usuarioVerificado.id,
        usuario: usuarioVerificado.identificacion,
        nombre: usuarioVerificado.nombre,
        telefono: usuarioVerificado.telefono,
        correo: usuarioVerificado.correo
      },
      token,
      tokenExterno,
      new RolDto(rolUsuario),
      usuarioVerificado.claveTemporal,
      modulos)
  }

  public async verificarUsuario(usuario: string): Promise<Usuario> {
    const usuarioDB = await this.servicioUsuario.obtenerUsuarioPorUsuario(usuario)
    if (!usuarioDB) {
      throw new Exception('Credenciales incorrectas, por favor intente recuperar contraseña con su correo', 400)
    }
    return usuarioDB
  }

  private async crearRegistroDeBloqueo(identificacion: string): Promise<RegistroBloqueo> {
    const registro = new RegistroBloqueo(identificacion, 0, false)
    return await this.repositorioBloqueo.crearRegistro(registro)
  }

  private async manejarIntentoFallido(registro: RegistroBloqueo): Promise<RegistroBloqueo> {
    registro.agregarIntentoFallido()
    return await this.repositorioBloqueo.actualizarRegistro(registro)
  }


}
