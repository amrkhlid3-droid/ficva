import { describe, it, expect, vi, beforeEach } from "vitest"
import { AddObjectCommand } from "./AddObjectCommand"
import { ModifyObjectCommand } from "./ModifyObjectCommand"
import { Canvas, FabricObject } from "fabric"

describe("Commands", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCanvas: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockObject: any

  beforeEach(() => {
    mockCanvas = {
      add: vi.fn(),
      remove: vi.fn(),
      setActiveObject: vi.fn(),
      discardActiveObject: vi.fn(),
      requestRenderAll: vi.fn(),
      fire: vi.fn(),
    }

    mockObject = {
      set: vi.fn(),
      setCoords: vi.fn(),
      canvas: mockCanvas,
    }
  })

  describe("AddObjectCommand", () => {
    it("should add object on execute", () => {
      const command = new AddObjectCommand(
        mockCanvas as Canvas,
        mockObject as FabricObject
      )
      command.execute()

      expect(mockCanvas.add).toHaveBeenCalledWith(mockObject)
      expect(mockCanvas.setActiveObject).toHaveBeenCalledWith(mockObject)
      expect(mockCanvas.requestRenderAll).toHaveBeenCalled()
    })

    it("should remove object on undo", () => {
      const command = new AddObjectCommand(
        mockCanvas as Canvas,
        mockObject as FabricObject
      )
      command.undo()

      expect(mockCanvas.remove).toHaveBeenCalledWith(mockObject)
      expect(mockCanvas.discardActiveObject).toHaveBeenCalled()
      expect(mockCanvas.requestRenderAll).toHaveBeenCalled()
    })
  })

  describe("ModifyObjectCommand", () => {
    it("should apply new properties on execute", () => {
      const newProps = { fill: "red" }
      const originalProps = { fill: "blue" }
      const command = new ModifyObjectCommand(
        mockObject as FabricObject,
        newProps,
        originalProps
      )

      command.execute()

      expect(mockObject.set).toHaveBeenCalledWith(newProps)
      expect(mockObject.setCoords).toHaveBeenCalled()
      expect(mockCanvas.requestRenderAll).toHaveBeenCalled()
      expect(mockCanvas.fire).toHaveBeenCalledWith("object:modified", {
        target: mockObject,
      })
    })

    it("should revert to original properties on undo", () => {
      const newProps = { fill: "red" }
      const originalProps = { fill: "blue" }
      const command = new ModifyObjectCommand(
        mockObject as FabricObject,
        newProps,
        originalProps
      )

      command.undo()

      expect(mockObject.set).toHaveBeenCalledWith(originalProps)
      expect(mockObject.setCoords).toHaveBeenCalled()
      expect(mockCanvas.requestRenderAll).toHaveBeenCalled()
      expect(mockCanvas.fire).toHaveBeenCalledWith("object:modified", {
        target: mockObject,
      })
    })
  })
})
