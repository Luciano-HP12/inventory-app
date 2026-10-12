import express from "express";

import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { healthRouter } from "./modules/health/health.route.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use(healthRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
