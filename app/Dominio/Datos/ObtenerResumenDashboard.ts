import Database from '@ioc:Adonis/Lucid/Database'
import { DashboardResumenDto, DashboardLogMantenimientoDto } from 'App/Dominio/Dto/DashboardDto'
import { RepositorioMantenimiento } from '../Repositorios/RepositorioMantenimiento'

export class ObtenerResumenDashboard {
  constructor(private repositorioMantenimiento?: RepositorioMantenimiento) {}

  public async ejecutar(nit?: string): Promise<DashboardResumenDto[]> {
    // Si se proporciona un NIT específico, filtrar por ese NIT
    const whereClause = nit ? `WHERE u.usn_identificacion = '${nit}'` : ''

    const query = `
      SELECT
        u.usn_identificacion as nitEmpresa,
        u.usn_nombre as nombreEmpresa,
        COALESCE(COUNT(CASE WHEN m.tmt_tipo_id = 2 THEN 1 END), 0) as mantenimientoCorrectivo,
        COALESCE(COUNT(CASE WHEN m.tmt_tipo_id = 1 THEN 1 END), 0) as mantenimientoPreventivo,
        COALESCE(COUNT(CASE WHEN m.tmt_tipo_id = 3 THEN 1 END), 0) as alistamiento,
        COALESCE(COUNT(CASE WHEN m.tmt_tipo_id = 4 THEN 1 END), 0) as autorizaciones,
        COALESCE(COUNT(DISTINCT n.nov_id), 0) as novedades
      FROM tbl_usuarios u
      LEFT JOIN tbl_mantenimientos m ON u.usn_identificacion = CAST(m.tmt_usuario_id AS VARCHAR)
      LEFT JOIN tbl_novedades n ON u.usn_identificacion = n.nov_usuario_id
      ${whereClause}
      GROUP BY u.usn_identificacion, u.usn_nombre
      HAVING COUNT(m.tmt_id) > 0 OR COUNT(n.nov_id) > 0
      ORDER BY u.usn_nombre
    `

    const resultado = await Database.rawQuery(query)

    // Mapear los resultados al DTO
    const resumen: DashboardResumenDto[] = resultado.rows.map((fila: any) => {
      return new DashboardResumenDto(
        fila.nitempresa || fila.nitEmpresa,
        fila.nombreempresa || fila.nombreEmpresa,
        parseInt(fila.mantenimientocorrectivo || fila.mantenimientoCorrectivo) || 0,
        parseInt(fila.mantenimientopreventivo || fila.mantenimientoPreventivo) || 0,
        parseInt(fila.alistamiento) || 0,
        parseInt(fila.autorizaciones) || 0,
        parseInt(fila.novedades) || 0
      )
    })

    return resumen
  }

  /**
   * Obtiene el listado de placas con sus estados de mantenimiento (siempre tipo 1 - preventivo)
   * Si se proporciona una placa específica, filtra el resultado por esa placa
   * Si se proporciona un NIT, consulta con ese NIT en lugar del usuario actual
   * Retorna solo el arreglo de placas (strings)
   */
  public async obtenerPlacas(
    usuario: string,
    idRol: number,
    placa?: string,
    nit?: string
  ): Promise<string[]> {
    if (!this.repositorioMantenimiento) {
      throw new Error('Repositorio de mantenimiento no inicializado')
    }

    // Si se proporciona un NIT, usarlo en lugar del usuario actual
    const usuarioConsulta = nit || usuario

    // Siempre buscar por tipo 1 (mantenimiento preventivo)
    const resultados = await this.repositorioMantenimiento.listarPlacas(1, usuarioConsulta, idRol)

    // Extraer solo las placas
    let placas = resultados.map(r => r.placa).filter(p => p)

    // Si se especifica una placa, filtrar el resultado
    if (placa) {
      placas = placas.filter(p =>
        p?.toLowerCase() === placa.toLowerCase()
      )
    }

    return placas
  }

  /**
   * Obtiene los logs de mantenimientos con información detallada
   * Permite filtrar por NIT de empresa
   */
  public async obtenerLogsMantenimiento(nit?: string): Promise<DashboardLogMantenimientoDto[]> {
    const whereClause = nit ? `WHERE u.usn_identificacion = '${nit}'` : ''

    const query = `
      SELECT
        m.tmt_id as id,
        m.tmt_placa as placa,
        m.tmt_fecha_diligenciamiento as fechaDiligenciamiento,
        m.tmt_tipo_id as tipoId,
        m.tmt_procesado as procesado,
        m.tmt_mantenimiento_id as mantenimientoId,
        u.usn_identificacion as nit,
        u.usn_nombre as nombre,
        CASE
          WHEN m.tmt_tipo_id = 1 THEN 'Mantenimiento Preventivo'
          WHEN m.tmt_tipo_id = 2 THEN 'Mantenimiento Correctivo'
          WHEN m.tmt_tipo_id = 3 THEN 'Alistamiento'
          WHEN m.tmt_tipo_id = 4 THEN 'Autorizaciones'
          ELSE 'Desconocido'
        END as tipo
      FROM tbl_mantenimientos m
      INNER JOIN tbl_usuarios u ON CAST(m.tmt_usuario_id AS VARCHAR) = u.usn_identificacion
      ${whereClause}
      ORDER BY m.tmt_fecha_diligenciamiento DESC
    `

    const resultado = await Database.rawQuery(query)

    // Mapear los resultados al DTO
    const logs: DashboardLogMantenimientoDto[] = resultado.rows.map((fila: any) => {
      return new DashboardLogMantenimientoDto(
        fila.tipo,
        fila.fechadiligenciamiento || fila.fechaDiligenciamiento,
        fila.placa,
        fila.procesado,
        fila.mantenimientoid || fila.mantenimientoId || 0,
        fila.nit,
        fila.nombre
      )
    })

    return logs
  }
}
