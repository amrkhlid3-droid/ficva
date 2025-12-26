"use client"

import { Check, X } from "lucide-react"

interface PasswordStrengthProps {
  password?: string
}

export function PasswordStrength({ password = "" }: PasswordStrengthProps) {
  const rules = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "At least one uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "At least one lowercase letter", valid: /[a-z]/.test(password) },
    { label: "At least one number", valid: /[0-9]/.test(password) },
    {
      label: "At least one special character",
      valid: /[^A-Za-z0-9]/.test(password),
    },
  ]

  const allValid = rules.every((rule) => rule.valid)

  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between font-medium">
        <span>Password Strength</span>
        {allValid && (
          <span className="flex items-center gap-1 text-green-600">
            <Check className="h-4 w-4" />
            Strong
          </span>
        )}
      </div>
      <div className="space-y-1">
        {rules.map((rule, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 ${
              rule.valid ? "text-green-600" : "text-muted-foreground"
            }`}
          >
            {rule.valid ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            <span className={rule.valid ? "" : "opacity-70"}>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
