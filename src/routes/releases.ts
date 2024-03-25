import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import semver from 'semver'
import type { HonoContext } from '../types'
import { RELEASE_SCHEMA } from '../schemas'

export const releasesRouter = new OpenAPIHono<HonoContext>()

const releasesRoute = createRoute({
  method: 'get',
  path: '/releases',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              releases: z.array(
                RELEASE_SCHEMA,
              ),
            }),
        },
      },
      description: 'Retrieve a list of all releases',
    },
  },
})

releasesRouter.openapi(releasesRoute, async (ctx) => {
  const octokit = ctx.get('octokit')

  const releases = await octokit.paginate('GET /repos/{owner}/{repo}/releases', {
    owner: 'microsoft',
    repo: 'vscode',
    per_page: 100,
  }).then((releases) => releases.filter((release) => semver.gte(release.tag_name, '1.45.0')))

  return ctx.json({
    releases: releases.map((release) => ({
      tag: release.tag_name,
      url: release.url,
    })),
  }, 200, {
    'Content-Type': 'application/json',
  })
})

const latestReleaseRoute = createRoute({
  method: 'get',
  path: '/releases/latest',
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

releasesRouter.openapi(latestReleaseRoute, async (ctx) => {
  const octokit = ctx.get('octokit')

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
