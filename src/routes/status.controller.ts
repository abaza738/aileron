import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'

export const statusController: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/', () => {
    return { status: 'ok' }
  })
}
