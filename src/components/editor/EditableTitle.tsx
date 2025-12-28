"use client"

import { useState, useEffect, useRef } from "react"

interface EditableTitleProps {
  initialValue: string
  onSave: (newValue: string) => void
  className?: string
}

export function EditableTitle({
  initialValue,
  onSave,
  className,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = () => {
    if (value.trim() && value !== initialValue) {
      onSave(value)
    } else {
      setValue(initialValue) // Revert if empty or unchanged
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave()
    } else if (e.key === "Escape") {
      setValue(initialValue)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-8 min-w-[200px] rounded border border-blue-500 bg-zinc-900 px-2 text-sm text-white outline-none"
      />
    )
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer rounded px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white ${className}`}
      title="Click to rename"
    >
      {value || "Untitled Design"}
    </span>
  )
}
