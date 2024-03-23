import semver from 'semver'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { HonoContext } from '../../types'
import { $Octokit } from '../../utils'
import { RELEASE_SCHEMA } from '../../schemas'
import {
  latestReleaseRouter,
} from './latest'

export const releasesRouter = new OpenAPIHono<HonoContext>()

const route = createRoute({
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

releasesRouter.openapi(route, async (ctx) => {
  const octokit = new $Octokit({
    auth: ctx.env.GITHUB_TOKEN,
  })

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

releasesRouter.route('/releases/latest', latestReleaseRouter)
