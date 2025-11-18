import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import { DateTime } from 'luxon'
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario'
import { ROLES } from 'App/Dominio/DiccionarioAutorizacion'


export default class UsuariosSeeder extends BaseSeeder {
  public async run () {
    await TblUsuarios.createMany([
        {
            nombre: 'Administrador',
            clave: '$bcrypt$v=98$r=10$cl/YM5O+Cd1YIwp+m5HCKw$qAydh613N6JqkMf0HTWi9GJkQbwdXNM', // Admin123+
            correo: 'juliojimmeza@gmail.com',
            identificacion: '11111111',
            idRol: ROLES.ADMINISTRADOR,
            usuario: '11111111'
        },
        {
            nombre: 'Empresa prueba',
            clave: '$bcrypt$v=98$r=10$cl/YM5O+Cd1YIwp+m5HCKw$qAydh613N6JqkMf0HTWi9GJkQbwdXNM', // Admin123+
            correo: 'juliojimmeza@gmail.com',
            identificacion: '800086050',
            idRol: ROLES.CLIENTE,
            usuario: '800086050',
            tokenAutorizado: '34346af4-949d-4f72-bcc6-19d7633b414e'
        }
    ])
  }
}
