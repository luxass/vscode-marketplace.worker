import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { RELEASE_SCHEMA } from '../../schemas'
import type { HonoContext } from '../../types'
import { $Octokit } from '../../utils'

export const latestReleaseRouter = new OpenAPIHono<HonoContext>()

const route = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: RELEASE_SCHEMA,
        },
      },
      description: 'Get the latest release',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'No release found',
    },
  },
})

latestReleaseRouter.openapi(route, async (ctx) => {
  const octokit = new $Octokit({
    auth: ctx.env.GITHUB_TOKEN,
  })

  const { data: releases } = await octokit.request('GET /repos/{owner}/{repo}/releases', {
    owner: 'microsoft',
    repo: 'vscode',
    per_page: 1,
  })

  const release = releases[0]
  if (!('tag_name' in release)) {
    return ctx.json({
      error: 'No release found',
    }, 404, {
      'Content-Type': 'application/json',
    })
  }

  return ctx.json({
    tag: release.tag_name,
    url: release.url,
  }, 200, {
    'Content-Type': 'application/json',
  })
})
