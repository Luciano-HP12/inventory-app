import { describe, expect, it } from "vitest";

import { APPLICATION_NAME } from "./index.js";

describe("shared package", () => {
  it("exports the neutral application name", () => {
    expect(APPLICATION_NAME).toBe("Inventory App");
  });
});
