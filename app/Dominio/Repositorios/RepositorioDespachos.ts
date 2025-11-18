export interface RepositorioDespachos{
    Listar(documento: string, nit?: string):Promise<any>
    Listados(nit: string, page:number, numero_items:number):Promise<any>
    Crear(data:any):Promise<any>
    Edita(id:number, data:any):Promise<any>
    Desactivar(id:number):Promise<any>
    BuscarPorId(id:number, token: string, documento: string):Promise<any>
    BuscarPorPlacaVehiculo(placa: string, token: string, documento: string, fechaSalida?: string):Promise<any>
}
