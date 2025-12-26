// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react"
import { PasswordInput } from "./password-input"
import { describe, it, expect } from "vitest"

describe("PasswordInput", () => {
  it("should render with type password by default", () => {
    render(<PasswordInput placeholder="Enter password" />)
    const input = screen.getByPlaceholderText("Enter password")
    expect(input).toHaveAttribute("type", "password")
  })

  it("should toggle password visibility", () => {
    render(<PasswordInput placeholder="Enter password" />)
    const input = screen.getByPlaceholderText("Enter password")
    const toggleButton = screen.getByRole("button", { name: /show password/i })

    // Initially password hidden
    expect(input).toHaveAttribute("type", "password")

    // Click to show
    fireEvent.click(toggleButton)
    expect(input).toHaveAttribute("type", "text")
    expect(
      screen.getByRole("button", { name: /hide password/i })
    ).toBeInTheDocument()

    // Click to hide
    fireEvent.click(toggleButton)
    expect(input).toHaveAttribute("type", "password")
    expect(
      screen.getByRole("button", { name: /show password/i })
    ).toBeInTheDocument()
  })
})
