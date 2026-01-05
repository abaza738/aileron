import 'dotenv/config'

type Env = {
  NODE_ENV: 'development' | 'test' | 'production'
  PORT: string
  NEO4J_URI: string
  NEO4J_USER: string
  NEO4J_PASSWORD: string
}

function assertEnv(env: NodeJS.ProcessEnv): asserts env is Env {
  if (!env.NODE_ENV) env.NODE_ENV = 'development'

  if (!env.PORT) env.PORT = '3000'

  if (!env.NEO4J_URI) throw new Error('Missing NEO4J_URI')
  if (!env.NEO4J_USER) throw new Error('Missing NEO4J_USER')
  if (!env.NEO4J_PASSWORD) throw new Error('Missing NEO4J_PASSWORD')
}

assertEnv(process.env)

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  NEO4J_URI: process.env.NEO4J_URI,
  NEO4J_USER: process.env.NEO4J_USER,
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
}
