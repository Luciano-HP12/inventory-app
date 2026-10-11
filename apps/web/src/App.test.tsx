import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("Inventory App", () => {
  it("renders the application name", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Inventory App" }),
    ).toBeInTheDocument();
  });
});
