import { ClienteHttp } from "App/Dominio/ClienteHttp";
import { Fichero } from "App/Dominio/Ficheros/Fichero";
import FormData from "form-data";
import Env from "@ioc:Adonis/Core/Env"
import { ArchivoGuardado } from "./Dtos/ArchivoGuardado";

export class ServicioArchivos{
    private readonly host = Env.get('URL_SERVICIO_ARCHIVOS')
    constructor(private http: ClienteHttp){}

    guardarArchivo(fichero: Fichero, ruta: string, idUsuario: string): Promise<ArchivoGuardado>{
        try {
            const endpoint = '/api/v1/archivos'
            const formData = new FormData()
            const nombreFichero = `${fichero.nombre}`
            formData.append('archivo', fichero.contenido, { filename: nombreFichero })
            formData.append('idVigilado', idUsuario)
            formData.append('rutaRaiz', ruta)
            return this.http.post<ArchivoGuardado>(`${this.host}${endpoint}`, formData, {  Authorization: `Bearer d4a32a3b-def6-4cc2-8f77-904a67360b53` })
        } catch (error) {
            console.log(error);
            throw error
        }
    }
}
