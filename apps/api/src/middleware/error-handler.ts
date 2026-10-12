import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  next,
) => {
  void request;

  if (response.headersSent) {
    next(error);
    return;
  }

  response.status(500).json({ error: "Internal server error" });
};
