import { useEffect } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Listens to Tauri backend events and invalidates TanStack Query cache.
 * Mount once at the top of the Library route.
 *
 * Cleanup is collected eagerly so individual listen() failures don't
 * prevent other listeners from being removed.
 */
export function useReactiveCache() {
  const qc = useQueryClient()

  useEffect(() => {
    const unlistens: UnlistenFn[] = []

    const invalidateFiles = () => {
      qc.invalidateQueries({ queryKey: ['files'] })
      qc.invalidateQueries({ queryKey: ['virtual_folders'] })
    }

    const setup = async () => {
      try {
        unlistens.push(await listen('file-added',   invalidateFiles))
        unlistens.push(await listen('file-removed', invalidateFiles))
        unlistens.push(await listen('index-done',   invalidateFiles))
        unlistens.push(
          await listen<{ id: number; path: string }>('thumbnail-ready', ({ payload }) => {
            qc.setQueriesData(
              { queryKey: ['files'] },
              (old: unknown) => {
                if (!Array.isArray(old)) return old
                return old.map((f: { id: number; thumbnailPath: string | null }) =>
                  f.id === payload.id ? { ...f, thumbnailPath: payload.path } : f,
                )
              },
            )
          }),
        )
      } catch (err) {
        console.error('useReactiveCache: failed to attach listeners', err)
      }
    }

    setup()

    // Cleanup runs synchronously — all resolved unlistens are removed
    return () => {
      unlistens.forEach((fn) => fn())
    }
  }, [qc])
}
