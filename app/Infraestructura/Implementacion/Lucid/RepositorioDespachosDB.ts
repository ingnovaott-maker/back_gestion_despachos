import { Exception } from '@adonisjs/core/build/standalone'
import TblDespacho from 'App/Infraestructura/Datos/Entidad/Despacho';
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario';
import { despachoToDto } from './dto/despacho';
import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';
import { TokenExterno } from 'App/Dominio/Utilidades/TokenExterno';
import { RepositorioDespachos } from 'App/Dominio/Repositorios/RepositorioDespachos';



export class RepositorioDesppachosDB implements RepositorioDespachos {
  private async obtenerDatosAutenticacion(usuario: string, idRol: number): Promise<{ tokenAutorizacion: string, nitVigilado: string, usuarioId: number }> {
    let tokenAutorizacion = '';
    let nitVigilado = '';
    let usuarioId = 0;

    const usuarioDb = await TblUsuarios.query().where('identificacion', usuario).first();

    if (!usuarioDb) {
      throw new Exception("Usuario no encontrado", 404);
    }

    if (idRol === 3) {
      const identificacionAdministrador = usuarioDb.administrador;
      if (!identificacionAdministrador) {
        throw new Exception("Usuario administrador no encontrado", 404);
      }

      const usuarioAdministrador = await TblUsuarios.query().where('identificacion', identificacionAdministrador).first();
      if (!usuarioAdministrador) {
        throw new Exception("Usuario administrador no encontrado", 404);
      }

      tokenAutorizacion = usuarioAdministrador.tokenAutorizado || '';
      nitVigilado = String(usuarioAdministrador.identificacion ?? identificacionAdministrador);
      usuarioId = usuarioAdministrador.id ?? 0;
    } else if (idRol === 2 || idRol === 1) {
      tokenAutorizacion = usuarioDb.tokenAutorizado || '';
      nitVigilado = String(usuarioDb.identificacion ?? '');
      usuarioId = usuarioDb.id ?? 0;
    } else {
      tokenAutorizacion = usuarioDb.tokenAutorizado || '';
      nitVigilado = String(usuarioDb.identificacion ?? '');
      usuarioId = usuarioDb.id ?? 0;
    }

    if (!tokenAutorizacion || tokenAutorizacion.trim() === '') {
      throw new Exception("Token de autorización no encontrado. Por favor, contacte al administrador.", 400);
    }

    if (!nitVigilado || nitVigilado.trim() === '') {
      throw new Exception("No se pudo determinar el identificador del vigilado asociado al usuario", 400);
    }

    return { tokenAutorizacion, nitVigilado, usuarioId };
  }

  private async obtenerTokenExterno(): Promise<string> {
    const token = await TokenExterno.get();
    if (!token || !TokenExterno.isVigente()) {
      throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
    }
    return token;
  }

  async Listar(documento: string, idRol: number, nit?: string):Promise<any>{
    const tokenExterno = await this.obtenerTokenExterno();

    try {
      const { tokenAutorizacion, nitVigilado } = await this.obtenerDatosAutenticacion(documento, idRol);

      const URL_DESPACHOS = Env.get('URL_DESPACHOS');
      const nitConsultaBruto = (typeof nit === 'string' ? nit.trim() : String(nit ?? '')).trim();
      const nitConsulta = nitConsultaBruto !== '' ? nitConsultaBruto : nitVigilado;

      let url = `${URL_DESPACHOS}/despachos`;

      if (nitConsulta && nitConsulta.trim() !== '') {
        url += `?nit=${encodeURIComponent(nitConsulta)}`;
      }

      const respuesta = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${tokenExterno}`,
          'documento': nitVigilado,
          'token': tokenAutorizacion,
          'Content-Type': 'application/json'
        }
      });

      return respuesta.data;
    } catch (errorExterno: any) {
      console.log(errorExterno);

      const statusCode = errorExterno.response?.status || 500;
      const mensajeError = errorExterno.response?.data?.mensaje ||
                          errorExterno.response?.data?.message ||
                          'Error al listar los despachos';

      const exception = new Exception(mensajeError, statusCode);

      if (errorExterno.response?.data) {
        (exception as any).responseData = errorExterno.response.data;
      }

      throw exception;
    }
  }

  async Listados(nit: string, page = 1, numero_items = 10):Promise<any>{
    try {
        let despachos;
/*
        // Si 'nit' es nulo o una cadena vacía, listar todos los despachos
        if (!nit) {
          despachos = await TblDespacho.query().preload('vehiculo').orderBy('id', 'desc').paginate(page, numero_items);
        } else {
          // Si 'nit' tiene un valor, realizar la búsqueda
          despachos = await TblDespacho.query().preload('vehiculo')
            .join('tbl_vehiculos', 'tbl_vehiculos.veh_id_despachos', '=', 'tbl_despachos.des_id')
            .where('tbl_vehiculos.veh_placa', 'ilike', `%${nit}%`)
            .orWhere('nitEmpresaTransporte', 'ilike', `%${nit}%`)
            .orderBy('id', 'desc')
            .paginate(page, numero_items);
        } */

        return despachos;
      }
      catch (error)
      {
        console.error('Error al listar los despachos:', error);
        throw new Exception("No se pudieron obtener los despachos", 500);
      }
  }

  async Crear(data: any): Promise<any> {
      try {
        const despacho = await TblDespacho.create(data);
        return despacho

      } catch (error) {
        console.error('Error al crear los despachos:', error);
        throw new Exception("No se pudieron crear los despachos", 500);
      }
  }

  async Edita(id: number, data: any): Promise<any> {
      try {
        const despacho = await TblDespacho.findByOrFail('id', id);
        delete data.id
        despacho.merge(data);
        await despacho.save();
        return despacho
      } catch (error) {
        console.error('Error al editar los despachos:', error);
        throw new Exception("No se pudieron Editar los despachos", 500);
      }
  }

  async Desactivar(id: number): Promise<any> {
      try {
        const despacho = await TblDespacho.findByOrFail('id', id);
        despacho.merge({ estado: !despacho.estado });
         await despacho.save();
        return despacho
      } catch (error) {
         console.error('Error al desactivar los despachos:', error);
        throw new Exception("No se pudieron desactivar los despachos", 500);
      }
  }

  async BuscarPorId(id: number, token: string, documento: string): Promise<any> {
    const tokenExterno = await this.obtenerTokenExterno();

    try {
      const URL_DESPACHOS = Env.get('URL_DESPACHOS');
      const url = `${URL_DESPACHOS}/despachos/${id}`;

      const respuesta = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${tokenExterno}`,
          'token': token,
          'documento': documento,
          'Content-Type': 'application/json'
        }
      });

      return respuesta.data;
    } catch (errorExterno: any) {
      const statusCode = errorExterno.response?.status || 500;
      const mensajeError = errorExterno.response?.data?.mensaje ||
                          errorExterno.response?.data?.message ||
                          'Error al buscar el despacho';

      const exception = new Exception(mensajeError, statusCode);

      if (errorExterno.response?.data) {
        (exception as any).responseData = errorExterno.response.data;
      }

      throw exception;
    }
  }

  async BuscarPorPlacaVehiculo(placa: string, token: string, documento: string, fechaSalida?: string): Promise<any> {
    const tokenExterno = await this.obtenerTokenExterno();

    try {
      const URL_DESPACHOS = Env.get('URL_DESPACHOS');
      let url = `${URL_DESPACHOS}/despachos/placa/${placa}`;

      if (fechaSalida && fechaSalida.trim() !== "") {
        url += `?fechaSalida=${fechaSalida}`;
      }

      const respuesta = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${tokenExterno}`,
          'token': token,
          'documento': documento,
          'Content-Type': 'application/json'
        }
      });

      return respuesta.data;
    } catch (errorExterno: any) {
      const statusCode = errorExterno.response?.status || 500;
      const mensajeError = errorExterno.response?.data?.mensaje ||
                          errorExterno.response?.data?.message ||
                          'Error al consultar despacho por placa';

      const exception = new Exception(mensajeError, statusCode);

      if (errorExterno.response?.data) {
        (exception as any).responseData = errorExterno.response.data;
      }

      throw exception;
    }
  }

}
