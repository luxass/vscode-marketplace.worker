import { Hono } from 'hono'
import type { HonoContext } from '../../types'
import { $Octokit } from '../../utils'

export const latestReleaseRouter = new Hono<HonoContext>()

latestReleaseRouter.get('/', async (ctx) => {
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
    return new Response('Not found', { status: 404 })
  }

  return ctx.json({
    tag: release.tag_name,
  }, 200, {
    'Content-Type': 'application/json',
  })
})
