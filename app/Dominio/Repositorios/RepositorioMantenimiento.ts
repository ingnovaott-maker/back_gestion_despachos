
export interface OpcionesSincronizacion {
    diferido?: boolean
    loteId?: string
}

export interface RepositorioMantenimiento{
    listarPlacas(tipoId:number, usuario:string, idRol:number): Promise<any[]>
    listarPlacasTodas(tipoId:number, vigiladoId:string): Promise<any[]>
    listarHistorial(tipoId:number, vigiladoId:string, placa:string, idRol:number ): Promise<any[]>
    listarHistorialExportar(tipoId:number, vigiladoId:string, placa:string): Promise<any[]>
    guardarMantenimiento(datos:any, usuario:string, idRol:number, proveedorId?:string, opciones?:OpcionesSincronizacion): Promise<any>
    guardarPreventivo(datos:any, usuario:string, idRol:number, opciones?:OpcionesSincronizacion): Promise<any>
    guardarCorrectivo(datos:any, usuario:string, idRol:number, opciones?:OpcionesSincronizacion): Promise<any>
    guardarAlistamiento(datos:any, usuario:string, idRol:number, opciones?:OpcionesSincronizacion): Promise<any>
    visualizarPreventivo(mantenimientoId:number, usuario:string, idRol:number): Promise<any>
    visualizarCorrectivo(mantenimientoId:number, usuario:string, idRol:number): Promise<any>
    visualizarAlistamiento(mantenimientoId:number, usuario:string, idRol:number): Promise<any>
    visualizarAutorizacion(mantenimientoId:number, usuario:string, idRol:number): Promise<any>
    guardarAutorizacion(datos:any, usuario:string, idRol:number, opciones?:OpcionesSincronizacion): Promise<any>
    listarActividades(): Promise<any[]>
    listarTrabajosFallidos(usuario:string, idRol:number, filtros?:{ tipo?: string, estado?: string }): Promise<any[]>
    reintentarTrabajoFallido(jobId:number, usuario:string, idRol:number, opciones?:{ payload?: Record<string, any> | null }): Promise<any>

}
