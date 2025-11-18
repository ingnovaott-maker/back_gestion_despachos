import { Encriptador } from 'App/Dominio/Encriptacion/Encriptador'
import Hash from '@ioc:Adonis/Core/Hash'
import { Exception } from '@adonisjs/core/build/standalone'

export class EncriptadorAdonis implements Encriptador {
  public async encriptar (cadena: string): Promise<string> {
    return await Hash.make(cadena)
  }

  public async comparar (cadena: string, hash: string): Promise<boolean> {
    try {
      return await Hash.verify(hash, cadena)

    } catch (error) {
      throw new Exception('Credenciales incorrectas, por favor intente recuperar contraseña con su correo', 400)
    }


  }
}
