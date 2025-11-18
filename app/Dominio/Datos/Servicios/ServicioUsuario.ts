import { PeticionActualizarUsuario } from "App/Dominio/Dto/Usuarios/PeticionActualizacionUsuario";
import { RepositorioUsuario } from "App/Dominio/Repositorios/RepositorioUsuario";
import { Usuario } from "../Entidades/Usuario";
import { Exception } from "@adonisjs/core/build/standalone";

export class ServicioUsuario {
    constructor(
        private repositorioUsuarios: RepositorioUsuario,
    ) { }

    async actualizarInformacionUsuario(informacion: PeticionActualizarUsuario, identificacion: string): Promise<Usuario> {
        let usuario = await this.obtenerUsuario(identificacion)
        usuario = this.actualizarInformacion(usuario, informacion)

        await this.repositorioUsuarios.actualizarUsuario(usuario.id, usuario)
        return usuario
    }

    public async obtenerUsuario(identificacion: string): Promise<Usuario> {
        let usuario = await this.repositorioUsuarios.obtenerUsuarioPorUsuario(identificacion)
        if (!usuario) throw new Exception(`No se encontró el usuario ${identificacion}`, 404);

        return usuario
    }

    async obtenerUsuarioPorRol(rol: string): Promise<Usuario[]> {
        return this.repositorioUsuarios.obtenerUsuarioPorRol(rol);
      }

    private actualizarInformacion(
        usuario: | Usuario,
        informacion: PeticionActualizarUsuario): Usuario {
        for (const nuevoDato in informacion) {
            if (usuario[nuevoDato]) {
                usuario[nuevoDato] = informacion[nuevoDato]
            }
        }
        return usuario
    }



   

}