import { RepositorioDespachos } from "App/Dominio/Repositorios/RepositorioDespachos";



export class ServicioDespachos{
  constructor (private readonly repositorio: RepositorioDespachos) { }

  async Listar(documento: string, idRol: number, nit?: string): Promise<any> {
    return this.repositorio.Listar(documento, idRol, nit);
  }

  async Listados(nit: string, page:number, numero_items:number): Promise<any> {
    return this.repositorio.Listados(nit, page, numero_items);
  }

  async Crear(data: any): Promise<any> {
    return this.repositorio.Crear(data);
  }

  async Edita(id: number, data: any): Promise<any> {
    return this.repositorio.Edita(id, data);
  }

  async Desactivar(id: number): Promise<any> {
    return this.repositorio.Desactivar(id);
  }

  async BuscarPorId(id: number, token: string, documento: string): Promise<any> {
    return this.repositorio.BuscarPorId(id, token, documento);
  }

  async BuscarPorPlacaVehiculo(placa: string, token: string, documento: string, fechaSalida?: string): Promise<any> {
    return this.repositorio.BuscarPorPlacaVehiculo(placa, token, documento, fechaSalida);
  }

}
