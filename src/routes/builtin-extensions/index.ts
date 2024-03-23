import { Hono } from 'hono'
import type { HonoContext, Repository } from '../../types'
import { $Octokit, BUILTIN_QUERY } from '../../utils'
import {
  builtinExtensionRouter,
} from './:ext'

export const builtinExtensionsRouter = new Hono<HonoContext>().basePath('/builtin-extensions')

builtinExtensionsRouter.route('/', builtinExtensionRouter)

builtinExtensionsRouter.get('/', async (ctx) => {
  const octokit = new $Octokit({
    auth: ctx.env.GITHUB_TOKEN,
  })

  const {
    repository: {
      object: files,
    },
  } = await octokit.graphql<{
    repository: Repository
  }>(BUILTIN_QUERY, {
    path: 'HEAD:extensions',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!files.entries) {
    return new Response('Not found', { status: 404 })
  }

  return ctx.json({
    extensions: files.entries.filter((entry) => entry.type === 'tree').filter((entry) => {
      const { entries } = entry.object
      if (!entries) {
        return false
      }

      return entries.some((entry) => entry.name === 'package.json' && entry.type === 'blob')
    }).map((entry) => entry.name),
  })
})
