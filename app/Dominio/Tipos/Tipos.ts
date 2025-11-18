import { Paginador } from "../Paginador";

export type Paginable<T> = { paginacion: Paginador, datos: T[]; }
export type TipoOrdenamiento = 'asc' | 'desc'
export interface Diccionario {
    [key: string]: string;
  }