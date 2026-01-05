import fp from 'fastify-plugin'
import neo4j, { Driver } from 'neo4j-driver'
import { FastifyInstance } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    neo4j: Driver
  }
}

interface Neo4jPluginOptions {
  uri: string
  user: string
  password: string
}

export default fp<Neo4jPluginOptions>(async (fastify: FastifyInstance, opts) => {
  const driver = neo4j.driver(opts.uri, neo4j.auth.basic(opts.user, opts.password))

  try {
    await driver.verifyConnectivity()
    fastify.log.info('neo4j connection success')
  } catch (e) {
    fastify.log.fatal(`error in neo4j connection: ${e}`)
  }

  fastify.decorate('neo4j', driver)

  fastify.addHook('onClose', async () => {
    await driver.close()
  })
})
