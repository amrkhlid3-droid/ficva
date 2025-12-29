import { useEffect, useState, useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"

export type SaveStatus = "saved" | "saving" | "error" | "unsaved"

export function useAutoSave() {
  const [status, setStatus] = useState<SaveStatus>("saved")
  const { pages, activePageId, projectId, projectName } = useEditorStore()

  // Ref to track if the initial load has happened to avoid saving empty state immediately
  const isLoadedRef = useRef(false)

  // We want to debounce the actual save call
  // Since `pages` acts as our source of truth (synced by FabricCanvas), we watch it.

  useEffect(() => {
    if (pages.length > 0) {
      isLoadedRef.current = true
    }
  }, [pages])

  useEffect(() => {
    if (!isLoadedRef.current || !projectId) return

    // Mark as unsaved/saving when changes occur
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("saving")

    const saveProject = async () => {
      if (!projectId) return

      try {
        const coverPage = pages[0]
        const projectThumbnail = coverPage?.thumbnail || null

        const projectData = {
          pages,
          activePageId,
        }

        const body = {
          json: projectData,
          name: projectName,
          thumbnailUrl: projectThumbnail,
          updatedAt: new Date(),
        }

        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (res.ok) {
          setStatus("saved")
        } else {
          setStatus("error")
          console.error("Auto-save failed")
        }
      } catch (error) {
        console.error("Auto-save error", error)
        setStatus("error")
      }
    }

    const timer = setTimeout(async () => {
      await saveProject()
    }, 2000) // 2 second debounce

    return () => clearTimeout(timer)
  }, [pages, projectName, projectId, activePageId])

  return { status }
}
