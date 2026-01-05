import Fastify from 'fastify'
import cors from '@fastify/cors'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { env } from './helpers/env.js'
import neo4j from './plugins/neo4j.js'
import { statusController } from './routes/status.controller.js'
import { flightsController } from './routes/flights.controller.js'

const fastify = Fastify({
  logger: true,
}).withTypeProvider<TypeBoxTypeProvider>()

fastify.decorate('env', env)
fastify.register(cors, {
  origin: (origin, cb) => {
    if (env.NODE_ENV === 'development') {
      cb(null, true)
      return
    }

    if (origin !== 'flyazureva.com') {
      cb(new Error('Not allowed'), false)
      return
    }

    cb(null, true)
  },
})

fastify.register(neo4j, {
  uri: env.NEO4J_URI,
  user: env.NEO4J_USER,
  password: env.NEO4J_PASSWORD,
})

fastify.register(statusController, { prefix: '/status' })
fastify.register(flightsController, { prefix: '/flights' })

fastify.listen({ host: '0.0.0.0', port: 3000 }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})
