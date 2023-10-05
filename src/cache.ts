// totally a copy of hono/cache, but support for disabling caching on different environments

import type { MiddlewareHandler } from "hono";

export function cache(options: {
  cacheName: string
  wait?: boolean
  cacheControl?: string
}): MiddlewareHandler {
  if (options.wait === undefined) {
    options.wait = false;
  }

  const addHeader = (response: Response) => {
    if (options.cacheControl) response.headers.set("Cache-Control", options.cacheControl);
  };

  return async (c, next) => {
    if (c.env.WORKER_ENV !== "production") {
      return await next();
    }
    const key = c.req.url;
    const cache = await caches.open(options.cacheName);

    const response = await cache.match(key);
    if (!response) {
      await next();
      if (!c.res.ok) {
        return;
      }
      addHeader(c.res);
      const response = c.res.clone();
      if (options.wait) {
        await cache.put(key, response);
      } else {
        c.executionCtx.waitUntil(cache.put(key, response));
      }
    } else {
      return new Response(response.body, response);
    }
  };
}
