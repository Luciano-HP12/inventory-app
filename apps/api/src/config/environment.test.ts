import { describe, expect, it } from "vitest";

import { parseApiConfig } from "./environment.js";

describe("API environment configuration", () => {
  it("accepts a valid configuration and uses the default port", () => {
    expect(parseApiConfig({ NODE_ENV: "development" })).toEqual({
      nodeEnv: "development",
      port: 3000,
    });
  });

  it("converts a custom port to a number", () => {
    expect(parseApiConfig({ NODE_ENV: "production", PORT: "8080" })).toEqual({
      nodeEnv: "production",
      port: 8080,
    });
  });

  it.each(["0", "65536", "3.5", "invalid"])(
    "rejects the invalid port %s",
    (port) => {
      expect(() => parseApiConfig({ NODE_ENV: "test", PORT: port })).toThrow(
        "Invalid API environment configuration. Check: PORT.",
      );
    },
  );

  it("rejects an invalid NODE_ENV without exposing its value", () => {
    const invalidValue = "secret-production-name";

    expect(() => parseApiConfig({ NODE_ENV: invalidValue })).toThrow(
      "Invalid API environment configuration. Check: NODE_ENV.",
    );

    try {
      parseApiConfig({ NODE_ENV: invalidValue });
    } catch (error) {
      expect(String(error)).not.toContain(invalidValue);
    }
  });
});
