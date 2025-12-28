import { useState, useEffect } from "react"

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
  placeholder?: string
  min?: number
  max?: number
}

export function NumberInput({
  value,
  onChange,
  className,
  placeholder,
  min,
  max,
}: NumberInputProps) {
  // Local state to handle input value (string allows empty state)
  const [inputValue, setInputValue] = useState<string>(value.toString())

  // Sync with prop value when it changes externally (e.g. undo/redo, selection change)
  useEffect(() => {
    setInputValue(value.toString())
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleBlur = () => {
    if (inputValue === "" || inputValue === "-") {
      setInputValue(value.toString())
      return
    }

    const parsed = parseInt(inputValue)
    if (!isNaN(parsed)) {
      let constrained = parsed
      if (min !== undefined) constrained = Math.max(min, constrained)
      if (max !== undefined) constrained = Math.min(max, constrained)

      onChange(constrained)
      setInputValue(constrained.toString())
    } else {
      setInputValue(value.toString())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur()
    }
  }

  return (
    <input
      type="text"
      value={inputValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onFocus={(e) => e.target.select()}
      className={className}
      placeholder={placeholder}
    />
  )
}
