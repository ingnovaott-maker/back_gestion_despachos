/**
 * Configuración de Headers HTTP de Seguridad
 *
 * ⚠️ NOTA: Los headers de seguridad se inyectan automáticamente mediante
 * el middleware HeadersSeguridad (app/Middlewares/HeadersSeguridad.ts)
 *
 * Esto incluye:
 * - X-Frame-Options: DENY (previene Clickjacking)
 * - X-Content-Type-Options: nosniff
 * - Content-Security-Policy (CSP) estricto
 * - Strict-Transport-Security (HSTS) - 1 año
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: desactiva APIs sensibles
 * - X-XSS-Protection para navegadores antiguos
 *
 * Para modificar estos headers, edita: app/Middlewares/HeadersSeguridad.ts
 */

export default {}

