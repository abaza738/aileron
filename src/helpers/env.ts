import 'dotenv/config'

type Env = {
  NODE_ENV: 'development' | 'test' | 'production'
  PORT: string
  HOST?: string
}

function assertEnv(env: NodeJS.ProcessEnv): asserts env is Env {
  if (!env.NODE_ENV) env.NODE_ENV = 'development'
  if (!env.PORT) env.PORT = '3000'
  if (!['development', 'test', 'production'].includes(env.NODE_ENV)) {
    throw new Error(`Invalid NODE_ENV value: ${env.NODE_ENV}`)
  }
}

assertEnv(process.env)

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  HOST: process.env.HOST,
}
