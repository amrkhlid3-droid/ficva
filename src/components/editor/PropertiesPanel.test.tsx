import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import PropertiesPanel from "./PropertiesPanel"
import { useEditorStore } from "@/store/useEditorStore"

// Mock the store
vi.mock("@/store/useEditorStore")

describe("PropertiesPanel", () => {
  const mockHistory = {
    execute: vi.fn(),
    push: vi.fn(),
  }

  const mockCanvas = {
    requestRenderAll: vi.fn(),
    bringObjectToFront: vi.fn(),
    sendObjectToBack: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders placeholder when no object is selected", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useEditorStore as any).mockReturnValue({
      selectedObjects: [],
      canvas: mockCanvas,
      history: mockHistory,
    })

    render(<PropertiesPanel />)
    expect(screen.getByText("Select an object to edit")).toBeInTheDocument()
  })

  it("renders typography controls when IText is selected", () => {
    const mockTextObject = {
      type: "i-text",
      get: vi.fn((key) => {
        if (key === "fontSize") return 20
        return null
      }),
      set: vi.fn(),
      scaleY: 1,
      fontSize: 20,
      fontFamily: "Arial",
      fontWeight: "normal",
      fontStyle: "normal",
      fill: "#000000",
      opacity: 1,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useEditorStore as any).mockReturnValue({
      selectedObjects: [mockTextObject],
      canvas: mockCanvas,
      history: mockHistory,
    })

    render(<PropertiesPanel />)
    expect(screen.getByText("Typography")).toBeInTheDocument()
    expect(screen.getByText("Arial")).toBeInTheDocument()
  })

  it("updates property using history on change", () => {
    const mockRectObject = {
      type: "rect",
      get: vi.fn(),
      set: vi.fn(),
      fill: "#ffffff",
      opacity: 1,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(useEditorStore as any).mockReturnValue({
      selectedObjects: [mockRectObject],
      canvas: mockCanvas,
      history: mockHistory,
    })

    render(<PropertiesPanel />)

    // Simulate color change
    const colorBtn = screen.getByTitle("#ff0000")
    fireEvent.click(colorBtn)

    expect(mockHistory.execute).toHaveBeenCalled()
  })
})
