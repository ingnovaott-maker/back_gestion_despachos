export interface RepositorioNovedadesconductor{
    Listar(obj_filter:any):Promise<any>
    Crear(data:any, token:string, documento:string):Promise<any>
    Edita(data:any):Promise<any>
    Desactivar(id:number):Promise<any>

}
