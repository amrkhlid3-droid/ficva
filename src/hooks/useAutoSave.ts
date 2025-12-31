import { useEffect, useState, useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"

export type SaveStatus = "saved" | "saving" | "error" | "unsaved"

export function useAutoSave() {
  const [status, setStatus] = useState<SaveStatus>("saved")
  const { pages, activePageId, projectId, projectName } = useEditorStore()

  // Refs
  const isLoadedRef = useRef(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Effect to handle saving
  useEffect(() => {
    if (pages.length > 0 && !isLoadedRef.current) {
      isLoadedRef.current = true
      // Set initial previous pages state to avoid immediate triggering on load if we wanted strictly diff-based
      // But for now, we rely on the fact that store updates trigger this effect.
    }
  }, [pages])

  useEffect(() => {
    if (!isLoadedRef.current || !projectId) return

    // 1. Immediate Local Save for redundancy (Every change)
    // We already do this for Structural changes in the Store action, but for Canvas changes (updatePage)
    // it happens here because updatePage is called frequently.
    // Actually, updatePage in store calls set({pages...}), so this effect runs.

    // We can't easily distinguish "Canvas Ops" vs "Structure Ops" just by the effect dependencies.
    // However, the rule is: Editor Ops (Canvas) -> Debounce. Structure Ops -> Immediate (handled by Store mostly?)
    // But Store updates state, and this effect runs.
    // If we want structure ops to be immediate here, we need to know.
    // Alternatively, we treat ALL updates here as "Potential Save".
    // AND we trust that critical store actions (add/remove page) MIGHT have triggered a parallel save?
    // No, better to centralize.

    // Let's implement the 0.2s Debounce here.
    // If it's a structural change (page count changed), maybe we want immediate?

    // Strategy:
    // Always save to LocalStorage immediately here (L1->L2).
    // Then queue L3 (Server).

    const saveDataToLocal = () => {
      import("@/utils/storage").then(({ saveToLocalStorage }) => {
        saveToLocalStorage(projectId, {
          pages,
          activePageId,
          projectName,
        })
      })
    }
    saveDataToLocal()

    setStatus("saving")

    const saveToServer = async () => {
      try {
        const coverPage = pages[0]
        const projectThumbnail = coverPage?.thumbnail || null
        const body = {
          json: { pages, activePageId },
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
          // TODO: Maybe clear unsaved flag in local storage?
          import("@/utils/storage").then(({ saveToLocalStorage }) => {
            saveToLocalStorage(
              projectId,
              { pages, activePageId, projectName },
              false
            )
          })
        } else {
          setStatus("error")
        }
      } catch (e) {
        console.error("Server save failed", e)
        setStatus("error")
      }
    }

    // Debounce Logic
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // 200ms debounce
    debounceTimerRef.current = setTimeout(() => {
      saveToServer()
    }, 200)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [pages, activePageId, projectName, projectId])

  return { status }
}
