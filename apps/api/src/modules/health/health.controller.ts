import type { RequestHandler } from "express";

import { getHealthStatus } from "./health.service.js";

export const getHealth: RequestHandler = (_request, response) => {
  response.status(200).json(getHealthStatus());
};
