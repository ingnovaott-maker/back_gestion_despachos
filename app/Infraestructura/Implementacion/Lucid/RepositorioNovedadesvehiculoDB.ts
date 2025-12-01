import { Exception } from '@adonisjs/core/build/standalone'
import { RepositorioNovedadesvehiculo } from 'App/Dominio/Repositorios/RepositorioNovedadesvehiculo';
import TblNovedadesvehiculo from 'App/Infraestructura/Datos/Entidad/Novedadesvehiculo';
import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';
import { TokenExterno } from 'App/Dominio/Utilidades/TokenExterno';

export class RepositorioNovedadesvehiculoDB implements RepositorioNovedadesvehiculo {
  async Listar(obj_filter:any):Promise<any>{
    try {

          let query = TblNovedadesvehiculo.query();

          if (obj_filter.find && obj_filter.find.trim().length  > 0)
          {
              query.where('noh_placa', 'ILIKE', `%${obj_filter.find}%`);
          }

          query.select('*').orderBy('id', 'desc');

          const array_novedades = await query.paginate(obj_filter.page, obj_filter.numero_items);

          return array_novedades;

      } catch (error) {
        throw new Exception("No se pudieron obtener los novedadvehiculo", 500);
      }
  }

  async Crear(data: any, token: string, documento: string): Promise<any> {
      try {
        // Validar que exista el token externo
        if (!TokenExterno.get() || !TokenExterno.isVigente()) {
          throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
        }

        // 1. Guardar localmente primero
        const novedadVehiculoDTO = {
          idNovedad: data.idNovedad,
          placa: data.placa,
          soat: data.soat,
          fechaVencimientoSoat: data.fechaVencimientoSoat,
          revisionTecnicoMecanica: data.revisionTecnicoMecanica,
          fechaRevisionTecnicoMecanica: data.fechaRevisionTecnicoMecanica,
          idPolizas: data.idPolizas,
          tipoPoliza: data.tipoPoliza,
          tarjetaOperacion: data.tarjetaOperacion,
          fechaVencimientoTarjetaOperacion: data.fechaVencimientoTarjetaOperacion,
          idMatenimientoPreventivo: data.idMatenimientoPreventivo,
          fechaMantenimientoPreventivo: data.fechaMantenimientoPreventivo,
          idProtocoloAlistamientodiario: data.idProtocoloAlistamientodiario,
          fechaProtocoloAlistamientodiario: data.fechaProtocoloAlistamientodiario,
          observaciones: data.observaciones,
          clase: data.clase,
          nivelServicio: data.nivelServicio,
          idPolizaContractual: data.idPolizaContractual,
          idPolizaExtracontractual: data.idPolizaExtracontractual,
          vigenciaContractual: data.vigenciaContractual,
          vigenciaExtracontractual: data.vigenciaExtracontractual,
          estado: true,
          procesado: false
        };
        const novedadVehiculo = await TblNovedadesvehiculo.create(novedadVehiculoDTO);

        // 2. Enviar datos al API externo
        try {
          const urlDespachos = Env.get("URL_DESPACHOS");

          const respuestaNovedadVehiculo = await axios.post(
            `${urlDespachos}/novedadesvehiculo`,
            data,
            {
              headers: {
                'Authorization': `Bearer ${TokenExterno.get()}`,
                'token': token,
                'documento': documento,
                'Content-Type': 'application/json'
              }
            }
          );

          // 3. Si la respuesta es exitosa, actualizar procesado e idNovedad
          if ((respuestaNovedadVehiculo.status === 200 || respuestaNovedadVehiculo.status === 201) && novedadVehiculo.id) {
            const idNovedadExterno =
              respuestaNovedadVehiculo.data?.array_data?.obj?.id_novedad ||
              respuestaNovedadVehiculo.data?.obj?.id_novedad ||
              respuestaNovedadVehiculo.data?.array_data?.obj?.idNovedad ||
              respuestaNovedadVehiculo.data?.obj?.idNovedad ||
              respuestaNovedadVehiculo.data?.data?.idNovedad ||
              respuestaNovedadVehiculo.data?.idNovedad;

            await TblNovedadesvehiculo.query()
              .where("id", novedadVehiculo.id)
              .update({
                procesado: true,
                idNovedad: idNovedadExterno || data.idNovedad
              });
          }

          return respuestaNovedadVehiculo.data;
        } catch (errorExterno: any) {
          console.error("Error al enviar datos al API externo de novedades vehículo:", errorExterno);
          // Crear excepción con la respuesta completa del API externo si existe
          const exception = new Exception(
            errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de novedades vehículo",
            errorExterno.response?.status || 500
          );
          // Agregar los datos completos del API externo a la excepción
          if (errorExterno.response?.data) {
            (exception as any).responseData = errorExterno.response.data;
          }
          throw exception;
        }
      } catch (error: any) {
        console.error('Error al crear novedad vehículo:', error);
        // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
        if (error instanceof Exception) {
          throw error;
        }
        throw new Exception("No se pudieron crear las novedadvehiculo", 500);
      }
  }

  async Edita(data: any): Promise<any> {
      try {
        const novedad = await TblNovedadesvehiculo.findByOrFail('id', data.id);
        delete data.id
        novedad.merge(data);
        await novedad.save();
        return novedad
      } catch (error) {
        throw new Exception("No se pudieron Editar los novedadvehiculo", 500);
      }
  }

  async Desactivar(id: number): Promise<any> {
      try {
        const novedad = await TblNovedadesvehiculo.findByOrFail('id', id);
        novedad.merge({ estado: !novedad.estado });
         await novedad.save();
        return novedad
      } catch (error) {
        throw new Exception("No se pudieron desactivar la novedadvehiculo", 500);
      }
  }

   async validarVehiculo(novedad_id: number): Promise<any> {
      try {
        const novedadvehiculo = await TblNovedadesvehiculo.findBy('idNovedad', novedad_id);

        return novedadvehiculo;
      } catch (error) {
        throw new Exception("No se pudo obtener la Llegada de vehiculo", 500);
      }
  }

}
