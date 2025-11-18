# ❓ FAQ - Preguntas Frecuentes sobre Módulos por Usuario

## General

### ¿Qué problema resuelve este sistema?

Antes, todos los usuarios con el mismo rol veían exactamente los mismos módulos. Ahora puedes personalizar qué módulos ve cada usuario individualmente, sin importar su rol.

**Ejemplo:**
- Usuario A (rol Cliente) → Solo ve "Usuarios"
- Usuario B (rol Cliente) → Ve "Usuarios" y "Mantenimiento"  
- Usuario C (rol Cliente) → Ve todos los módulos del rol Cliente

---

### ¿Puedo seguir usando la configuración por roles?

**Sí, absolutamente.** Si no asignas módulos personalizados a un usuario, automáticamente heredará los módulos de su rol. El sistema es 100% compatible con tu configuración actual.

---

### ¿Qué pasa con los usuarios existentes?

**Nada cambia.** Los usuarios existentes seguirán usando los módulos de su rol hasta que decidas asignarles módulos personalizados.

---

## Uso de la API

### ¿Cómo asigno módulos a un usuario?

```bash
POST /api/v1/usuarios/5/modulos
Authorization: Bearer {token}
Content-Type: application/json

{
  "modulos": [1, 3, 5]
}
```

**Nota:** Los números son los IDs de los módulos en la tabla `tbl_modulos`.

---

### ¿Cómo sé qué IDs tienen los módulos?

Consulta tu base de datos:

```sql
SELECT mod_id, mod_nombre, mod_nombre_mostrar 
FROM tbl_modulos 
WHERE mod_estado = true;
```

O crea un endpoint para listar módulos:

```typescript
// En tu controlador de módulos
public async listarModulos() {
  const modulos = await TblModulos.query()
    .where('mod_estado', true)
    .orderBy('mod_nombre', 'asc')
  
  return modulos.map(m => ({
    id: m.id,
    nombre: m.nombre,
    nombreMostrar: m.nombreMostrar
  }))
}
```

---

### ¿Puedo asignar módulos que no existen?

**No.** El sistema validará que los módulos existan antes de asignarlos. Si intentas asignar un módulo inexistente, recibirás un error.

---

### ¿Qué pasa si asigno módulos vacíos?

Si envías un array vacío:
```json
{ "modulos": [] }
```

El sistema retornará un error: "Debe proporcionar al menos un módulo válido"

Para volver a usar los módulos del rol, usa el endpoint de limpiar:
```http
DELETE /api/v1/usuarios/5/modulos/limpiar
```

---

### ¿Puedo agregar módulos sin eliminar los anteriores?

**No directamente.** El endpoint `POST /api/v1/usuarios/:id/modulos` reemplaza todos los módulos del usuario.

Si quieres agregar sin eliminar, debes:
1. Obtener los módulos actuales: `GET /api/v1/usuarios/5/modulos`
2. Agregar los nuevos IDs al array
3. Enviar el array completo: `POST /api/v1/usuarios/5/modulos`

Ejemplo en JavaScript:
```javascript
// 1. Obtener módulos actuales
const response = await fetch('/api/v1/usuarios/5/modulos')
const { data } = await response.json()
const modulosActuales = data.modulos.map(m => m.id)

// 2. Agregar nuevo módulo
const nuevosModulos = [...modulosActuales, 7]

// 3. Guardar
await fetch('/api/v1/usuarios/5/modulos', {
  method: 'POST',
  body: JSON.stringify({ modulos: nuevosModulos })
})
```

---

## Comportamiento del Sistema

### ¿Qué tiene prioridad: los módulos del rol o los personalizados?

**Los módulos personalizados siempre tienen prioridad.**

Si un usuario tiene módulos personalizados, el sistema ignora completamente los módulos de su rol.

---

### Si cambio los módulos del rol, ¿afecta a usuarios con módulos personalizados?

**No.** Los usuarios con módulos personalizados no se ven afectados por cambios en la configuración del rol.

**Ejemplo:**
- Rol Cliente tiene módulos: [1, 2, 3]
- Usuario Juan tiene módulos personalizados: [1, 5]
- Cambias el rol Cliente a: [1, 2, 3, 4, 6]
- **Juan sigue viendo solo [1, 5]** ← No se afecta

---

### ¿Puedo volver a usar los módulos del rol después de personalizar?

**Sí.** Usa el endpoint de limpiar:

```http
DELETE /api/v1/usuarios/5/modulos/limpiar
```

Esto eliminará todos los módulos personalizados y el usuario volverá a heredar los módulos de su rol.

---

### ¿Qué pasa si elimino un usuario?

Los módulos personalizados del usuario se eliminan automáticamente (ON DELETE CASCADE). No quedarán registros huérfanos.

---

### ¿Qué pasa si elimino un módulo?

Los módulos personalizados que referenciaban ese módulo también se eliminarán automáticamente (ON DELETE CASCADE).

---

## Seguridad y Permisos

### ¿Quién puede asignar módulos a usuarios?

Por defecto, cualquier usuario autenticado con un JWT válido puede usar estos endpoints.

**Recomendación:** Agrega un middleware adicional para restringir solo a administradores:

```typescript
// En tus rutas
Route.post('/:id/modulos', `${controlador_modulos}.asignarModulos`)
  .middleware('autenticacionJwt')
  .middleware('verificarRol:administrador') // ← Agregar esto
```

---

### ¿Cómo protejo rutas específicas por módulo?

Usa el middleware `verificarModulo`:

```typescript
Route.get('/reportes', 'ControladorReportes.index')
  .middleware('autenticacionJwt')
  .middleware('verificarModulo:reportes')
```

Esto verificará que el usuario tenga acceso al módulo "reportes" (ya sea personalizado o del rol).

---

### ¿Puedo verificar múltiples módulos?

**Sí.** El usuario debe tener acceso a **al menos uno** de los módulos especificados:

```typescript
.middleware('verificarModulo:usuarios,administracion,reportes')
```

---

## Base de Datos

### ¿Puedo tener duplicados?

**No.** Hay un índice único en la combinación `(usm_usuario_id, usm_modulo_id)`. No puedes asignar el mismo módulo dos veces al mismo usuario.

---

### ¿Cómo consulto directamente la base de datos?

```sql
-- Ver módulos personalizados de un usuario
SELECT 
  u.usn_nombre AS usuario,
  m.mod_nombre AS modulo,
  m.mod_nombre_mostrar AS nombre_mostrar
FROM tbl_usuarios_modulos um
JOIN tbl_usuarios u ON u.usn_id = um.usm_usuario_id
JOIN tbl_modulos m ON m.mod_id = um.usm_modulo_id
WHERE um.usm_usuario_id = 5
  AND um.usm_estado = true;
```

```sql
-- Ver usuarios con módulos personalizados
SELECT 
  u.usn_id,
  u.usn_nombre,
  COUNT(um.usm_id) AS total_modulos_personalizados
FROM tbl_usuarios u
LEFT JOIN tbl_usuarios_modulos um ON um.usm_usuario_id = u.usn_id
GROUP BY u.usn_id, u.usn_nombre
HAVING COUNT(um.usm_id) > 0;
```

---

## Frontend / Integración

### ¿Cómo construyo el menú en el frontend?

```javascript
// Al hacer login, obtener módulos del usuario
const response = await fetch(`/api/v1/usuarios/${userId}/modulos`, {
  headers: { 'Authorization': `Bearer ${token}` }
})

const { data } = await response.json()
const modulos = data.modulos

// Construir menú
const menu = modulos.map(modulo => ({
  label: modulo.nombreMostrar,
  icon: modulo.icono,
  route: modulo.ruta
}))

console.log(menu)
// [
//   { label: 'Usuarios', icon: 'users', route: '/usuarios' },
//   { label: 'Mantenimiento', icon: 'settings', route: '/mantenimiento' }
// ]
```

---

### ¿Debo hacer esta petición cada vez?

**No.** Guarda los módulos en el estado de tu aplicación después del login:

```javascript
// Al hacer login
const modulosResponse = await fetch('/api/v1/usuarios/me/modulos')
const { data } = await modulosResponse.json()

// Guardar en store (Redux, Vuex, Context, etc.)
store.dispatch('setModulosUsuario', data.modulos)

// O en localStorage para persistencia
localStorage.setItem('modulos', JSON.stringify(data.modulos))
```

---

### ¿Cómo oculto rutas en el frontend?

```javascript
// Ejemplo con React Router
import { Navigate } from 'react-router-dom'

function ProtectedRoute({ moduloRequerido, children }) {
  const modulos = useSelector(state => state.auth.modulos)
  const tieneAcceso = modulos.some(m => m.nombre === moduloRequerido)
  
  if (!tieneAcceso) {
    return <Navigate to="/sin-acceso" />
  }
  
  return children
}

// Uso
<Route path="/usuarios" element={
  <ProtectedRoute moduloRequerido="usuarios">
    <PaginaUsuarios />
  </ProtectedRoute>
} />
```

---

## Troubleshooting

### Error: "Cannot find module 'App/Infraestructura/Datos/Entidad/Autorizacion/RolModulo'"

**Solución:** Reinicia el servidor TypeScript:
```bash
# Detener el servidor
# Limpiar build
rm -rf build

# Recompilar
node ace build --ignore-ts-errors

# O simplemente reiniciar el servidor
node ace serve --watch
```

---

### Error: "No tiene permisos para acceder a este módulo"

**Causas posibles:**
1. El usuario no tiene el módulo asignado
2. El módulo está desactivado (`mod_estado = false`)
3. El nombre del módulo en el middleware no coincide con la BD

**Verificar:**
```sql
-- Ver módulos del usuario
SELECT m.mod_nombre 
FROM tbl_modulos m
WHERE m.mod_id IN (
  SELECT usm_modulo_id 
  FROM tbl_usuarios_modulos 
  WHERE usm_usuario_id = ?
);
```

---

### Los cambios no se reflejan inmediatamente

**Solución:** El frontend probablemente tiene los módulos en caché. El usuario debe:
1. Cerrar sesión y volver a iniciar
2. O implementa un sistema de notificaciones push para actualizar el menú en tiempo real

---

### ¿Cómo hago rollback de la migración?

```bash
node ace migration:rollback
```

Esto eliminará la tabla `tbl_usuarios_modulos` y todas sus relaciones.

---

## Mejoras Futuras

### ¿Puedo agregar más funcionalidades?

**Algunas ideas:**

1. **Auditoría**: Registrar quién asignó qué módulos y cuándo
2. **Expiración**: Módulos temporales con fecha de vencimiento
3. **Herencia mixta**: Combinar módulos del rol + personalizados
4. **Grupos de módulos**: Asignar paquetes predefinidos de módulos
5. **Notificaciones**: Avisar al usuario cuando cambien sus módulos

---

### ¿Necesito ayuda adicional?

Consulta:
- **Documentación completa**: `docs/GESTION_MODULOS_USUARIO.md`
- **Diagramas**: `docs/DIAGRAMA_MODULOS_USUARIO.md`
- **Ejemplos de código**: `docs/ejemplo_rutas_con_modulos.ts`
- **Tests**: `tests/test_modulos_usuario.js`
