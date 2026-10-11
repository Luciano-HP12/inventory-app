import { describe, expect, it } from "vitest";

import { parseWorkerConfig } from "./environment.js";

describe("worker environment configuration", () => {
  it("accepts a valid NODE_ENV", () => {
    expect(parseWorkerConfig({ NODE_ENV: "test" })).toEqual({
      nodeEnv: "test",
    });
  });

  it("rejects an invalid NODE_ENV without exposing its value", () => {
    const invalidValue = "private-environment-name";

    expect(() => parseWorkerConfig({ NODE_ENV: invalidValue })).toThrow(
      "Invalid worker environment configuration. Check: NODE_ENV.",
    );

    try {
      parseWorkerConfig({ NODE_ENV: invalidValue });
    } catch (error) {
      expect(String(error)).not.toContain(invalidValue);
    }
  });
});
