/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { Exception, Request } from "@adonisjs/core/build/standalone";
import { Paginador } from "../../../Dominio/Paginador";
import { MapeadorPaginacionDB } from "./MapeadorPaginacionDB";
import { RepositorioMantenimiento } from "App/Dominio/Repositorios/RepositorioMantenimiento";
import Env from "@ioc:Adonis/Core/Env";
import axios from "axios";
import TblMantenimiento from "App/Infraestructura/Datos/Entidad/Mantenimiento";
import { DateTime } from "luxon";
import TblUsuarios from "App/Infraestructura/Datos/Entidad/Usuario";
import TblPreventivo from "App/Infraestructura/Datos/Entidad/Preventivos";
import TblCorrectivo from "App/Infraestructura/Datos/Entidad/Correctivo";
import { id } from "date-fns/locale";
import TblAlistamiento from "App/Infraestructura/Datos/Entidad/Alistamiento";
import TblActividadesAlistamiento from "App/Infraestructura/Datos/Entidad/ActividadesAlistamiento";
import TblDetallesAlistamientoActividades from "App/Infraestructura/Datos/Entidad/DetallesAlistamientoActividades";
import TblAutorizaciones from "App/Infraestructura/Datos/Entidad/Autorizaciones";
import { TokenExterno } from "App/Dominio/Utilidades/TokenExterno";

export class RepositorioMantenimientoDB implements RepositorioMantenimiento {

  /**
   * Obtiene la fecha actual ajustada a la zona horaria de Colombia
   * restando las horas configuradas en TIMEZONE_OFFSET_HOURS
   */
  private getColombiaDate(): Date {
    const offsetHours = parseInt(Env.get('TIMEZONE_OFFSET_HOURS', '5'));
    const now = new Date();
    return new Date(now.getTime() - (offsetHours * 60 * 60 * 1000));
  }

  /**
   * Obtiene la fecha actual de Colombia como DateTime de Luxon
   */
  private getColombiaDateTime(): DateTime {
    return DateTime.fromJSDate(this.getColombiaDate());
  }

  /**
   * Obtiene los datos de autenticación según el rol del usuario
   */
  private async obtenerDatosAutenticacion(usuario: string, idRol: number): Promise<{tokenAutorizacion: string, nitVigilado: string, usuarioId: number}> {
    let tokenAutorizacion = '';
    let nitVigilado = '';
    let usuarioId = 0;

    const usuarioDb = await TblUsuarios.query().where('identificacion', usuario).first();

    if (!usuarioDb) {
      throw new Exception("Usuario no encontrado", 404);
    }

    console.log({usuarioDb});


    if (idRol == 3) {
      nitVigilado = usuarioDb.administrador!;
      const usuarioAdministrador = await TblUsuarios.query().where('identificacion', usuarioDb.administrador!).first();
      if (!usuarioAdministrador) {
        throw new Exception("Usuario administrador no encontrado", 404);
      }
      tokenAutorizacion = usuarioAdministrador.tokenAutorizado || '';
      usuarioId = usuarioAdministrador.id!;
    } else if (idRol == 2 || idRol == 1) {
      nitVigilado = usuarioDb.identificacion!;
      tokenAutorizacion = usuarioDb.tokenAutorizado || '';
      usuarioId = usuarioDb.id!;
    }

    // Validar que el token no esté vacío
    if (!tokenAutorizacion || tokenAutorizacion.trim() === '') {
      throw new Exception("Token de autorización no encontrado. Por favor, contacte al administrador.", 400);
    }

    return { tokenAutorizacion, nitVigilado, usuarioId };
  }

  async listarPlacas(tipoId: number, usuario: string, idRol: number): Promise<any[]> {

try {
          if (!TokenExterno.get() || !TokenExterno.isVigente()) {
            throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
          }

          // Obtener datos de autenticación según el rol
          const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

          // Enviar datos al API externo de mantenimiento
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");
       // const token = Env.get("TOKEN");

        const respuestaArchivosPrograma = await axios.get(
          `${urlMantenimientos}/mantenimiento/listar-placas?vigiladoId=${nitVigilado}&tipoId=${tipoId}`,
          {
            headers: {
              'Authorization': `Bearer ${TokenExterno.get()}`,
              'token': tokenAutorizacion,
              'Content-Type': 'application/json'
            }
          }
        );

        // Retornar la respuesta del API externo
        return respuestaArchivosPrograma.data;
      } catch (errorExterno: any) {
        console.error("Error al enviar datos al API externo de mantenimiento:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de mantenimiento",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }

    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  async guardarMantenimiento(datos: any, usuario: string, idRol: number, proveedorId?: string): Promise<any> {
    try {
      // Validar que exista el token externo
      if (!TokenExterno.get() || !TokenExterno.isVigente()) {
        throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
      }

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      const { vigiladoId, placa, tipoId } = datos;
      const fechaCreacion = this.getColombiaDateTime();
      const mantenimientoDTO = {
        placa,
        usuarioId: vigiladoId,
        tipoId,
        createdAt: fechaCreacion,
        fechaDiligenciamiento: fechaCreacion,
      };
      if (tipoId != 4) {
        await TblMantenimiento.query()
          .where("usuarioId", vigiladoId)
          .where("placa", placa)
          .where("tipoId", tipoId)
          .update({ estado: false });
      }
      const mantenimiento = await TblMantenimiento.create(mantenimientoDTO);

      // Enviar datos al API externo de mantenimiento
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const datosMantenimiento = {
          vigiladoId: parseInt(vigiladoId),
          placa,
          tipoId
        };

        const respuestaMantenimiento = await axios.post(
          `${urlMantenimientos}/mantenimiento/guardar-mantenimieto`,
          datosMantenimiento,
          {
            headers: {
              'Authorization': `Bearer ${TokenExterno.get()}`,
              'token': tokenAutorizacion,
              'Content-Type': 'application/json'
            }
          }
        );

        // Si la respuesta es exitosa (200 o 201), actualizar el campo procesado y guardar el ID en mantenimientoId
        if ((respuestaMantenimiento.status === 200 || respuestaMantenimiento.status === 201) && mantenimiento.id) {
          const mantenimientoIdExterno = respuestaMantenimiento.data?.id || respuestaMantenimiento.data?.data?.id;
          await TblMantenimiento.query()
            .where("id", mantenimiento.id)
            .update({
              procesado: true,
              mantenimientoId: mantenimientoIdExterno
            });
        }

        // Retornar la respuesta del API externo
        return respuestaMantenimiento.data;
      } catch (errorExterno: any) {
        console.error("Error al enviar datos al API externo de mantenimiento:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de mantenimiento",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error("No se pudo guardar el mantenimiento");
    }
  }

  async guardarPreventivo(datos: any, usuario: string, idRol: number): Promise<any> {
    const {
      placa,
      fecha,
      hora,
      nit,
      razonSocial,
      tipoIdentificacion,
      numeroIdentificacion,
      nombresResponsable,
      mantenimientoId,
      detalleActividades,
    } = datos;
    try {
      // Validar que exista el token externo
      if (!TokenExterno.get() || !TokenExterno.isVigente()) {
        throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
      }

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // 1. Guardar localmente primero
      const preventivoDTO = {
        placa,
        fecha,
        hora,
        nit,
        razonSocial,
        tipoIdentificacion,
        numeroIdentificacion,
        nombresResponsable,
        mantenimientoId,
        detalleActividades,
        procesado: false
      };
      const preventivo = await TblPreventivo.create(preventivoDTO);

      // 2. Enviar datos al API externo de mantenimiento preventivo
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const datosPreventivo = {
          fecha,
          hora,
          nit,
          razonSocial,
          tipoIdentificacion,
          numeroIdentificacion,
          nombresResponsable,
          mantenimientoId,
          detalleActividades
        };

        const respuestaPreventivo = await axios.post(
          `${urlMantenimientos}/mantenimiento/guardar-preventivo`,
          datosPreventivo,
          {
            headers: {
              'Authorization': `Bearer ${TokenExterno.get()}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado,
              'Content-Type': 'application/json'
            }
          }
        );

        // 3. Si la respuesta es exitosa (200 o 201), actualizar el campo procesado y mantenimientoId
        if ((respuestaPreventivo.status === 200 || respuestaPreventivo.status === 201) && preventivo.id) {
          const mantenimientoIdExterno = respuestaPreventivo.data?.mantenimiento_id || respuestaPreventivo.data?.mantenimientoId || respuestaPreventivo.data?.data?.mantenimientoId;
          await TblPreventivo.query()
            .where("id", preventivo.id)
            .update({
              procesado: true,
              mantenimientoId: mantenimientoIdExterno || mantenimientoId
            });
        }

        // Retornar la respuesta del API externo
        return respuestaPreventivo.data;
      } catch (errorExterno: any) {
        console.error("Error al enviar datos al API externo de mantenimiento preventivo:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de mantenimiento preventivo",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error("No se pudo guardar el mantenimiento preventivo");
    }
  }

  async guardarCorrectivo(datos: any, usuario: string, idRol: number): Promise<any> {
    const {
      placa,
      fecha,
      hora,
      nit,
      razonSocial,
      tipoIdentificacion,
      numeroIdentificacion,
      nombresResponsable,
      mantenimientoId,
      detalleActividades,
    } = datos;
    try {
      // Validar que exista el token externo
      if (!TokenExterno.get() || !TokenExterno.isVigente()) {
        throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
      }

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // 1. Guardar localmente primero
      const correctivoDTO = {
        placa,
        fecha,
        hora,
        nit,
        razonSocial,
        tipoIdentificacion,
        numeroIdentificacion,
        nombresResponsable,
        mantenimientoId,
        detalleActividades,
        procesado: false
      };
      const correctivo = await TblCorrectivo.create(correctivoDTO);

      // 2. Enviar datos al API externo de mantenimiento correctivo
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const datosCorrectivo = {
          fecha,
          hora,
          nit,
          razonSocial,
          tipoIdentificacion,
          numeroIdentificacion,
          nombresResponsable,
          mantenimientoId,
          detalleActividades
        };

        const respuestaCorrectivo = await axios.post(
          `${urlMantenimientos}/mantenimiento/guardar-correctivo`,
          datosCorrectivo,
          {
            headers: {
              'Authorization': `Bearer ${TokenExterno.get()}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado,
              'Content-Type': 'application/json'
            }
          }
        );

        // 3. Si la respuesta es exitosa (200 o 201), actualizar el campo procesado y mantenimientoId
        if ((respuestaCorrectivo.status === 200 || respuestaCorrectivo.status === 201) && correctivo.id) {
          const mantenimientoIdExterno = respuestaCorrectivo.data?.mantenimiento_id || respuestaCorrectivo.data?.mantenimientoId || respuestaCorrectivo.data?.data?.mantenimientoId;
          await TblCorrectivo.query()
            .where("id", correctivo.id)
            .update({
              procesado: true,
              mantenimientoId: mantenimientoIdExterno || mantenimientoId
            });
        }

        // Retornar la respuesta del API externo
        return respuestaCorrectivo.data;
      } catch (errorExterno: any) {
        console.error("Error al enviar datos al API externo de mantenimiento correctivo:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de mantenimiento correctivo",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error("No se pudo guardar el mantenimiento correctivo");
    }
  }

  async guardarAlistamiento(datos: any, usuario: string, idRol: number): Promise<any> {
    const {
      placa,
      tipoIdentificacionResponsable,
      numeroIdentificacionResponsable,
      nombreResponsable,
      tipoIdentificacionConductor,
      numeroIdentificacionConductor,
      nombresConductor,
      mantenimientoId,
      detalleActividades,
      actividades,
    } = datos;
    try {
      // Validar que exista el token externo
      if (!TokenExterno.get() || !TokenExterno.isVigente()) {
        throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
      }

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // 1. Guardar localmente primero
      const alistamientoDTO = {
        placa,
        tipoIdentificacionResponsable,
        numeroIdentificacionResponsable,
        nombreResponsable,
        tipoIdentificacionConductor,
        numeroIdentificacionConductor,
        nombresConductor,
        mantenimientoId,
        detalleActividades,
        estado: true,
        procesado: false
      };
      const alistamiento = await TblAlistamiento.create(alistamientoDTO);

      // Guardar actividades relacionadas si existen
      if (actividades && actividades.length > 0 && alistamiento.id) {
        for (const actividad of actividades) {
          await alistamiento.related('actividades').attach({
            [actividad.id]: {
              tda_estado: actividad.estado
            }
          });
        }
      }

      // 2. Enviar datos al API externo de alistamiento
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const datosAlistamiento = {
          tipoIdentificacionResponsable,
          numeroIdentificacionResponsable,
          nombreResponsable,
          tipoIdentificacionConductor,
          numeroIdentificacionConductor,
          nombresConductor,
          mantenimientoId,
          detalleActividades,
          actividades
        };

        const respuestaAlistamiento = await axios.post(
          `${urlMantenimientos}/mantenimiento/guardar-alistamiento`,
          datosAlistamiento,
          {
            headers: {
              'Authorization': `Bearer ${TokenExterno.get()}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado
            }
          }
        );

        // 3. Si la respuesta es exitosa (200 o 201), actualizar el campo procesado y mantenimientoId
        if ((respuestaAlistamiento.status === 200 || respuestaAlistamiento.status === 201) && alistamiento.id) {
          const mantenimientoIdExterno = respuestaAlistamiento.data?.mantenimiento_id || respuestaAlistamiento.data?.mantenimientoId || respuestaAlistamiento.data?.data?.mantenimientoId;
          await TblAlistamiento.query()
            .where("id", alistamiento.id)
            .update({
              procesado: true,
              mantenimientoId: mantenimientoIdExterno || mantenimientoId
            });
        }

        // Retornar la respuesta del API externo
        return respuestaAlistamiento.data;
      } catch (errorExterno: any) {
        console.error("Error al enviar datos al API externo de alistamiento:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de alistamiento",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error("No se pudo guardar el alistamiento");
    }
  }

  async guardarAutorizacion(datos: any, usuario: string, idRol: number): Promise<any> {
    const { mantenimientoId } = datos;
    try {
      // Validar que exista el token externo
      if (!TokenExterno.get() || !TokenExterno.isVigente()) {
        throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
      }

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // 1. Guardar localmente primero (sin los archivos que vienen como FormData)
      const autorizacionDTO = {
        fechaViaje: datos.fechaViaje,
        origen: datos.origen,
        destino: datos.destino,
        tipoIdentificacionNna: datos.tipoIdentificacionNna,
        numeroIdentificacionNna: datos.numeroIdentificacionNna,
        nombresApellidosNna: datos.nombresApellidosNna,
        situacionDiscapacidad: datos.situacionDiscapacidad,
        tipoDiscapacidad: datos.tipoDiscapacidad,
        perteneceComunidadEtnica: datos.perteneceComunidadEtnica,
        tipoPoblacionEtnica: datos.tipoPoblacionEtnica,
        tipoIdentificacionOtorgante: datos.tipoIdentificacionOtorgante,
        numeroIdentificacionOtorgante: datos.numeroIdentificacionOtorgante,
        nombresApellidosOtorgante: datos.nombresApellidosOtorgante,
        numeroTelefonicoOtorgante: datos.numeroTelefonicoOtorgante,
        correoElectronicoOtorgante: datos.correoElectronicoOtorgante,
        direccionFisicaOtorgante: datos.direccionFisicaOtorgante,
        sexoOtorgante: datos.sexoOtorgante,
        generoOtorgante: datos.generoOtorgante,
        calidadActua: datos.calidadActua,
        tipoIdentificacionAutorizadoViajar: datos.tipoIdentificacionAutorizadoViajar,
        numeroIdentificacionAutorizadoViajar: datos.numeroIdentificacionAutorizadoViajar,
        nombresApellidosAutorizadoViajar: datos.nombresApellidosAutorizadoViajar,
        numeroTelefonicoAutorizadoViajar: datos.numeroTelefonicoAutorizadoViajar,
        direccionFisicaAutorizadoViajar: datos.direccionFisicaAutorizadoViajar,
        tipoIdentificacionAutorizadoRecoger: datos.tipoIdentificacionAutorizadoRecoger,
        numeroIdentificacionAutorizadoRecoger: datos.numeroIdentificacionAutorizadoRecoger,
        nombresApellidosAutorizadoRecoger: datos.nombresApellidosAutorizadoRecoger,
        numeroTelefonicoAutorizadoRecoger: datos.numeroTelefonicoAutorizadoRecoger,
        direccionFisicaAutorizadoRecoger: datos.direccionFisicaAutorizadoRecoger,
        copiaAutorizacionViajeNombreOriginal: datos.copiaAutorizacionViajeNombreOriginal,
        copiaAutorizacionViajeDocumento: datos.copiaAutorizacionViajeDocumento,
        copiaAutorizacionViajeRuta: datos.copiaAutorizacionViajeRuta,
        copiaDocumentoParentescoNombreOriginal: datos.copiaDocumentoParentescoNombreOriginal,
        copiaDocumentoParentescoDocumento: datos.copiaDocumentoParentescoDocumento,
        copiaDocumentoParentescoRuta: datos.copiaDocumentoParentescoRuta,
        copiaDocumentoIdentidadAutorizadoNombreOriginal: datos.copiaDocumentoIdentidadAutorizadoNombreOriginal,
        copiaDocumentoIdentidadAutorizadoDocumento: datos.copiaDocumentoIdentidadAutorizadoDocumento,
        copiaDocumentoIdentidadAutorizadoRuta: datos.copiaDocumentoIdentidadAutorizadoRuta,
        copiaConstanciaEntregaNombreOriginal: datos.copiaConstanciaEntregaNombreOriginal,
        copiaConstanciaEntregaDocumento: datos.copiaConstanciaEntregaDocumento,
        copiaConstanciaEntregaRuta: datos.copiaConstanciaEntregaRuta,
        mantenimientoId,
        estado: true
      };
      const autorizacion = await TblAutorizaciones.create(autorizacionDTO);

      // 2. Enviar datos al API externo de autorización
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const respuestaAutorizacion = await axios.post(
          `${urlMantenimientos}/mantenimiento/guardar-autorizacion`,
          datos,
          {
            headers: {
              'Authorization': `Bearer ${TokenExterno.get()}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado,
              'Content-Type': 'application/json'
            }
          }
        );

        // 3. Si la respuesta es exitosa (200 o 201), actualizar el mantenimiento como procesado y el mantenimientoId en autorizacion
        if ((respuestaAutorizacion.status === 200 || respuestaAutorizacion.status === 201) && mantenimientoId && autorizacion.id) {
          const mantenimientoIdExterno = respuestaAutorizacion.data?.mantenimiento_id || respuestaAutorizacion.data?.mantenimientoId || respuestaAutorizacion.data?.data?.mantenimientoId;

          await TblMantenimiento.query()
            .where("id", mantenimientoId)
            .update({ procesado: true });

          await TblAutorizaciones.query()
            .where("id", autorizacion.id)
            .update({ mantenimientoId: mantenimientoIdExterno || mantenimientoId });
        }

        // Retornar la respuesta del API externo
        return respuestaAutorizacion.data;
      } catch (errorExterno: any) {
        console.error("Error al enviar datos al API externo de autorización:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de autorización",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error("No se pudo guardar la autorizacion");
    }
  }

  async visualizarPreventivo(mantenimientoId: number, usuario: string, idRol: number): Promise<any> {
    try {
      // Validar que exista el token externo
      if (!TokenExterno.get() || !TokenExterno.isVigente()) {
        throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
      }

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // Consultar el API externo
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const respuestaPreventivo = await axios.get(
          `${urlMantenimientos}/mantenimiento/visualizar-preventivo?mantenimientoId=${mantenimientoId}`,
          {
            headers: {
              'Authorization': `Bearer ${TokenExterno.get()}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado
            }
          }
        );

        return respuestaPreventivo.data;
      } catch (errorExterno: any) {
        console.error("Error al consultar el API externo de mantenimiento preventivo:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de mantenimiento preventivo",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  async visualizarCorrectivo(mantenimientoId: number, usuario: string, idRol: number): Promise<any> {
    try {
      // Validar que exista el token externo
      if (!TokenExterno.get() || !TokenExterno.isVigente()) {
        throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
      }

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // Consultar el API externo
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const respuestaCorrectivo = await axios.get(
          `${urlMantenimientos}/mantenimiento/visualizar-correctivo?mantenimientoId=${mantenimientoId}`,
          {
            headers: {
              'Authorization': `Bearer ${TokenExterno.get()}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado
            }
          }
        );

        return respuestaCorrectivo.data;
      } catch (errorExterno: any) {
        console.error("Error al consultar el API externo de mantenimiento correctivo:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de mantenimiento correctivo",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  async visualizarAlistamiento(mantenimientoId: number, usuario: string, idRol: number): Promise<any> {
    try {
      // Validar que exista el token externo
      if (!TokenExterno.get() || !TokenExterno.isVigente()) {
        throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
      }

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // Consultar el API externo
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const respuestaAlistamiento = await axios.get(
          `${urlMantenimientos}/mantenimiento/visualizar-alistamiento?mantenimientoId=${mantenimientoId}`,
          {
            headers: {
              'Authorization': `Bearer ${TokenExterno.get()}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado
            }
          }
        );

        return respuestaAlistamiento.data;
      } catch (errorExterno: any) {
        console.error("Error al consultar el API externo de alistamiento:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de alistamiento",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de alistamiento"
      );
    }
  }

  async visualizarAutorizacion(mantenimientoId: number, usuario: string, idRol: number): Promise<any> {
    try {
      // Validar que exista el token externo
      if (!TokenExterno.get() || !TokenExterno.isVigente()) {
        throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
      }

      // Obtener datos de autenticación según el rol
      const { tokenAutorizacion, nitVigilado, usuarioId } = await this.obtenerDatosAutenticacion(usuario, idRol);

      // Consultar el API externo
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const respuestaAutorizacion = await axios.get(
          `${urlMantenimientos}/mantenimiento/visualizar-autorizacion?mantenimientoId=${mantenimientoId}`,
          {
            headers: {
              'Authorization': `Bearer ${TokenExterno.get()}`,
              'token': tokenAutorizacion,
              'vigiladoId': nitVigilado
            }
          }
        );

        return respuestaAutorizacion.data;
      } catch (errorExterno: any) {
        console.error("Error al consultar el API externo de autorización:", errorExterno);
        // Crear excepción con la respuesta completa del API externo si existe
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de autorización",
          errorExterno.response?.status || 500
        );
        // Agregar los datos completos del API externo a la excepción
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de alistamiento"
      );
    }
  }

  async listarHistorial(
    tipoId: number,
    vigiladoId: string,
    placa: string
  ): Promise<any[]> {
    try {
      if (!TokenExterno.get() || !TokenExterno.isVigente()) {
        throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
      }

      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        // Obtener el usuario para conseguir el token de autorización
        const usuarioDb = await TblUsuarios.query().where('identificacion', vigiladoId).first();
        if (!usuarioDb) {
          throw new Exception("Usuario no encontrado", 404);
        }
        const tokenAutorizacion = usuarioDb.tokenAutorizado || '';

        const respuestaHistorial = await axios.get(
          `${urlMantenimientos}/mantenimiento/listar-historial?tipoId=${tipoId}&vigiladoId=${vigiladoId}&placa=${placa}`,
          {
            headers: {
              'Authorization': `Bearer ${TokenExterno.get()}`,
              'token': tokenAutorizacion,
              'Content-Type': 'application/json'
            }
          }
        );

        return respuestaHistorial.data;
      } catch (errorExterno: any) {
        console.error("Error al consultar historial desde API externo:", errorExterno);
        const exception = new Exception(
          errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al consultar historial de mantenimiento",
          errorExterno.response?.status || 500
        );
        if (errorExterno.response?.data) {
          (exception as any).responseData = errorExterno.response.data;
        }
        throw exception;
      }
    } catch (error: any) {
      console.log(error);
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de historial para este usuario"
      );
    }
  }

  // MÉTODO ANTERIOR COMENTADO - se mantiene por si se necesita volver a lógica local
  /* async listarHistorialLocal(
    tipoId: number,
    vigiladoId: string,
    placa: string
  ): Promise<any[]> {
    try {
      const usuario = await TblUsuarios.query()
        .where("identificacion", vigiladoId)
        .first();

      let mantenimientosArr = new Array();

      const mantenimientos = await TblMantenimiento.query().orderBy('id', 'desc')
        .where("placa", placa)
        .where("usuarioId", usuario?.id!)
        .where("tipoId", tipoId);

      if (tipoId == 1 && mantenimientos.length > 0) {
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblPreventivo.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 2 && mantenimientos.length > 0) {
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblCorrectivo.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 3 && mantenimientos.length > 0) {
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblAlistamiento.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 4 && mantenimientos.length > 0) {
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblAutorizaciones.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();

          if (mantenimientosDB) {
            const estado = mantenimientosDB.fechaViaje
              ? (() => {
                const today = this.getColombiaDateTime().startOf('day');

                const viajeDate = DateTime.fromJSDate(new Date(mantenimientosDB.fechaViaje)).startOf('day');

                const timeDifference = today.diff(viajeDate, 'days').days;
                return timeDifference <= 0;
              })()
              : true;
            if (estado !== mantenimientosDB.estado) {
              await TblMantenimiento.query().where("id", mantenimiento.id!).update({ estado })
            }
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: estado });
          }
        }
      }


      return mantenimientosArr;
    } catch (error) {
      console.log(error);

      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  } */

  async listarActividades(): Promise<any[]> {
    try {
      const actividades = await TblActividadesAlistamiento.query().where('estado', true).orderBy('nombre', 'asc');
      return actividades.map((actividad) => {
        return {
          id: actividad.id,
          nombre: actividad.nombre,
          estado: false,
        };
      });
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  async listarPlacasTodas(tipoId: number, vigiladoId: string): Promise<any[]> {
    const host = "";
    const endpoint = `/vehiculos/listar-vigilado?identificacion=${vigiladoId}`;
    try {
      const respuesta = await axios.get(`${host}${endpoint}`, {});

      const mantenimientos = new Array();
      if (respuesta.data.length === 0) {
        throw new Error("No se encontraron placas");
      }
      const placas = respuesta.data;
      const usuario = await TblUsuarios.query()
        .where("identificacion", vigiladoId)
        .first();

      const mantenimientosDBX = TblMantenimiento.query().whereIn("placa", placas)
        .where("usuarioId", usuario?.id!)
        .where("tipoId", tipoId)

      if (tipoId == 4) {
        mantenimientosDBX
          .distinctOn("placa")
          .orderBy("placa")
      } else {
        mantenimientosDBX.where("estado", true)
      }
      const mantenimientosDB = await mantenimientosDBX
        .orderBy('id', 'desc');


      const hoy = this.getColombiaDateTime();

      placas.forEach((placa) => {
        const existePlaca = mantenimientosDB.find((p) => p.placa == placa);
        let estadoMantenimiento = "Sin reporte";

        if (existePlaca) {
          if (existePlaca.fechaDiligenciamiento) {
            const fechaDiligenciamiento = DateTime.fromJSDate(
              new Date(existePlaca.fechaDiligenciamiento.toString())
            ).plus({ months: 2 });
            const diferenciaDias = fechaDiligenciamiento.diff(hoy, 'days').days;

            if (!existePlaca.estado) {
              estadoMantenimiento = "Vencido";
            } else {
             /*  if (existePlaca.estadoId == 2) {
                estadoMantenimiento = "Iniciado";
              } else  */if (diferenciaDias < -1) {
                estadoMantenimiento = "Vencido";
              } else if (diferenciaDias <= 15) {
                estadoMantenimiento = "Próximo a vencer";
              } else {
                estadoMantenimiento = "Reportado vigente";
              }
            }

            mantenimientos.push({
              placa,
              fechaDiligenciamiento: existePlaca.fechaDiligenciamiento,
              estadoMantenimiento,
              tipoId,
              id: existePlaca.id,
            });
          }
        } else {
          mantenimientos.push({
            placa,
            fechaDiligenciamiento: "",
            estadoMantenimiento,
            tipoId,
            id: null,
          });
        }
      });

      const mantenimientosNoInDB = await TblMantenimiento.query()
        .whereNotIn("placa", placas)
        .where("usuarioId", usuario?.id!)
        .where("tipoId", tipoId)
        .where("estado", true).orderBy('id', 'desc');

      mantenimientosNoInDB.forEach(mant => {
        const existeMant = mantenimientos.find(m => m.placa == mant.placa);
        if (!existeMant) {
          mantenimientos.push({
            placa: mant.placa,
            fechaDiligenciamiento: mant.fechaDiligenciamiento,
            estadoMantenimiento: "Placa desvinculada",
            tipoId,
            id: mant.id,
          })
        }
      });


      return mantenimientos;
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  async listarHistorialExportar(
    tipoId: number,
    vigiladoId: string,
    placa: string
  ): Promise<any[]> {
    try {
      const usuario = await TblUsuarios.query()
        .where("identificacion", vigiladoId)
        .first();

      let mantenimientosArr = new Array();

      const mantenimientos = await TblMantenimiento.query().orderBy('id', 'desc')
        .where("placa", placa)
        .where("usuarioId", usuario?.id!)
        .where("tipoId", tipoId);

      if (tipoId == 1 && mantenimientos.length > 0) {
        const parametricas = await this.obtenerParametrica('listar-tipo-identificaciones');

        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblPreventivo.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const parametrica = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacion)
            mantenimientosDB.tipoIdentificacion = parametrica.descripcion
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 2 && mantenimientos.length > 0) {
        const parametricas = await this.obtenerParametrica('listar-tipo-identificaciones');
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblCorrectivo.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const parametrica = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacion)
            mantenimientosDB.tipoIdentificacion = parametrica.descripcion
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 3 && mantenimientos.length > 0) {
        const parametricas = await this.obtenerParametrica('listar-tipo-identificaciones');
        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblAlistamiento.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const parametrica1 = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionResponsable)
            mantenimientosDB.tipoIdentificacionResponsable = parametrica1.descripcion
            const parametrica2 = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionConductor)
            mantenimientosDB.tipoIdentificacionConductor = parametrica2.descripcion
            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }

      if (tipoId == 4 && mantenimientos.length > 0) {
        const parametricas = await this.obtenerParametrica('listar-tipo-identificaciones');
        const parametricaCentros = await this.obtenerParametrica('listar-centros-poblados');
        const parametricaDiscapacidad = await this.obtenerParametrica('listar-tipo-discapacidades');
        const parametricaPoblacion = await this.obtenerParametrica('listar-tipo-poblaciones-etnicas');
        const parametricaSexo = await this.obtenerParametrica('listar-tipo-sexos');
        const parametricacalidadActua = await this.obtenerParametrica('listar-tipo-parentescos');



        for await (const mantenimiento of mantenimientos) {
          const mantenimientosDB = await TblAutorizaciones.query()
            .where("mantenimientoId", mantenimiento.id!)
            .first();
          if (mantenimientosDB) {
            const tipoIdentificacionNna = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionNna)
            mantenimientosDB.tipoIdentificacionNna = tipoIdentificacionNna.descripcion
            const tipoIdentificacionOtorgante = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionOtorgante)
            mantenimientosDB.tipoIdentificacionOtorgante = tipoIdentificacionOtorgante.descripcion
            const tipoIdentificacionAutorizadoViajar = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionAutorizadoViajar)
            mantenimientosDB.tipoIdentificacionAutorizadoViajar = tipoIdentificacionAutorizadoViajar.descripcion
            const tipoIdentificacionAutorizadoRecoger = parametricas.find((p: any) => p.codigo == mantenimientosDB.tipoIdentificacionAutorizadoRecoger)
            mantenimientosDB.tipoIdentificacionAutorizadoRecoger = tipoIdentificacionAutorizadoRecoger.descripcion

            const origen = parametricaCentros.find((p: any) => p.codigo == mantenimientosDB.origen)
            mantenimientosDB.origen = origen?.descripcion ?? ''
            const destino = parametricaCentros.find((p: any) => p.codigo == mantenimientosDB.destino)
            mantenimientosDB.destino = destino?.descripcion ?? ''

            const tipoDiscapacidad = parametricaDiscapacidad.find((p: any) => p.codigo == mantenimientosDB.tipoDiscapacidad)
            mantenimientosDB.tipoDiscapacidad = tipoDiscapacidad?.descripcion ?? ''

            const tipoPoblacionEtnica = parametricaPoblacion.find((p: any) => p.codigo == mantenimientosDB.tipoPoblacionEtnica)
            mantenimientosDB.tipoPoblacionEtnica = tipoPoblacionEtnica?.descripcion ?? ''

            const sexoOtorgante = parametricaSexo.find((p: any) => p.codigo == mantenimientosDB.sexoOtorgante)
            mantenimientosDB.sexoOtorgante = sexoOtorgante?.descripcion ?? ''

            const calidadActua = parametricacalidadActua.find((p: any) => p.codigo == mantenimientosDB.calidadActua)
            mantenimientosDB.calidadActua = calidadActua?.descripcion ?? ''


            const actividades = mantenimientosDB?.toJSON()
            mantenimientosArr.push({ ...actividades, estadoMantenimiento: mantenimiento.estado });
          }
        }
      }


      return mantenimientosArr;
    } catch (error: any) {
      console.log(error);
      // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
      if (error instanceof Exception) {
        throw error;
      }
      throw new Error(
        "No se encontraron registros de placas para este usuario"
      );
    }
  }

  private async obtenerParametrica(endpoint: string) {
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
}
