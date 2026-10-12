import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "./error-handler.js";

describe("error handler", () => {
  it("returns a safe JSON response for an unexpected internal error", async () => {
    const internalDetail = "sensitive internal detail";
    const app = express();

    app.get("/failure", () => {
      throw new Error(internalDetail);
    });
    app.use(errorHandler);

    const response = await request(app).get("/failure");

    expect(response.status).toBe(500);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.body).toEqual({ error: "Internal server error" });
    expect(response.text).not.toContain(internalDetail);
    expect(response.text).not.toContain("Error:");
  });
});
