import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("Inventory Admin", () => {
  it("renders the administration application name", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Inventory Admin" }),
    ).toBeInTheDocument();
  });
});
