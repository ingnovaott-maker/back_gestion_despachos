# 🔐 Actualización: Login con Módulos

## ✅ Cambios Implementados

### 1. Login Retorna Módulos del Usuario

El endpoint de inicio de sesión ahora incluye automáticamente los módulos disponibles para el usuario.

#### Endpoint
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "usuario": "admin",
  "contrasena": "password123"
}
```

#### Respuesta Actualizada
```json
{
  "usuario": {
    "id": 5,
    "usuario": "12345678",
    "nombre": "Juan Pérez",
    "telefono": "3001234567",
    "correo": "juan@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "rol": {
    "id": 3,
    "nombre": "Cliente",
    "modulos": [...],
    "funcionalidades": [...]
  },
  "claveTemporal": false,
  "modulos": [                    ← ¡NUEVO!
    {
      "id": 1,
      "nombre": "usuarios",
      "nombreMostrar": "Usuarios",
      "ruta": "/usuarios",
      "icono": "users",
      "estado": true
    },
    {
      "id": 3,
      "nombre": "mantenimiento",
      "nombreMostrar": "Mantenimiento",
      "ruta": "/mantenimiento",
      "icono": "settings",
      "estado": true
    }
  ]
}
```

### 2. Asignación de Módulos Mejorada

El endpoint `POST /api/v1/usuarios/:id/modulos` ahora:

1. ✅ **Elimina todos** los módulos anteriores del usuario
2. ✅ **Verifica** que los módulos existan y estén activos
3. ✅ **Crea** las nuevas asignaciones

#### Ejemplo de Uso

```bash
# Asignar módulos 1 y 3 al usuario 5
# Esto eliminará cualquier asignación previa
curl -X POST http://localhost:3333/api/v1/usuarios/5/modulos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modulos": [1, 3]}'
```

**Respuesta:**
```json
{
  "status": 200,
  "title": "Módulos asignados",
  "messages": ["Los módulos han sido asignados correctamente al usuario"]
}
```

## 🎯 Flujo Completo

### Escenario 1: Usuario sin módulos personalizados
```
1. Usuario hace login
2. Sistema verifica credenciales
3. Sistema busca módulos personalizados → No encuentra
4. Sistema obtiene módulos del rol
5. Retorna módulos del rol en la respuesta
```

**Response:**
```json
{
  "modulos": [1, 2, 3, 4, 5, 6]  // Todos los del rol
}
```

### Escenario 2: Usuario con módulos personalizados
```
1. Usuario hace login
2. Sistema verifica credenciales
3. Sistema busca módulos personalizados → Encuentra [1, 3]
4. Retorna solo esos módulos
```

**Response:**
```json
{
  "modulos": [1, 3]  // Solo los personalizados
}
```

### Escenario 3: Actualizar módulos de usuario

```javascript
// Estado inicial del usuario 5
GET /api/v1/usuarios/5/modulos
// Response: { modulos: [1, 2, 3] }

// Actualizar a solo módulos 1 y 5
POST /api/v1/usuarios/5/modulos
{ "modulos": [1, 5] }
// Se eliminan: 2, 3
// Se mantiene: 1
// Se agrega: 5

// Nuevo estado
GET /api/v1/usuarios/5/modulos
// Response: { modulos: [1, 5] }
```

## 💻 Integración Frontend

### 1. Guardar módulos al hacer login

```javascript
// Login
const response = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ usuario, contrasena })
})

const data = await response.json()

// Guardar token
localStorage.setItem('token', data.token)

// Guardar módulos (¡NUEVO!)
localStorage.setItem('modulos', JSON.stringify(data.modulos))

// O en tu store (Redux, Vuex, Context, etc.)
store.dispatch('setModulos', data.modulos)
```

### 2. Construir menú dinámico

```javascript
// Obtener módulos del localStorage
const modulos = JSON.parse(localStorage.getItem('modulos') || '[]')

// Construir menú
const menuItems = modulos.map(modulo => ({
  label: modulo.nombreMostrar,
  icon: modulo.icono,
  path: modulo.ruta,
  id: modulo.id
}))

console.log(menuItems)
// [
//   { label: 'Usuarios', icon: 'users', path: '/usuarios', id: 1 },
//   { label: 'Mantenimiento', icon: 'settings', path: '/mantenimiento', id: 3 }
// ]
```

### 3. Verificar acceso a módulos

```javascript
function tieneAccesoAModulo(nombreModulo) {
  const modulos = JSON.parse(localStorage.getItem('modulos') || '[]')
  return modulos.some(m => m.nombre === nombreModulo)
}

// Uso en componente
if (tieneAccesoAModulo('usuarios')) {
  // Mostrar opción de usuarios
}
```

### 4. Ejemplo con React Router

```jsx
import { Navigate } from 'react-router-dom'

function ProtectedRoute({ moduloRequerido, children }) {
  const modulos = JSON.parse(localStorage.getItem('modulos') || '[]')
  const tieneAcceso = modulos.some(m => m.nombre === moduloRequerido)
  
  if (!tieneAcceso) {
    return <Navigate to="/sin-acceso" replace />
  }
  
  return children
}

// Uso
<Routes>
  <Route path="/usuarios" element={
    <ProtectedRoute moduloRequerido="usuarios">
      <PaginaUsuarios />
    </ProtectedRoute>
  } />
  
  <Route path="/mantenimiento" element={
    <ProtectedRoute moduloRequerido="mantenimiento">
      <PaginaMantenimiento />
    </ProtectedRoute>
  } />
</Routes>
```

## 🔄 Actualización de Módulos

### Opción 1: Relogin
```javascript
// Cuando cambien los módulos, pedir al usuario que cierre sesión
// y vuelva a iniciar para obtener los nuevos módulos
```

### Opción 2: Endpoint de Refresh (Recomendado)
```javascript
// Agregar botón de "Actualizar permisos" en el frontend
async function actualizarModulos() {
  const userId = getCurrentUserId()
  const response = await fetch(`/api/v1/usuarios/${userId}/modulos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  const { data } = await response.json()
  localStorage.setItem('modulos', JSON.stringify(data.modulos))
  
  // Recargar página o actualizar estado
  window.location.reload()
}
```

## 📊 Validaciones Agregadas

### En `asignarModulosAUsuario`:

1. ✅ **Usuario existe**: Verifica con `findOrFail`
2. ✅ **Módulos existen**: Consulta en `tbl_modulos`
3. ✅ **Módulos activos**: Solo permite módulos con `mod_estado = true`
4. ✅ **Cantidad correcta**: Valida que todos los IDs existan

### Error si módulo no existe:
```json
{
  "status": 500,
  "title": "Error al asignar módulos",
  "messages": ["Uno o más módulos no existen o están inactivos"]
}
```

## 🧪 Probar los Cambios

### Test 1: Login y verificar módulos
```bash
# Login
curl -X POST http://localhost:3333/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario": "admin", "contrasena": "admin123"}'

# Verificar que la respuesta incluya el campo "modulos"
```

### Test 2: Asignar módulos y verificar reemplazo
```bash
# Estado inicial
curl http://localhost:3333/api/v1/usuarios/5/modulos \
  -H "Authorization: Bearer TOKEN"

# Asignar nuevos módulos (esto borra los anteriores)
curl -X POST http://localhost:3333/api/v1/usuarios/5/modulos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modulos": [1, 2]}'

# Verificar nuevo estado (solo debe tener 1 y 2)
curl http://localhost:3333/api/v1/usuarios/5/modulos \
  -H "Authorization: Bearer TOKEN"
```

### Test 3: Intentar asignar módulo inexistente
```bash
curl -X POST http://localhost:3333/api/v1/usuarios/5/modulos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modulos": [999]}'

# Debe retornar error: "Uno o más módulos no existen o están inactivos"
```

## ⚠️ Nota Importante

**Logout/Login requerido**: Cuando cambies los módulos de un usuario que ya está logueado, ese usuario necesitará:

1. Cerrar sesión
2. Volver a iniciar sesión

O implementar un sistema de actualización en tiempo real (WebSockets/Polling).

---

**Cambios completados el**: 11 de Noviembre, 2025  
**Archivos modificados**:
- `app/Dominio/Dto/RespuestaInicioSesion.ts`
- `app/Dominio/Datos/Servicios/ServicioAutenticacion.ts`
- `app/Infraestructura/Implementacion/Lucid/RepositorioUsuarioModuloDB.ts`
