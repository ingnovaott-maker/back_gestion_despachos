import Env from '@ioc:Adonis/Core/Env'
import { ClienteApiSupertransporte } from 'App/Dominio/Utilidades/ClienteApiSupertransporte'
import TblSolicitudDespacho from 'App/Infraestructura/Datos/Entidad/SolicitudDespacho'
import { obtenerDatosAutenticacionUsuario } from 'App/Infraestructura/Implementacion/Lucid/AutenticacionUsuarioHelper'

export class ServicioSolicitudDespacho {
  public async registrar (
    payload: Record<string, unknown>,
    identificacion: string,
    idRol: number
  ): Promise<any> {
    const { nitVigilado } = await obtenerDatosAutenticacionUsuario(identificacion, idRol)

    const solicitud = await TblSolicitudDespacho.create({
      payload,
      nitVigilado,
      usuarioId: identificacion,
      fuenteDato: 'WEB',
      procesado: false,
      idDespachoExterno: null,
      respuestaExterna: null,
      errorExterno: null,
    })

    const urlDespachos = Env.get('URL_DESPACHOS')
    const url = `${urlDespachos}/despachosempresa`

    try {
      const respuestaExterna = await ClienteApiSupertransporte.postTransaccional(
        url,
        payload,
        identificacion,
        idRol
      )

      const idDespachoExterno = ClienteApiSupertransporte.extraerIdDespachoExterno(respuestaExterna)

      solicitud.merge({
        procesado: true,
        idDespachoExterno,
        respuestaExterna,
        errorExterno: null,
      })
      await solicitud.save()

      return {
        solicitudId: solicitud.id,
        idDespachoExterno,
        ...respuestaExterna,
      }
    } catch (error: any) {
      solicitud.merge({
        errorExterno: JSON.stringify(error?.responseData || error?.message || 'Error desconocido'),
      })
      await solicitud.save()
      throw error
    }
  }

  public async obtenerSolicitud (id: number): Promise<TblSolicitudDespacho> {
    return TblSolicitudDespacho.findOrFail(id)
  }

  public async consultarPorPlaca (
    placa: string,
    identificacion: string,
    idRol: number,
    fechaSalida?: string
  ): Promise<any> {
    const placaLimpia = ClienteApiSupertransporte.limpiarPlaca(placa)
    const urlDespachos = Env.get('URL_DESPACHOS')
    let url = `${urlDespachos}/despachos/placa/${placaLimpia}`

    const params: Record<string, unknown> = {}
    if (fechaSalida && fechaSalida.trim() !== '') {
      params.fechaSalida = fechaSalida
    }

    return ClienteApiSupertransporte.getTransaccional(url, identificacion, idRol, params)
  }

  public async consultarPorId (
    idDespacho: number,
    identificacion: string,
    idRol: number
  ): Promise<any> {
    const urlDespachos = Env.get('URL_DESPACHOS')
    const url = `${urlDespachos}/despachos/${idDespacho}`

    return ClienteApiSupertransporte.getTransaccional(url, identificacion, idRol)
  }
}
