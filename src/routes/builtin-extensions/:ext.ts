import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { HonoContext, Repository } from '../../types'
import { $Octokit, BUILTIN_QUERY, base64ToRawText, translate } from '../../utils'
import { BUILTIN_EXTENSION_SCHEMA } from '../../schemas'

export const builtinExtensionRouter = new OpenAPIHono<HonoContext>()

const route = createRoute({
  method: 'get',
  path: '/{ext}',
  request: {
    params: z.object({
      ext: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              extensions: z.array(
                BUILTIN_EXTENSION_SCHEMA,
              ),
            }),
        },
      },
      description: 'Retrieve a list of all releases',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'No builtin extensions found',
    },
  },
})

builtinExtensionRouter.openapi(route, async (ctx) => {
  const octokit = new $Octokit({
    auth: ctx.env.GITHUB_TOKEN,
  })

  const extName = ctx.req.param('ext')
  if (!extName) {
    return ctx.json({
      error: 'No extension name provided',
    }, 400, {
      'Content-Type': 'application/json',
    })
  }

  const {
    repository: {
      object: files,
    },
  } = await octokit.graphql<{
    repository: Repository
  }>(BUILTIN_QUERY, {
    path: `HEAD:extensions/${extName}`,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!files) {
    return ctx.json({
      error: `No builtin extension found for ${extName}`,
    }, 404, {
      'Content-Type': 'application/json',
    })
  }

  const pkgEntry = files.entries.find((entry) => entry.name === 'package.json')
  if (!pkgEntry) {
    return ctx.json({
      error: `No builtin extension found for ${extName}`,
    }, 404, {
      'Content-Type': 'application/json',
    })
  }

  const { data: pkgJSONData } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
    owner: 'microsoft',
    repo: 'vscode',
    path: pkgEntry.path,
  })

  if (Array.isArray(pkgJSONData)) {
    return ctx.json({
      error: `No builtin extension found for ${extName}`,
    }, 404, {
      'Content-Type': 'application/json',
    })
  }

  if (pkgJSONData.type !== 'file') {
    return ctx.json({
      error: `No builtin extension found for ${extName}`,
    }, 404, {
      'Content-Type': 'application/json',
    })
  }

  const pkgJSON = JSON.parse(base64ToRawText(pkgJSONData.content))

  let result = pkgJSON
  const pkgNLSEntry = files.entries.find((entry) => entry.name === 'package.nls.json')

  if (pkgNLSEntry) {
    const { data: pkgNLSJSONData } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: 'microsoft',
      repo: 'vscode',
      path: pkgNLSEntry.path,
    })

    if (Array.isArray(pkgNLSJSONData)) {
      return ctx.json({
        error: `No builtin extension found for ${extName}`,
      }, 404, {
        'Content-Type': 'application/json',
      })
    }

    if (pkgNLSJSONData.type !== 'file') {
      return ctx.json({
        error: `No builtin extension found for ${extName}`,
      }, 404, {
        'Content-Type': 'application/json',
      })
    }
    const pkgNLSJSON = JSON.parse(base64ToRawText(pkgNLSJSONData.content))

    result = translate(pkgJSON, pkgNLSJSON)
  }

  return ctx.json(result)
})
