import { DateTime } from 'luxon'
import { LoggerContract } from '@ioc:Adonis/Core/Logger'
import TblMantenimientoJob from 'App/Infraestructura/Datos/Entidad/MantenimientoJob'
import { MantenimientoPendienteError, RepositorioMantenimientoDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioMantenimientoDB'

export interface ProcesarColaOpciones {
  limite: number
  maxReintentos: number
  logger: LoggerContract
}

export interface ResultadoProcesamiento {
  procesados: number
  reprogramados: number
  fallidos: number
}

export default class MantenimientoQueueService {
  private repositorio = new RepositorioMantenimientoDB()

  public async procesarLote (opciones: ProcesarColaOpciones): Promise<ResultadoProcesamiento> {
    const ahora = DateTime.now()
    const trabajos = await TblMantenimientoJob.query()
      .where('tmj_estado', 'pendiente')
      .where('tmj_siguiente_intento', '<=', ahora.toJSDate())
      .orderBy('tmj_id', 'asc')
      .limit(opciones.limite)

    if (trabajos.length === 0) {
      return { procesados: 0, reprogramados: 0, fallidos: 0 }
    }

    let procesados = 0
    let reprogramados = 0
    let fallidos = 0

    for (const job of trabajos) {
      try {
        job.estado = 'procesando'
        await job.save()

        await this.repositorio.procesarJob(job)

        job.estado = 'procesado'
        job.ultimoError = null
        job.siguienteIntento = DateTime.now()
        await job.save()

        procesados += 1
        opciones.logger.info(`Trabajo ${job.id} procesado correctamente (${job.tipo})`)
      } catch (error: any) {
        if (error instanceof MantenimientoPendienteError) {
          job.estado = 'pendiente'
          job.siguienteIntento = DateTime.now().plus({ minutes: 5 })
          await job.save()
          reprogramados += 1
          opciones.logger.info(`Trabajo ${job.id} reprogramado: mantenimiento base pendiente`)
          continue
        }

        job.reintentos = (job.reintentos ?? 0) + 1
        job.ultimoError = error.message ?? 'Error desconocido'

        if (job.reintentos >= opciones.maxReintentos) {
          job.estado = 'fallido'
          job.siguienteIntento = DateTime.now()
          await job.save()
          fallidos += 1
          opciones.logger.error(`Trabajo ${job.id} marcado como fallido tras ${job.reintentos} intentos. Error: ${job.ultimoError}`)
          continue
        }

        const retrasoMinutos = Math.min(60, Math.pow(2, job.reintentos) * 5)
        job.estado = 'pendiente'
        job.siguienteIntento = DateTime.now().plus({ minutes: retrasoMinutos })
        await job.save()
        reprogramados += 1
        opciones.logger.info(`Trabajo ${job.id} reintentará en ${retrasoMinutos} minutos. Error: ${job.ultimoError}`)
      }
    }

    return { procesados, reprogramados, fallidos }
  }
}
