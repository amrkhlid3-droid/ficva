import { describe, it, expect } from "vitest"
import {
  nodesToSvgPath,
  createEmptyNode,
  createMirroredNode,
} from "./pathUtils"
import type { CustomPathData } from "@/types/fabric"

describe("pathUtils", () => {
  describe("nodesToSvgPath", () => {
    it("should convert a triangle (3 nodes) to 5 SVG commands", () => {
      const triangle: CustomPathData = {
        nodes: [
          createEmptyNode(100, 100),
          createEmptyNode(200, 200),
          createEmptyNode(50, 200),
        ],
        closed: true,
      }

      const result = nodesToSvgPath(triangle)

      // 应该有5个命令：M, C, C, C, Z
      expect(result).toHaveLength(5)
      expect(result[0]![0]).toBe("M")
      expect(result[1]![0]).toBe("C")
      expect(result[2]![0]).toBe("C")
      expect(result[3]![0]).toBe("C")
      expect(result[4]![0]).toBe("Z")
    })

    it("should handle open path (no closing segment)", () => {
      const openPath: CustomPathData = {
        nodes: [createEmptyNode(0, 0), createEmptyNode(100, 100)],
        closed: false,
      }

      const result = nodesToSvgPath(openPath)

      // 应该有2个命令：M, C (no Z)
      expect(result).toHaveLength(2)
      expect(result[0]![0]).toBe("M")
      expect(result[1]![0]).toBe("C")
    })

    it("should correctly calculate control points for mirrored nodes", () => {
      const curvedPath: CustomPathData = {
        nodes: [
          createMirroredNode(0, 0, 20, 0), // horizontal handle
          createMirroredNode(100, 100, 20, Math.PI), // opposite direction
        ],
        closed: false,
      }

      const result = nodesToSvgPath(curvedPath)

      // M 0 0
      expect(result[0]).toEqual(["M", 0, 0])

      // C命令：CP1(0+20, 0+0), CP2(100+20, 100+0), End(100, 100)
      // Node 0: handleOut = (20, 0)
      // Node 1: handleIn = (20, 0)  [因为angle=π, handleIn = -(-20,0) = (20,0)]
      const cCmd = result[1]!
      expect(cCmd[0]).toBe("C")
      expect(cCmd[1]).toBeCloseTo(20) // CP1x = 0 + 20
      expect(cCmd[2]).toBeCloseTo(0) // CP1y = 0 + 0
      expect(cCmd[3]).toBeCloseTo(120) // CP2x = 100 + 20
      expect(cCmd[4]).toBeCloseTo(100) // CP2y = 100 + 0
      expect(cCmd[5]).toBe(100) // Endx
      expect(cCmd[6]).toBe(100) // Endy
    })
  })
})
