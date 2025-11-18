import { RepositorioMantenimiento } from 'App/Dominio/Repositorios/RepositorioMantenimiento';

export class ServicioMantenimeinto{
  constructor (private repositorio: RepositorioMantenimiento) { }

  async listarPlacas (tipoId:number, usuario:string, idRol:number): Promise<any[]>{
    return this.repositorio.listarPlacas(tipoId, usuario, idRol)
  }

  async listarPlacasTodas (tipoId:number, vigiladoId:string): Promise<any[]>{
    return this.repositorio.listarPlacasTodas(tipoId, vigiladoId)
  }
  async guardarMantenimiento (datos:any, usuario:string, idRol:number, proveedorId?:string): Promise<any>{
    return this.repositorio.guardarMantenimiento(datos, usuario, idRol, proveedorId)
  }

  async guardarPreventivo (datos:any, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.guardarPreventivo(datos, usuario, idRol)
  }

  async guardarCorrectivo (datos:any, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.guardarCorrectivo(datos, usuario, idRol)
  }

  async guardarAlistamiento (datos:any, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.guardarAlistamiento(datos, usuario, idRol)
  }

  async visualizarPreventivo (mantenimientoId:number, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.visualizarPreventivo(mantenimientoId, usuario, idRol)
  }

  async visualizarCorrectivo (mantenimientoId:number, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.visualizarCorrectivo(mantenimientoId, usuario, idRol)
  }

  async visualizarAlistamiento (mantenimientoId:number, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.visualizarAlistamiento(mantenimientoId, usuario, idRol)
  }

  async listarHistorial (tipoId:number, vigiladoId:string, placa:string): Promise<any>{
    return this.repositorio.listarHistorial(tipoId, vigiladoId, placa)
  }

  async listarActividades (): Promise<any>{
    return this.repositorio.listarActividades()
  }

  async visualizarAutorizacion (mantenimientoId:number, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.visualizarAutorizacion(mantenimientoId, usuario, idRol)
  }

  async guardarAutorizacion (datos:any, usuario:string, idRol:number): Promise<any>{
    return this.repositorio.guardarAutorizacion(datos, usuario, idRol)
  }

  async listarHistorialExportar (tipoId:number, vigiladoId:string, placa:string): Promise<any>{
    return this.repositorio.listarHistorialExportar(tipoId, vigiladoId, placa)
  }

}
