import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from "express";

const healthHandler: RequestHandler = (_request, response) => {
  response.status(200).json({ status: "ok" });
};

const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: "Not found" });
};

const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  void error;
  void request;
  void next;
  response.status(500).json({ error: "Internal server error" });
};

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.get("/health", healthHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
