import { Hono } from "hono";
import type { HonoContext } from "../types";
import {
  releasesRouter,
} from "./releases";

import {
  builtinExtensionsRouter,
} from "./builtin-extensions";

export const routes = new Hono<HonoContext>();

routes.route("/", releasesRouter);
routes.route("/", builtinExtensionsRouter);
