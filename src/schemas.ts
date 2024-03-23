import { z } from '@hono/zod-openapi'

export const RELEASE_SCHEMA = z.object({
  tag: z.string(),
  url: z.string(),
}).openapi('Release')

export const BUILTIN_EXTENSION_SCHEMA = z.object({
  name: z.string(),
})
