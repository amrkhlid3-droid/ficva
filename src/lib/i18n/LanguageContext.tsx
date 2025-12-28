"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import en from "./dictionaries/en.json"
import zh from "./dictionaries/zh.json"

type Dictionary = typeof en
type Language = "en" | "zh"

const dictionaries: Record<Language, Dictionary> = {
  en,
  zh,
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default to browser language or English
  const [language, setLanguage] = useState<Language>("en")

  useEffect(() => {
    const saved = localStorage.getItem("ficva-lang") as Language
    if (saved && (saved === "en" || saved === "zh")) {
      // eslint-disable-next-line
      setLanguage(saved)
    } else {
      const browserLang = navigator.language.startsWith("zh") ? "zh" : "en"

      setLanguage(browserLang)
    }
  }, [])

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem("ficva-lang", lang)
  }

  // Nested key access helper (e.g. "editor.header.export")
  const t = (path: string): string => {
    const keys = path.split(".")
    let current: unknown = dictionaries[language]

    for (const key of keys) {
      if (
        typeof current !== "object" ||
        current === null ||
        (current as Record<string, unknown>)[key] === undefined
      ) {
        console.warn(`Translation missing for key: ${path}`)
        return path
      }
      current = (current as Record<string, unknown>)[key]
    }
    return current as string
  }

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage: handleSetLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useTranslation must be used within a LanguageProvider")
  }
  return context
}
