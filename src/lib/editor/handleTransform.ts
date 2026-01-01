/**
 * 控制点显示映射转换工具
 *
 * 用于将实际存储的手柄偏移转换为显示偏移，以及反向转换。
 * 这样可以让短手柄（接近零长度）也能在屏幕上显示出来，便于交互。
 *
 * 公式：
 * - 正向：displayLength = actualLength / 2 + 20
 * - 反向：actualLength = max(0, (displayLength - 20) × 2)
 */

interface Point2D {
  x: number
  y: number
}

/**
 * 正向转换：将实际手柄偏移转换为显示偏移
 * displayLength = actualLength / 2 + 20
 *
 * 由于 displayToActual 保证最小实际长度为 0.001，方向信息永远不会丢失
 * 所以 actualLength = 0.001 时，displayLength = 20.0005（约 20px）
 *
 * @param handleOffset 实际存储的手柄偏移（相对于锚点）
 * @returns 显示用的手柄偏移
 */
export function actualToDisplay(handleOffset: Point2D): Point2D {
  const actualLength = Math.sqrt(handleOffset.x ** 2 + handleOffset.y ** 2)

  if (actualLength < 0.0001) {
    // 真正的零长度（只有非 mirrored 模式或初始数据才可能出现）
    return { x: 0, y: 0 }
  }

  const displayLength = actualLength / 2 + 20
  const scale = displayLength / actualLength

  return {
    x: handleOffset.x * scale,
    y: handleOffset.y * scale,
  }
}

/**
 * 反向转换：将显示偏移转换为实际手柄偏移
 * actualLength = max(0.001, (displayLength - 20) × 2)
 *
 * 当 displayLength <= 20 时，返回一个极小值 0.001 保持方向信息
 * 这样在 mirrored 模式下方向永远不会丢失
 *
 * @param displayOffset 显示用的手柄偏移（相对于锚点）
 * @returns 实际存储的手柄偏移
 */
export function displayToActual(displayOffset: Point2D): Point2D {
  const displayLength = Math.sqrt(displayOffset.x ** 2 + displayOffset.y ** 2)

  if (displayLength < 0.001) {
    return { x: 0, y: 0 }
  }

  // 计算实际长度，但最小保持 0.001 以保留方向信息
  const rawActualLength = (displayLength - 20) * 2
  const actualLength = Math.max(0.001, rawActualLength)

  const scale = actualLength / displayLength

  return {
    x: displayOffset.x * scale,
    y: displayOffset.y * scale,
  }
}

/**
 * 限制显示偏移的最小长度为 20px
 * 用于拖拽时防止控制点消失
 *
 * @param displayOffset 显示用的手柄偏移
 * @returns 限制后的显示偏移（最小 20px）
 */
/**
 * 检查手柄是否有实际长度
 * 用于决定是否显示控制点
 *
 * @param handleOffset 实际存储的手柄偏移
 * @returns 是否有长度（长度 > 0.001）
 */
export function hasHandleLength(handleOffset: Point2D): boolean {
  const length = Math.sqrt(handleOffset.x ** 2 + handleOffset.y ** 2)
  return length > 0.001
}

export function clampDisplayOffset(displayOffset: Point2D): Point2D {
  const displayLength = Math.sqrt(displayOffset.x ** 2 + displayOffset.y ** 2)

  if (displayLength < 0.001) {
    return { x: 0, y: 0 }
  }

  // 如果长度小于 20，将其限制在 20
  if (displayLength < 20) {
    const scale = 20 / displayLength
    return {
      x: displayOffset.x * scale,
      y: displayOffset.y * scale,
    }
  }

  return displayOffset
}
