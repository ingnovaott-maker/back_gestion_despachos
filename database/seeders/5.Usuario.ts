import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import { DateTime } from 'luxon'
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario'
import { ROLES } from 'App/Dominio/DiccionarioAutorizacion'


export default class UsuariosSeeder extends BaseSeeder {
  public async run () {
    await TblUsuarios.createMany([
        {
            nombre: 'Administrador',
            clave: '$bcrypt$v=98$r=10$Q2vRX+GrDwa30G8ZYEEstg$34VPuMK3oHOKbzn+ztDtwwWwmYi3CWY', // G3sMov1l+
            correo: 'administrador@correo.com',
            identificacion: '999999999',
            idRol: ROLES.ADMINISTRADOR,
            usuario: '999999999'
        }
    ])
  }
}
