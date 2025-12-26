import { describe, it, expect } from "vitest"
import { registerSchema, loginSchema, passwordSchema } from "@/lib/schemas"

describe("Validation Schemas / 验证模式", () => {
  describe("passwordSchema / 密码模式", () => {
    it("should accept a strong password / 应接受强密码", () => {
      const result = passwordSchema.safeParse("StrongP@ss1")
      expect(result.success).toBe(true)
    })

    it("should reject short passwords / 应拒绝短密码", () => {
      const result = passwordSchema.safeParse("Short1!")
      expect(result.success).toBe(false)
    })

    it("should reject passwords without uppercase / 应拒绝没有大写字母的密码", () => {
      const result = passwordSchema.safeParse("weakpass1!")
      expect(result.success).toBe(false)
    })

    it("should reject passwords without lowercase / 应拒绝没有小写字母的密码", () => {
      const result = passwordSchema.safeParse("WEAKPASS1!")
      expect(result.success).toBe(false)
    })

    it("should reject passwords without numbers / 应拒绝没有数字的密码", () => {
      const result = passwordSchema.safeParse("NoNumbers!")
      expect(result.success).toBe(false)
    })

    it("should reject passwords without special characters / 应拒绝没有特殊字符的密码", () => {
      const result = passwordSchema.safeParse("NoSpecialChar1")
      expect(result.success).toBe(false)
    })
  })

  describe("registerSchema / 注册模式", () => {
    it("should accept valid registration data / 应接受有效的注册数据", () => {
      const data = {
        name: "Test User",
        email: "test@example.com",
        password: "StrongP@ss1",
        confirmPassword: "StrongP@ss1",
      }
      const result = registerSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it("should reject mismatched passwords / 应拒绝不匹配的密码", () => {
      const data = {
        name: "Test User",
        email: "test@example.com",
        password: "StrongP@ss1",
        confirmPassword: "DifferentP@ss1",
      }
      const result = registerSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          "Passwords do not match"
        )
      }
    })

    it("should reject short names / 应拒绝过短的名字", () => {
      const data = {
        name: "A",
        email: "test@example.com",
        password: "StrongP@ss1",
        confirmPassword: "StrongP@ss1",
      }
      const result = registerSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it("should reject invalid emails in registration / 应拒绝注册时的无效电子邮件", () => {
      const data = {
        name: "Test User",
        email: "invalid-email",
        password: "StrongP@ss1",
        confirmPassword: "StrongP@ss1",
      }
      const result = registerSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe("loginSchema / 登录模式", () => {
    it("should accept valid login data / 应接受有效的登录数据", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "anypassword", // Login schema is relaxed for password content / 登录模式对密码内容放宽
      })
      expect(result.success).toBe(true)
    })

    it("should reject invalid emails / 应拒绝无效的电子邮件", () => {
      const result = loginSchema.safeParse({
        email: "invalid-email",
        password: "anypassword",
      })
      expect(result.success).toBe(false)
    })

    it("should reject empty passwords / 应拒绝空密码", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "",
      })
      expect(result.success).toBe(false)
    })
  })
})
