
export interface RepositorioMantenimiento{
    listarPlacas(tipoId:number, usuario:string, idRol:number): Promise<any[]>
    listarPlacasTodas(tipoId:number, vigiladoId:string): Promise<any[]>
    listarHistorial(tipoId:number, vigiladoId:string, placa:string, idRol:number ): Promise<any[]>
    listarHistorialExportar(tipoId:number, vigiladoId:string, placa:string): Promise<any[]>
    guardarMantenimiento(datos:any, usuario:string, idRol:number, proveedorId?:string): Promise<any>
    guardarPreventivo(datos:any, usuario:string, idRol:number): Promise<any>
    guardarCorrectivo(datos:any, usuario:string, idRol:number): Promise<any>
    guardarAlistamiento(datos:any, usuario:string, idRol:number): Promise<any>
    visualizarPreventivo(mantenimientoId:number, usuario:string, idRol:number): Promise<any>
    visualizarCorrectivo(mantenimientoId:number, usuario:string, idRol:number): Promise<any>
    visualizarAlistamiento(mantenimientoId:number, usuario:string, idRol:number): Promise<any>
    visualizarAutorizacion(mantenimientoId:number, usuario:string, idRol:number): Promise<any>
    guardarAutorizacion(datos:any, usuario:string, idRol:number): Promise<any>
    listarActividades(): Promise<any[]>

}
