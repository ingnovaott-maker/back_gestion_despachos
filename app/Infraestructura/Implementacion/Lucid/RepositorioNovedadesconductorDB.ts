import { Exception } from '@adonisjs/core/build/standalone'
import { RepositorioNovedadesconductor } from 'App/Dominio/Repositorios/RepositorioNovedadesconductor';
import TblNovedadesconductor from 'App/Infraestructura/Datos/Entidad/Novedadesconductor';
import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';
import { TokenExterno } from 'App/Dominio/Utilidades/TokenExterno';

export class RepositorioNovedadesconductorDB implements RepositorioNovedadesconductor {
  async Listar(obj_filter:any):Promise<any>{
    try {

          let query = TblNovedadesconductor.query();

          if (obj_filter.find && obj_filter.find.trim().length  > 0)
          {
              query.where('noh_placa', 'ILIKE', `%${obj_filter.find}%`);
          }

          query.select('*').orderBy('id', 'desc');

          const array_novedades = await query.paginate(obj_filter.page, obj_filter.numero_items);

          return array_novedades;

      } catch (error) {
        throw new Exception("No se pudieron obtener los novedad conductor", 500);
      }
  }

  async Crear(data: any, token: string, documento: string): Promise<any> {
      try {
        // Validar que exista el token externo
        if (!TokenExterno.get() || !TokenExterno.isVigente()) {
          throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
        }

        // 1. Guardar localmente primero
        const novedadConductorDTO = {
          idNovedad: data.idNovedad,
          tipoIdentificacionConductor: data.tipoIdentificacionConductor,
          numeroIdentificacion: data.numeroIdentificacion,
          primerNombreConductor: data.primerNombreConductor,
          segundoNombreConductor: data.segundoNombreConductor,
          primerApellidoConductor: data.primerApellidoConductor,
          segundoApellidoConductor: data.segundoApellidoConductor,
          idPruebaAlcoholimetria: data.idPruebaAlcoholimetria,
          resultadoPruebaAlcoholimetria: data.resultadoPruebaAlcoholimetria,
          fechaUltimaPruebaAlcoholimetria: data.fechaUltimaPruebaAlcoholimetria,
          licenciaConduccion: data.licenciaConduccion,
          idExamenMedico: data.idExamenMedico,
          fechaUltimoExamenMedico: data.fechaUltimoExamenMedico,
          observaciones: data.observaciones,
          fechaVencimientoLicencia: data.fechaVencimientoLicencia,
          estado: true,
          procesado: false
        };
        const novedadConductor = await TblNovedadesconductor.create(novedadConductorDTO);

        // 2. Enviar datos al API externo
        try {
          const urlDespachos = Env.get("URL_DESPACHOS");

          const respuestaNovedadConductor = await axios.post(
            `${urlDespachos}/novedadesconductor`,
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
          if ((respuestaNovedadConductor.status === 200 || respuestaNovedadConductor.status === 201) && novedadConductor.id) {
            const idNovedadExterno =
              respuestaNovedadConductor.data?.array_data?.obj?.id_novedad ||
              respuestaNovedadConductor.data?.obj?.id_novedad ||
              respuestaNovedadConductor.data?.array_data?.obj?.idNovedad ||
              respuestaNovedadConductor.data?.obj?.idNovedad ||
              respuestaNovedadConductor.data?.data?.idNovedad ||
              respuestaNovedadConductor.data?.idNovedad;

            await TblNovedadesconductor.query()
              .where("id", novedadConductor.id)
              .update({
                procesado: true,
                idNovedad: idNovedadExterno || data.idNovedad
              });
          }

          return respuestaNovedadConductor.data;
        } catch (errorExterno: any) {
          console.error("Error al enviar datos al API externo de novedades conductor:", errorExterno);
          // Crear excepción con la respuesta completa del API externo si existe
          const exception = new Exception(
            errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de novedades conductor",
            errorExterno.response?.status || 500
          );
          // Agregar los datos completos del API externo a la excepción
          if (errorExterno.response?.data) {
            (exception as any).responseData = errorExterno.response.data;
          }
          throw exception;
        }
      } catch (error: any) {
        console.error('Error al crear novedad conductor:', error);
        // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
        if (error instanceof Exception) {
          throw error;
        }
        throw new Exception("No se pudieron crear las novedad conductor", 500);
      }
  }

  async Edita(data: any): Promise<any> {
      try {
        const novedad = await TblNovedadesconductor.findByOrFail('id', data.id);
        delete data.id
        novedad.merge(data);
        await novedad.save();
        return novedad
      } catch (error) {
        throw new Exception("No se pudieron Editar los novedad conductor", 500);
      }
  }

  async Desactivar(id: number): Promise<any> {
      try {
        const novedad = await TblNovedadesconductor.findByOrFail('id', id);
        novedad.merge({ estado: !novedad.estado });
         await novedad.save();
        return novedad
      } catch (error) {
        throw new Exception("No se pudieron desactivar la novedad conductor", 500);
      }
  }

}
