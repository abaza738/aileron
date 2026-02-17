import Fastify from 'fastify'
import cors from '@fastify/cors'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { env } from './helpers/env.js'
import neo4j from './plugins/neo4j.js'
import { statusController } from './routes/status.controller.js'
import { flightsController } from './routes/flights.controller.js'

const isDev = env.NODE_ENV === 'development'
const fastify = Fastify({
  logger: isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      }
    : true,
}).withTypeProvider<TypeBoxTypeProvider>()

fastify.decorate('env', env)
fastify.register(cors, {
  origin: (origin, cb) => {
    if (env.NODE_ENV === 'development') {
      cb(null, true)
      return
    }

    if (!origin) {
      cb(null, true)
      return
    }

    try {
      const hostname = new URL(origin).hostname
      if (hostname.endsWith('flyazureva.com')) {
        cb(null, true)
        return
      }
    } catch {
      // Invalid origin URL
    }

    cb(new Error('Not allowed'), false)
  },
})

fastify.register(neo4j, {
  uri: env.NEO4J_URI,
  user: env.NEO4J_USER,
  password: env.NEO4J_PASSWORD,
})

fastify.addHook('onRequest', async (request, _reply) => {
  request.log.info({ method: request.method, url: request.url }, 'incoming request')
})

fastify.addHook('onResponse', async (request, reply) => {
  request.log.info(
    { method: request.method, url: request.url, statusCode: reply.statusCode },
    'request completed',
  )
})

fastify.register(
  async (app) => {
    app.register(statusController, { prefix: '/status' })
    app.register(flightsController, { prefix: '/flights' })
  },
  { prefix: '/v1' },
)

fastify.setErrorHandler((err: unknown, request, reply) => {
  const e = err as { statusCode?: number; validation?: unknown; message?: string; stack?: string }
  const statusCode =
    e.statusCode ?? (e.validation ? 400 : isNeo4jError(err) ? 503 : 500)
  const error =
    statusCode === 400 ? 'Bad Request' : statusCode === 503 ? 'Service Unavailable' : 'Internal Server Error'
  const message = e.message ?? 'An error occurred'

  request.log.error(
    { err, statusCode, url: request.url, method: request.method },
    message,
  )
  if (statusCode === 500 && e.stack) {
    request.log.error(e.stack)
  }

  void reply.status(statusCode).send({
    error,
    message: statusCode === 500 ? 'An error occurred' : message,
  })
})

function isNeo4jError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const code = (err as { code?: string }).code
    return typeof code === 'string' && (code.startsWith('Neo.') || code === 'ServiceUnavailable')
  }
  return false
}

async function start() {
  try {
    await fastify.listen({ host: '0.0.0.0', port: Number(env.PORT) })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

async function shutdown(signal: NodeJS.Signals) {
  fastify.log.info({ signal }, 'shutting down server')
  try {
    await fastify.close()
    process.exit(0)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})
