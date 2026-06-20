import { DateTime } from 'luxon'
import Env from '@ioc:Adonis/Core/Env'
import { Exception } from '@adonisjs/core/build/standalone'
import { ClienteApiSupertransporte } from 'App/Dominio/Utilidades/ClienteApiSupertransporte'
import TblSolicitudDespacho, { EstadoSolicitudDespacho } from 'App/Infraestructura/Datos/Entidad/SolicitudDespacho'
import { obtenerDatosAutenticacionUsuario } from 'App/Infraestructura/Implementacion/Lucid/AutenticacionUsuarioHelper'
import DespachosQueueService from 'App/Servicios/DespachosQueueService'

export class ServicioSolicitudDespacho {
  private colaDespachos = new DespachosQueueService()

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
      rolId: idRol,
      fuenteDato: 'WEB',
      procesado: false,
      idDespachoExterno: null,
      respuestaExterna: null,
      errorExterno: null,
      estado: 'pendiente',
      reintentos: 0,
      siguienteIntento: DateTime.now(),
    })

    // Opción A: se intenta enviar al externo en el mismo request. Si falla,
    // la solicitud queda 'pendiente' y el worker la reintenta en segundo plano.
    try {
      await this.colaDespachos.enviarSolicitud(solicitud)
      solicitud.estado = 'procesado'
      solicitud.siguienteIntento = DateTime.now()
      await solicitud.save()

      return {
        solicitudId: solicitud.id,
        estado: solicitud.estado,
        idDespachoExterno: solicitud.idDespachoExterno,
        ...(solicitud.respuestaExterna as Record<string, unknown> | null ?? {}),
      }
    } catch (error: any) {
      const mensajeError = JSON.stringify(error?.responseData || error?.message || 'Error desconocido')
      solicitud.merge({
        estado: 'pendiente',
        errorExterno: mensajeError,
        siguienteIntento: DateTime.now().plus({ minutes: 5 }),
      })
      await solicitud.save()

      return {
        solicitudId: solicitud.id,
        estado: solicitud.estado,
        idDespachoExterno: null,
        mensaje: 'La solicitud fue recibida y se reintentará automáticamente.',
        errorExterno: mensajeError,
      }
    }
  }

  public async obtenerSolicitud (id: number): Promise<TblSolicitudDespacho> {
    return TblSolicitudDespacho.findOrFail(id)
  }

  public async listarSolicitudes (estado?: EstadoSolicitudDespacho): Promise<TblSolicitudDespacho[]> {
    const consulta = TblSolicitudDespacho.query().orderBy('des_sol_id', 'desc')
    if (estado) {
      consulta.where('des_sol_estado', estado)
    }
    return consulta
  }

  public async reintentarSolicitud (id: number): Promise<TblSolicitudDespacho> {
    const solicitud = await TblSolicitudDespacho.find(id)
    if (!solicitud) {
      throw new Exception('Solicitud de despacho no encontrada', 404)
    }
    if (solicitud.procesado) {
      throw new Exception('La solicitud ya fue procesada exitosamente', 400)
    }

    solicitud.merge({
      estado: 'pendiente',
      reintentos: 0,
      errorExterno: null,
      siguienteIntento: DateTime.now(),
    })
    await solicitud.save()

    return solicitud
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

  public async consultarPorNit (
    nit: string,
    identificacion: string,
    idRol: number
  ): Promise<any> {
    const urlDespachos = Env.get('URL_DESPACHOS')
    const url = `${urlDespachos}/despachos`

    const params: Record<string, unknown> = {}
    const nitLimpio = typeof nit === 'string' ? nit.trim() : ''
    if (nitLimpio !== '') {
      params.nit = nitLimpio
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
