import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import { DateTime } from 'luxon'
import TblMantenimientoJob from 'App/Infraestructura/Datos/Entidad/MantenimientoJob'
import { MantenimientoPendienteError, RepositorioMantenimientoDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioMantenimientoDB'

export default class ProcessMantenimientoQueue extends BaseCommand {
  public static commandName = 'mantenimiento:procesar-cola'

  public static description = 'Procesa los trabajos pendientes de sincronización con el servicio externo de mantenimiento'

  public static settings = {
    loadApp: true,
  }

  @flags.number({ alias: 'l', description: 'Cantidad máxima de trabajos a procesar en esta ejecución' })
  public limite: number = 25

  @flags.number({ alias: 'r', description: 'Número máximo de reintentos antes de marcar un trabajo como fallido' })
  public maxReintentos: number = 5

  public async run () {
    const limite = this.limite ?? 25
    const maxReintentos = this.maxReintentos ?? 5

    const repositorio = new RepositorioMantenimientoDB()
    const ahora = DateTime.now()

    const trabajos = await TblMantenimientoJob.query()
      .where('tmj_estado', 'pendiente')
      .where('tmj_siguiente_intento', '<=', ahora.toJSDate())
      .orderBy('tmj_id', 'asc')
      .limit(limite)

    if (trabajos.length === 0) {
      this.logger.info('No hay trabajos pendientes para procesar')
      return
    }

    this.logger.info(`Procesando ${trabajos.length} trabajos de mantenimiento`)

    for (const job of trabajos) {
      try {
        job.estado = 'procesando'
        await job.save()

        await repositorio.procesarJob(job)

        job.estado = 'procesado'
        job.ultimoError = null
        job.siguienteIntento = DateTime.now()
        await job.save()

        this.logger.info(`Trabajo ${job.id} procesado correctamente (${job.tipo})`)
      } catch (error: any) {
        if (error instanceof MantenimientoPendienteError) {
          job.estado = 'pendiente'
          job.siguienteIntento = DateTime.now().plus({ minutes: 5 })
          await job.save()
          this.logger.info(`Trabajo ${job.id} reprogramado: mantenimiento base pendiente`)
          continue
        }

        job.reintentos = (job.reintentos ?? 0) + 1
        job.ultimoError = error.message ?? 'Error desconocido'

        if (job.reintentos >= maxReintentos) {
          job.estado = 'fallido'
          job.siguienteIntento = DateTime.now()
          await job.save()
          this.logger.error(`Trabajo ${job.id} marcado como fallido tras ${job.reintentos} intentos. Error: ${job.ultimoError}`)
          continue
        }

        const retrasoMinutos = Math.min(60, Math.pow(2, job.reintentos) * 5)
        job.estado = 'pendiente'
        job.siguienteIntento = DateTime.now().plus({ minutes: retrasoMinutos })
        await job.save()
        this.logger.info(`Trabajo ${job.id} reintentará en ${retrasoMinutos} minutos. Error: ${job.ultimoError}`)
      }
    }
  }
}
