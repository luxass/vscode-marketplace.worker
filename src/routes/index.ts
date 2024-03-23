import { OpenAPIHono } from '@hono/zod-openapi'
import type { HonoContext } from '../types'
import {
  releasesRouter,
} from './releases'

import {
  builtinExtensionsRouter,
} from './builtin-extensions'

export const routes = new OpenAPIHono<HonoContext>()

routes.route('/', releasesRouter)
routes.route('/', builtinExtensionsRouter)
