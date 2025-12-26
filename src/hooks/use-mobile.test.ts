import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useIsMobile } from "./use-mobile"

describe("useIsMobile", () => {
  const MOBILE_BREAKPOINT = 768
  let changeHandler: ((event: MediaQueryListEvent) => void) | null = null

  beforeEach(() => {
    changeHandler = null

    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: vi.fn((_event, handler) => {
          changeHandler = handler
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    // Default mock for innerWidth (desktop)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1024,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should return false when width is greater than breakpoint", () => {
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it("should return true when width is less than breakpoint at mount", () => {
    // Simulate mobile width before mount
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 500,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it("should update when media query changes", () => {
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    // Simulate change to mobile
    act(() => {
      // Update innerWidth so the callback logic works
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: 480,
      })

      // Trigger the media query change event
      if (changeHandler) {
        changeHandler({
          matches: true,
          media: `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
        } as MediaQueryListEvent)
      }
    })

    expect(result.current).toBe(true)

    // Simulate change back to desktop
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: 1024,
      })

      if (changeHandler) {
        changeHandler({
          matches: false,
          media: `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
        } as MediaQueryListEvent)
      }
    })

    expect(result.current).toBe(false)
  })
})
