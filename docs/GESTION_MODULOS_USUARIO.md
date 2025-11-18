# Gestión de Módulos por Usuario

## 📋 Descripción

Este sistema permite asignar módulos específicos a cada usuario de forma individual, independientemente de su rol. 

### Funcionamiento:

1. **Sin módulos personalizados**: El usuario hereda los módulos de su rol (comportamiento actual)
2. **Con módulos personalizados**: El usuario solo ve los módulos que le fueron asignados específicamente

## 🔧 Endpoints API

### 1. Asignar módulos a un usuario

```http
POST /api/v1/usuarios/:id/modulos
Authorization: Bearer {token}
Content-Type: application/json

{
  "modulos": [1, 2, 3]
}
```

**Descripción**: Asigna módulos específicos al usuario. Reemplaza cualquier asignación previa.

**Ejemplo**:
```bash
curl -X POST http://localhost:3333/api/v1/usuarios/5/modulos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modulos": [1, 3]}'
```

### 2. Obtener módulos de un usuario

```http
GET /api/v1/usuarios/:id/modulos
Authorization: Bearer {token}
```

**Descripción**: Retorna los módulos del usuario. Si tiene módulos personalizados, retorna esos; si no, retorna los del rol.

**Ejemplo**:
```bash
curl http://localhost:3333/api/v1/usuarios/5/modulos \
  -H "Authorization: Bearer TOKEN"
```

**Respuesta**:
```json
{
  "status": 200,
  "title": "Módulos del usuario",
  "messages": ["Módulos obtenidos exitosamente"],
  "data": {
    "modulos": [
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
}
```

### 3. Remover módulos específicos

```http
DELETE /api/v1/usuarios/:id/modulos
Authorization: Bearer {token}
Content-Type: application/json

{
  "modulos": [1, 2]
}
```

**Descripción**: Remueve módulos específicos del usuario.

### 4. Limpiar todos los módulos personalizados

```http
DELETE /api/v1/usuarios/:id/modulos/limpiar
Authorization: Bearer {token}
```

**Descripción**: Elimina todos los módulos personalizados del usuario. El usuario volverá a usar los módulos de su rol.

## 📊 Estructura de Base de Datos

### Tabla: tbl_usuarios_modulos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| usm_id | integer | ID autoincremental |
| usm_usuario_id | integer | FK a tbl_usuarios |
| usm_modulo_id | integer | FK a tbl_modulos |
| usm_estado | boolean | Estado del módulo |
| usm_creado | timestamp | Fecha de creación |
| usm_actualizado | timestamp | Fecha de actualización |

**Restricción**: Índice único en (usm_usuario_id, usm_modulo_id) para evitar duplicados.

## 🎯 Casos de Uso

### Caso 1: Usuario con módulos personalizados

```typescript
// Asignar solo "Usuarios" y "Mantenimiento" a un usuario con rol "Cliente"
POST /api/v1/usuarios/5/modulos
{
  "modulos": [1, 3]
}

// Ahora el usuario 5 solo verá esos módulos,
// independientemente de lo que tenga configurado su rol
```

### Caso 2: Usuario usando módulos del rol

```typescript
// Si no asignamos módulos personalizados,
// el usuario hereda los módulos de su rol
GET /api/v1/usuarios/5/modulos

// Retorna los módulos del rol "Cliente"
```

### Caso 3: Volver a usar módulos del rol

```typescript
// Limpiar módulos personalizados
DELETE /api/v1/usuarios/5/modulos/limpiar

// Ahora el usuario volverá a heredar los módulos de su rol
```

## 🔍 Ejemplo Práctico

### Escenario: Dos usuarios con el mismo rol, diferentes módulos

**Usuario A** (ID: 5, Rol: Cliente):
```bash
# Asignar acceso a Usuarios y Mantenimiento
POST /api/v1/usuarios/5/modulos
{
  "modulos": [1, 3]
}
```

**Usuario B** (ID: 6, Rol: Cliente):
```bash
# Asignar acceso solo a Usuarios
POST /api/v1/usuarios/6/modulos
{
  "modulos": [1]
}
```

**Usuario C** (ID: 7, Rol: Cliente):
```bash
# No asignar módulos personalizados
# Este usuario heredará TODOS los módulos del rol Cliente
```

## 💡 Notas Importantes

1. **Prioridad**: Los módulos personalizados siempre tienen prioridad sobre los módulos del rol
2. **Cascada**: Si se elimina un usuario, sus módulos personalizados se eliminan automáticamente (ON DELETE CASCADE)
3. **Validación**: Solo se pueden asignar módulos que existan y estén activos
4. **Permisos**: Todas las rutas requieren autenticación JWT

## 🧪 Pruebas

### Test 1: Asignar módulos
```bash
# Obtener token de autenticación
POST /api/v1/auth/login
{
  "usuario": "admin",
  "clave": "password"
}

# Asignar módulos
POST /api/v1/usuarios/5/modulos
Authorization: Bearer {token}
{
  "modulos": [1, 2]
}
```

### Test 2: Verificar asignación
```bash
GET /api/v1/usuarios/5/modulos
Authorization: Bearer {token}
```

### Test 3: Limpiar y verificar herencia del rol
```bash
# Limpiar
DELETE /api/v1/usuarios/5/modulos/limpiar
Authorization: Bearer {token}

# Verificar (debe retornar módulos del rol)
GET /api/v1/usuarios/5/modulos
Authorization: Bearer {token}
```

## 🎨 Integración Frontend

### Ejemplo en TypeScript/JavaScript

```typescript
// Servicio para gestionar módulos de usuario
class UsuarioModulosService {
  private apiUrl = 'http://localhost:3333/api/v1'
  
  async asignarModulos(usuarioId: number, modulosIds: number[]) {
    const response = await fetch(`${this.apiUrl}/usuarios/${usuarioId}/modulos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ modulos: modulosIds })
    })
    return response.json()
  }
  
  async obtenerModulos(usuarioId: number) {
    const response = await fetch(`${this.apiUrl}/usuarios/${usuarioId}/modulos`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      }
    })
    return response.json()
  }
  
  async limpiarModulos(usuarioId: number) {
    const response = await fetch(`${this.apiUrl}/usuarios/${usuarioId}/modulos/limpiar`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      }
    })
    return response.json()
  }
  
  private getToken(): string {
    // Implementar lógica para obtener el token
    return localStorage.getItem('token') || ''
  }
}
```

## 📝 TODO / Mejoras Futuras

- [ ] Agregar logs de auditoría para cambios en módulos
- [ ] Implementar bulk operations para múltiples usuarios
- [ ] Agregar caché para mejorar performance
- [ ] Crear panel administrativo para gestión visual
- [ ] Agregar notificaciones cuando cambien los módulos de un usuario

---

**Desarrollado para**: Sistema SICOV  
**Fecha**: Noviembre 2024  
**Versión**: 1.0.0
