import { schema, rules } from "@ioc:Adonis/Core/Validator"

export const validarActualizarUsuario = schema.create({
    nombre: schema.string.optional({ trim: true }),
    apellido: schema.string.optional({ trim: true }),
    telefono: schema.string.optional({ trim: true }),
    correo: schema.string.optional({ trim: true }, )
}) 