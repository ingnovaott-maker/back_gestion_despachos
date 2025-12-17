import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import type { MultipartFileContract } from '@ioc:Adonis/Core/BodyParser'
import { ServicioMantenimeinto } from 'App/Dominio/Datos/Servicios/ServicioMantenimiento';
import TblArchivoPrograma from 'App/Infraestructura/Datos/Entidad/ArchivoPrograma';
import TblMantenimiento from 'App/Infraestructura/Datos/Entidad/Mantenimiento';
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario';
import { RepositorioMantenimientoDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioMantenimientoDB';
import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';
import { ServicioExportacion } from 'App/Dominio/Datos/Servicios/ServicioExportacion';
import { guardarLogError } from 'App/Dominio/guardarLogError';
import ExcelJS from 'exceljs';
import { DateTime } from 'luxon';


export default class ControladorMantenimiento {
  private servicioExportacion = new ServicioExportacion();
  private servicioMantenimiento: ServicioMantenimeinto
  constructor(){
    this.servicioMantenimiento = new ServicioMantenimeinto(new RepositorioMantenimientoDB())
  }

  /**
   * Maneja los errores de forma consistente en todos los métodos del controlador
   */
  private manejarError(error: any, response: any): any {
    // Si existe responseData del API externo, retornarla completa
    if(error.responseData) {
      return response.status(error.status || 500).send(error.responseData)
    }

    // Manejo de errores de sesión expirada (401)
    if(error.status === 401 || error.message?.includes('Su sesión ha expirado')) {
      return response.status(401).send({ mensaje: error.message || 'Su sesión ha expirado. Por favor, vuelva a iniciar sesión' })
    }

    // Manejo de datos inválidos (400)
    if(error.status === 400 || error.message?.includes('Token de autorización no encontrado')) {
      return response.status(400).send({ mensaje: error.message || 'Datos de autorización inválidos' })
    }

    // Manejo de recursos no encontrados (404)
    if(error.status === 404 || error.message?.includes('no encontrado')) {
      return response.status(404).send({ mensaje: error.message || 'Recurso no encontrado' })
    }

    // Error genérico del servidor
    return response.status(500).send({ mensaje: 'Error interno del servidor' })
  }

  private async leerRegistrosDesdeExcel(archivo: MultipartFileContract): Promise<any[]> {
    const workbook = new ExcelJS.Workbook();
    if (archivo.tmpPath) {
      await workbook.xlsx.readFile(archivo.tmpPath);
    } else {
      const buffer = await archivo.toBuffer();
      await workbook.xlsx.load(buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return [];
    }

    const headerRow = worksheet.getRow(1);
    const headers = (headerRow.values || [])
      .map((valor) => (typeof valor === 'string' ? valor.trim() : valor))
      .map((valor) => (typeof valor === 'number' ? String(valor) : valor))
      .filter((valor) => valor);

    const registros: any[] = [];

    worksheet.eachRow((fila, numeroFila) => {
      if (numeroFila === 1) {
        return;
      }

      const registro: Record<string, any> = {};
      headers.forEach((encabezado, index) => {
        const columna = index + 1;
        const celda = fila.getCell(columna);
        if (!encabezado) {
          return;
        }

        const clave = String(encabezado).trim();
        registro[clave] = this.normalizarValorExcel(clave, celda);
      });

      const tieneDatos = Object.values(registro).some((valor) => valor !== null && valor !== undefined && String(valor).trim() !== '');
      if (tieneDatos) {
        registros.push(registro);
      }
    });

    return registros;
  }

  private normalizarValorExcel(clave: string, celda: ExcelJS.Cell): any {
    const llave = clave.toLowerCase();
    const valor = celda.value ?? (celda.text || '').trim();

    if (llave === 'fecha') {
      return this.normalizarFechaExcel(valor);
    }

    if (llave === 'hora') {
      return this.normalizarHoraExcel(valor);
    }

    if (valor instanceof Date) {
      return DateTime.fromJSDate(valor).toISO();
    }

    if (typeof valor === 'string') {
      const limpio = valor.trim();
      if (limpio === '') {
        return null;
      }
      return limpio;
    }

    if (typeof valor === 'number') {
      const texto = (celda.text || '').trim();
      if (texto !== '') {
        return texto;
      }
      return valor;
    }

    if (valor && typeof valor === 'object' && 'text' in valor) {
      const texto = String((valor as any).text).trim();
      return texto === '' ? null : texto;
    }

    const texto = (celda.text || '').trim();
    return texto === '' ? null : texto;
  }

  private normalizarFechaExcel(valor: any): string | null {
    if (valor instanceof Date) {
      return DateTime.fromJSDate(valor).toISODate();
    }

    if (typeof valor === 'number') {
      const jsDate = new Date(Math.round((valor - 25569) * 86400 * 1000));
      return DateTime.fromJSDate(jsDate).toISODate();
    }

    if (typeof valor === 'string') {
      const limpio = valor.trim();
      if (limpio === '') {
        return null;
      }

      const candidatos = [
        DateTime.fromISO(limpio),
        DateTime.fromFormat(limpio, 'dd/MM/yyyy'),
        DateTime.fromFormat(limpio, 'MM/dd/yyyy'),
        DateTime.fromFormat(limpio, 'dd-MM-yyyy'),
        DateTime.fromFormat(limpio, 'MM-dd-yyyy'),
        DateTime.fromRFC2822(limpio),
      ];

      for (const candidato of candidatos) {
        if (candidato.isValid) {
          return candidato.toISODate();
        }
      }

      const desdeJS = DateTime.fromJSDate(new Date(limpio));
      if (desdeJS.isValid) {
        return desdeJS.toISODate();
      }

      return limpio;
    }

    return null;
  }

  private normalizarHoraExcel(valor: any): string | null {
    if (valor instanceof Date) {
      return DateTime.fromJSDate(valor).toFormat('HH:mm');
    }

    if (typeof valor === 'number') {
      const totalSegundos = Math.round(valor * 24 * 60 * 60);
      const horas = Math.floor(totalSegundos / 3600) % 24;
      const minutos = Math.floor((totalSegundos % 3600) / 60);
      return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
    }

    if (typeof valor === 'string') {
      const limpio = valor.trim();
      if (limpio === '') {
        return null;
      }

      const candidatos = [
        DateTime.fromISO(limpio),
        DateTime.fromFormat(limpio, 'HH:mm'),
        DateTime.fromFormat(limpio, 'H:mm'),
        DateTime.fromFormat(limpio, 'HH:mm:ss'),
        DateTime.fromFormat(limpio, 'H:mm:ss'),
        DateTime.fromFormat(limpio, 'hh:mm a'),
        DateTime.fromFormat(limpio, 'h:mm a'),
        DateTime.fromFormat(limpio, 'hh:mm:ss a'),
        DateTime.fromFormat(limpio, 'h:mm:ss a'),
      ];

      for (const candidato of candidatos) {
        if (candidato.isValid) {
          return candidato.toFormat('HH:mm');
        }
      }

      if (limpio.toLowerCase().includes('gmt') || limpio.toLowerCase().includes('utc')) {
        const desdeJS = DateTime.fromJSDate(new Date(limpio));
        if (desdeJS.isValid) {
          return desdeJS.toFormat('HH:mm');
        }
      }

      return limpio;
    }

    return null;
  }
  public async listarPlacas ({ request, response }:HttpContextContract) {
    try {
      const { tipoId } = request.all();
      if (!tipoId) {
        return response.status(400).send({ mensaje: 'Todos los campos son requeridos'});
      }

      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;



      const placas = await this.servicioMantenimiento.listarPlacas(tipoId, usuario, idRol)
      return placas
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'listarPlacas')
      return this.manejarError(error, response)
    }
  }

  public async listarPlacasTodas ({ request, response }:HttpContextContract) {
    try {
      const { tipoId, vigiladoId } = request.all();
      if (!tipoId || !vigiladoId) {
        return response.status(400).send({ mensaje: 'Todos los campos son requeridos'});
      }
      if(tipoId != 4 && tipoId != 3){
        const usuario = await TblUsuarios.query().where('identificacion', vigiladoId).first();
        if(!usuario){
          return response.status(404).json({message: 'Vigilado no encontrado'})
        }
      }
      const placas = await this.servicioMantenimiento.listarPlacasTodas(tipoId,vigiladoId)
      return placas
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'listarPlacasTodas')
      return this.manejarError(error, response)
    }
  }

  public async guardarMantenimiento ({ request, response }:HttpContextContract) {
    try {
      let  proveedorId: string | undefined;;
      const { vigiladoId, placa, tipoId } = request.all()
      if (!tipoId || !vigiladoId || !placa) {
        return response.status(400).send({ mensaje: 'Todos los campos son requeridos'});
      }
      if(tipoId != 1 && tipoId != 2 && tipoId != 3 && tipoId != 4){
        return response.status(400).send({ mensaje: 'El tipoId no es valido'})
      }
      if(placa.length < 6 || placa.length >= 7){
        return response.status(400).send({ mensaje: 'La placa debe tener 6 caracteres' })
      }
      if (request?.respuestaDatos?.idRol == 5) {
        proveedorId = request.respuestaDatos.documento;
      }
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const mantenimiento = await this.servicioMantenimiento.guardarMantenimiento(request.all(), usuario, idRol, proveedorId)
      return response.status(201).json(mantenimiento)
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarMantenimiento')
      return this.manejarError(error, response)
    }
  }

  public async guardarPreventivo ({ request, response }:HttpContextContract) {
    try {
      const {mantenimientoId, tipoIdentificacion} = request.all()
      if (!mantenimientoId || isNaN(Number(mantenimientoId)) || !Number.isInteger(Number(mantenimientoId))) {
        return response.status(400).send({ mensaje: 'El mantenimientoId es requerido y debe ser un número entero' });
      }

      const datos = request.all()

      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const preventivo = await this.servicioMantenimiento.guardarPreventivo(datos, usuario, idRol)
      return response.status(201).json(preventivo)
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarPreventivo')
      return this.manejarError(error, response)
    }
  }

  public async guardarCorrectivo ({ request, response }:HttpContextContract) {
    try {
      const {mantenimientoId, tipoIdentificacion} = request.all()
       if (!mantenimientoId || isNaN(Number(mantenimientoId)) || !Number.isInteger(Number(mantenimientoId))) {
        return response.status(400).send({ mensaje: 'El mantenimientoId es requerido y debe ser un número entero' });
      }

      const datos = request.all()

      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const correctivo = await this.servicioMantenimiento.guardarCorrectivo(request.all(), usuario, idRol)
      return response.status(201).json(correctivo)
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarCorrectivo')
      return this.manejarError(error, response)
    }
  }

  public async guardarAlistamiento ({ request, response }:HttpContextContract) {
    try {
      const {
        mantenimientoId,
        tipoIdentificacionResponsable,
        numeroIdentificacionResponsable,
        nombreResponsable,
        tipoIdentificacionConductor,
        numeroIdentificacionConductor,
        nombresConductor,
        detalleActividades,
        actividades
      } = request.all();
      if (!mantenimientoId || !tipoIdentificacionResponsable || !numeroIdentificacionResponsable ||
          !nombreResponsable || !tipoIdentificacionConductor || !numeroIdentificacionConductor ||
          !nombresConductor || !detalleActividades || !actividades) {
        return response.status(400).send({ mensaje: 'Todos los campos son requeridos' });
      }

      const datos = request.all();

      const actividadesDb = await this.servicioMantenimiento.listarActividades();
      const actividadesInvalidas = actividades.some((actividad) =>
        !actividadesDb.some((actividadDb) => actividadDb.id === actividad)
      );
      if (actividadesInvalidas) {
        return response.status(400).send({ mensaje: 'Alguna actividad no es válida' });
      }
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const alistamiento = await this.servicioMantenimiento.guardarAlistamiento(request.all(), usuario, idRol);
      return response.status(201).json(alistamiento);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarAlistamiento')
      return this.manejarError(error, response)
    }
  }

  public async guardarAutorizacion ({ request, response }:HttpContextContract) {
    try {
      const {
        fechaViaje,
        origen,
        destino,
        tipoIdentificacionNna,
        numeroIdentificacionNna,
        nombresApellidosNna,
        situacionDiscapacidad,
        tipoDiscapacidad,
        perteneceComunidadEtnica,
        tipoPoblacionEtnica,
        tipoIdentificacionOtorgante,
        numeroIdentificacionOtorgante,
        nombresApellidosOtorgante,
        numeroTelefonicoOtorgante,
        correoElectronicoOtorgante,
        direccionFisicaOtorgante,
        sexoOtorgante,
        calidadActua,
        tipoIdentificacionAutorizadoViajar,
        numeroIdentificacionAutorizadoViajar,
        nombresApellidosAutorizadoViajar,
        numeroTelefonicoAutorizadoViajar,
        direccionFisicaAutorizadoViajar,
        tipoIdentificacionAutorizadoRecoger,
        numeroIdentificacionAutorizadoRecoger,
        nombresApellidosAutorizadoRecoger,
        numeroTelefonicoAutorizadoRecoger,
        direccionFisicaAutorizadoRecoger,
        copiaAutorizacionViajeNombreOriginal,
        copiaAutorizacionViajeDocumento,
        copiaAutorizacionViajeRuta,
        copiaDocumentoParentescoNombreOriginal,
        copiaDocumentoParentescoDocumento,
        copiaDocumentoParentescoRuta,
        copiaDocumentoIdentidadAutorizadoNombreOriginal,
        copiaDocumentoIdentidadAutorizadoDocumento,
        copiaDocumentoIdentidadAutorizadoRuta,
        copiaConstanciaEntregaNombreOriginal,
        copiaConstanciaEntregaDocumento,
        copiaConstanciaEntregaRuta,
        mantenimientoId
      } = request.all();
      if (!fechaViaje || !origen || !destino || !tipoIdentificacionNna || !numeroIdentificacionNna ||
          !nombresApellidosNna || !situacionDiscapacidad || !tipoDiscapacidad || !perteneceComunidadEtnica ||
          !tipoPoblacionEtnica || !tipoIdentificacionOtorgante || !numeroIdentificacionOtorgante ||
          !nombresApellidosOtorgante || !numeroTelefonicoOtorgante || !correoElectronicoOtorgante ||
          !direccionFisicaOtorgante || !sexoOtorgante || !calidadActua || !tipoIdentificacionAutorizadoViajar ||
          !numeroIdentificacionAutorizadoViajar || !nombresApellidosAutorizadoViajar ||
          !numeroTelefonicoAutorizadoViajar || !direccionFisicaAutorizadoViajar ||
          !tipoIdentificacionAutorizadoRecoger || !numeroIdentificacionAutorizadoRecoger ||
          !nombresApellidosAutorizadoRecoger || !numeroTelefonicoAutorizadoRecoger ||
          !direccionFisicaAutorizadoRecoger || !copiaAutorizacionViajeNombreOriginal ||
          !copiaAutorizacionViajeDocumento || !copiaAutorizacionViajeRuta ||
          !copiaDocumentoParentescoNombreOriginal || !copiaDocumentoParentescoDocumento ||
          !copiaDocumentoParentescoRuta || !copiaDocumentoIdentidadAutorizadoNombreOriginal ||
          !copiaDocumentoIdentidadAutorizadoDocumento || !copiaDocumentoIdentidadAutorizadoRuta ||
          !copiaConstanciaEntregaNombreOriginal || !copiaConstanciaEntregaDocumento ||
          !copiaConstanciaEntregaRuta || !mantenimientoId) {
        return response.status(400).send({ mensaje: 'Todos los campos son requeridos' });
      }

      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const autorizacion = await this.servicioMantenimiento.guardarAutorizacion(request.all(), usuario, idRol)
      return response.status(201).json(autorizacion);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarAutorizacion')
      return this.manejarError(error, response)
    }
  }

  public async visualizarPreventivo ({ request, response }:HttpContextContract) {
    try {
      const { mantenimientoId } = request.all();
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const mantenimiento = await this.servicioMantenimiento.visualizarPreventivo(mantenimientoId, usuario, idRol)
      return mantenimiento
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarPreventivo')
      return this.manejarError(error, response)
    }
  }

  public async visualizarCorrectivo ({ request, response }:HttpContextContract) {
    try {
      const { mantenimientoId } = request.all();
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const mantenimiento = await this.servicioMantenimiento.visualizarCorrectivo(mantenimientoId, usuario, idRol)
      return mantenimiento
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarCorrectivo')
      return this.manejarError(error, response)
    }
  }

  public async visualizarAlistamiento ({ request, response }:HttpContextContract) {
    try {
      const { mantenimientoId } = request.all();
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const mantenimiento = await this.servicioMantenimiento.visualizarAlistamiento(mantenimientoId, usuario, idRol)
      return mantenimiento
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarAlistamiento')
      return this.manejarError(error, response)
    }
  }

  public async visualizarAutorizacion ({ request, response }:HttpContextContract) {
    try {
      const { mantenimientoId } = request.all();
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const mantenimiento = await this.servicioMantenimiento.visualizarAutorizacion(mantenimientoId, usuario, idRol)
      return mantenimiento
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarAutorizacion')
      return this.manejarError(error, response)
    }
  }


  public async listarHistorial ({ request, response }:HttpContextContract) {
    try {
      const { tipoId, vigiladoId, placa } = request.all();
       const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const historial = await this.servicioMantenimiento.listarHistorial(tipoId, vigiladoId, placa, idRol)
      return historial
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'listarHistorial')
      return this.manejarError(error, response)
    }
  }

  public async listarActividades ({ request, response }:HttpContextContract) {
    try {
      const actividades = await this.servicioMantenimiento.listarActividades()
      return actividades.map(actividad => ({
        id: actividad.id,
        nombre: actividad.nombre
      }));
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'listarActividades')
      return this.manejarError(error, response)
    }
  }

  private async obtenerParametrica(endpoint:string){
    const host = Env.get('URL_PARAMETRICAS')
    const headers = {
      'Authorization': `Bearer 01958b08-c5b4-7799-930e-428f2a3f8e72`
    };

    try {
      const respuesta = await axios.get(`${host}/parametrica/${endpoint}`, { headers });
      return respuesta.data;
    } catch (error) {
      return []
    }
  }


  public async exportarAXLSX({ request, response }: HttpContextContract) {
    try {
      const { tipoId, vigiladoId, placa } = request.all();
      const data = await this.servicioMantenimiento.listarHistorialExportar(tipoId,vigiladoId, placa)
      const cabeceras = Object.keys(data[0] || {}).map((key) => ({
        header: key,
        key: key,
        width: 20,
      }));
      const buffer = await this.servicioExportacion.encuestaToXLSX(data, cabeceras, 'datos')
      // Configurar opciones de respuesta
      response.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      response.header('Content-Disposition', 'attachment; filename=Historial.xlsx');
      // Enviar el archivo XLSX como respuesta
      response.send(buffer);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'exportarAXLSX')
      return this.manejarError(error, response)
    }
  }

  public async cargaMasivaPreventivo({ request, response }: HttpContextContract) {
    try {
      const registros = request.input('registros');
      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).send({ mensaje: 'Debe proporcionar al menos un registro para procesar' });
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarPreventivoMasivo(registros, usuario, idRol);
      return response.status(202).json(resumen);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaPreventivo');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaPreventivoExcel({ request, response }: HttpContextContract) {
    try {
      const archivo = request.file('archivo', { extnames: ['xlsx'], size: '5mb' });
      if (!archivo) {
        return response.status(400).send({ mensaje: 'Debe adjuntar el archivo en el campo "archivo"' });
      }
      if (!archivo.isValid) {
        return response.status(400).send({ mensaje: archivo.errors?.map((error) => error.message).join(', ') || 'Archivo inválido' });
      }

      const registros = await this.leerRegistrosDesdeExcel(archivo);
      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).send({ mensaje: 'El archivo no contiene registros para procesar' });
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarPreventivoMasivo(registros, usuario, idRol);
      return response.status(202).json(resumen);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaPreventivoExcel');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaCorrectivo({ request, response }: HttpContextContract) {
    try {
      const registros = request.input('registros');
      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).send({ mensaje: 'Debe proporcionar al menos un registro para procesar' });
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarCorrectivoMasivo(registros, usuario, idRol);
      return response.status(202).json(resumen);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaCorrectivo');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaCorrectivoExcel({ request, response }: HttpContextContract) {
    try {
      const archivo = request.file('archivo', { extnames: ['xlsx'], size: '5mb' });
      if (!archivo) {
        return response.status(400).send({ mensaje: 'Debe adjuntar el archivo en el campo "archivo"' });
      }
      if (!archivo.isValid) {
        return response.status(400).send({ mensaje: archivo.errors?.map((error) => error.message).join(', ') || 'Archivo inválido' });
      }

      const registros = await this.leerRegistrosDesdeExcel(archivo);
      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).send({ mensaje: 'El archivo no contiene registros para procesar' });
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarCorrectivoMasivo(registros, usuario, idRol);
      return response.status(202).json(resumen);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaCorrectivoExcel');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaAlistamiento({ request, response }: HttpContextContract) {
    try {
      const registros = request.input('registros');
      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).send({ mensaje: 'Debe proporcionar al menos un registro para procesar' });
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarAlistamientoMasivo(registros, usuario, idRol);
      return response.status(202).json(resumen);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaAlistamiento');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaAlistamientoExcel({ request, response }: HttpContextContract) {
    try {
      const archivo = request.file('archivo', { extnames: ['xlsx'], size: '5mb' });
      if (!archivo) {
        return response.status(400).send({ mensaje: 'Debe adjuntar el archivo en el campo "archivo"' });
      }
      if (!archivo.isValid) {
        return response.status(400).send({ mensaje: archivo.errors?.map((error) => error.message).join(', ') || 'Archivo inválido' });
      }

      const registros = await this.leerRegistrosDesdeExcel(archivo);
      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).send({ mensaje: 'El archivo no contiene registros para procesar' });
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarAlistamientoMasivo(registros, usuario, idRol);
      return response.status(202).json(resumen);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaAlistamientoExcel');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaAutorizacion({ request, response }: HttpContextContract) {
    try {
      const registros = request.input('registros');
      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).send({ mensaje: 'Debe proporcionar al menos un registro para procesar' });
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarAutorizacionMasiva(registros, usuario, idRol);
      return response.status(202).json(resumen);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaAutorizacion');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaAutorizacionExcel({ request, response }: HttpContextContract) {
    try {
      const archivo = request.file('archivo', { extnames: ['xlsx'], size: '5mb' });
      if (!archivo) {
        return response.status(400).send({ mensaje: 'Debe adjuntar el archivo en el campo "archivo"' });
      }
      if (!archivo.isValid) {
        return response.status(400).send({ mensaje: archivo.errors?.map((error) => error.message).join(', ') || 'Archivo inválido' });
      }

      const registros = await this.leerRegistrosDesdeExcel(archivo);
      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).send({ mensaje: 'El archivo no contiene registros para procesar' });
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarAutorizacionMasiva(registros, usuario, idRol);
      return response.status(202).json(resumen);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaAutorizacionExcel');
      return this.manejarError(error, response);
    }
  }

}
