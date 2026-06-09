import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class HeadersSeguridad {
  public async handle({ response }: HttpContextContract, next: () => Promise<void>) {
    /**
     * X-Frame-Options: DENY
     * Previene Clickjacking bloqueando la carga en iframes
     */
    response.header('X-Frame-Options', 'DENY')

    /**
     * X-Content-Type-Options: nosniff
     * Previene que el navegador intente inferir el tipo de contenido
     */
    response.header('X-Content-Type-Options', 'nosniff')

    /**
     * X-XSS-Protection: 1; mode=block
     * Habilita protección contra XSS en navegadores antiguos
     */
    response.header('X-XSS-Protection', '1; mode=block')

    /**
     * Strict-Transport-Security (HSTS)
     * Fuerza HTTPS por 1 año (31536000 segundos)
     * includeSubDomains y preload para máxima seguridad
     */
    response.header(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )

    /**
     * Content-Security-Policy (CSP)
     * Política de seguridad estricta para prevenir inyecciones
     */
    response.header(
      'Content-Security-Policy',
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self'; " +
        "connect-src 'self'; " +
        "frame-src 'none'; " +
        "object-src 'none'; " +
        "media-src 'self'; " +
        "child-src 'none'"
    )

    /**
     * Referrer-Policy
     * Controla qué información de referencia se comparte
     */
    response.header('Referrer-Policy', 'strict-origin-when-cross-origin')

    /**
     * Permissions-Policy (Feature-Policy)
     * Desactiva APIs sensibles del navegador
     */
    response.header(
      'Permissions-Policy',
      'geolocation=(), ' +
        'microphone=(), ' +
        'camera=(), ' +
        'magnetometer=(), ' +
        'gyroscope=(), ' +
        'accelerometer=(), ' +
        'payment=(), ' +
        'usb=(), ' +
        'vr=()'
    )

    await next()
  }
}
