import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Mantenimiento/ControladorMantenimiento'

Route.get('api/v1/mantenimiento/exportar-historial', accion_path + '.exportarAXLSX')
Route.group(() => {
  Route.get('listar-placas', accion_path + '.listarPlacas')
  Route.get('listar-placas-todas', accion_path + '.listarPlacasTodas')
  Route.get('listar-actividades', accion_path + '.listarActividades')
  Route.get('visualizar-preventivo', accion_path + '.visualizarPreventivo')
  Route.get('visualizar-correctivo', accion_path + '.visualizarCorrectivo')
  Route.get('visualizar-alistamiento', accion_path + '.visualizarAlistamiento')
   Route.get('visualizar-autorizacion', accion_path + '.visualizarAutorizacion')
  Route.get('listar-historial', accion_path + '.listarHistorial')
  Route.post('guardar-mantenimieto', accion_path + '.guardarMantenimiento')
  Route.post('guardar-preventivo', accion_path + '.guardarPreventivo')
  Route.post('guardar-correctivo', accion_path + '.guardarCorrectivo')
  Route.post('guardar-alistamiento', accion_path + '.guardarAlistamiento')
  Route.post('guardar-autorizacion', accion_path + '.guardarAutorizacion')
}).prefix('api/v1/mantenimiento').middleware('autenticacionJwt')

Route.group(() => {
  Route.get('listar-placas', accion_path + '.listarPlacas')
  Route.get('visualizar-preventivo', accion_path + '.visualizarPreventivo')
  Route.get('visualizar-correctivo', accion_path + '.visualizarCorrectivo')
  Route.get('visualizar-alistamiento', accion_path + '.visualizarAlistamiento')
   Route.get('visualizar-autorizacion', accion_path + '.visualizarAutorizacion')
  Route.get('listar-historial', accion_path + '.listarHistorial')
  Route.post('guardar-mantenimieto', accion_path + '.guardarMantenimiento')
  Route.post('guardar-preventivo', accion_path + '.guardarPreventivo')
  Route.post('guardar-correctivo', accion_path + '.guardarCorrectivo')
  Route.post('guardar-alistamiento', accion_path + '.guardarAlistamiento')
  Route.post('guardar-autorizacion', accion_path + '.guardarAutorizacion')

}).prefix('api/v2/mantenimiento').middleware('autenticacionVigia')

Route.group(() => {
  Route.get('listar-actividades', accion_path + '.listarActividades')

}).prefix('api/v2/mantenimiento').middleware('autenticacionVigia')
