import { describe, expect, it } from "vitest";

import { getHealthStatus } from "./health.service.js";

describe("health service", () => {
  it("returns the application health independently of Express", () => {
    expect(getHealthStatus()).toEqual({ status: "ok" });
  });
});
