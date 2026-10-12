import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

describe("GET /health", () => {
  it("responds with a minimal health payload", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("unknown route", () => {
  it("responds with a JSON 404", async () => {
    const response = await request(createApp()).get("/missing");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.body).toEqual({ error: "Not found" });
  });
});
