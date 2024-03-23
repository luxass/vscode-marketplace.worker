import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { HTTPException } from 'hono/http-exception'
import { apiReference } from '@scalar/hono-api-reference'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { cache } from './cache'
import type { HonoContext } from './types'
import {
  routes,
} from './routes'

const app = new OpenAPIHono<HonoContext>()

app.use('*', logger())
app.use(prettyJSON())
app.get(
  '*',
  cache({
    cacheName: 'vscode',
    cacheControl: 'max-age=3600',
  }),
)

app.route('/', routes)

app.get(
  '/scalar',
  apiReference({
    spec: {
      url: '/openapi.json',
    },
  }),
)

// The OpenAPI documentation will be available at /doc
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'My API',
  },
})

app.get('/view-source', (ctx) => {
  return ctx.redirect('https://github.com/luxass/vscode.worker')
})

app.onError(async (err, ctx) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }

  const message = ctx.env.ENVIRONMENT === 'production' ? 'Internal server error' : err.stack
  return new Response(message, {
    status: 500,
  })
})

app.notFound(async () => {
  return new Response('Not found', {
    status: 404,
  })
})

export default app
