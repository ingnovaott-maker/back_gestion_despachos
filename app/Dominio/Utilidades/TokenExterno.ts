export class TokenExterno {
  private static _token: string | null = null
  private static _expiraEn: number | null = null

  // Guarda el token y (opcionalmente) un timestamp de expiración en epoch seconds
  public static set(token: string, expiraEn?: number) {
    this._token = token
    this._expiraEn = typeof expiraEn === 'number' ? expiraEn : null
  }

  public static get(): string | null {
    return this._token
  }

  public static isVigente(): boolean {
    if (!this._token) return false
    if (!this._expiraEn) return true
    const ahora = Math.floor(Date.now() / 1000)
    return ahora < this._expiraEn
  }

  public static clear() {
    this._token = null
    this._expiraEn = null
  }
}
