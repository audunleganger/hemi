import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

interface ToastApi {
  show(text: string, action?: Toast['action']): void
}

const ToastContext = createContext<ToastApi>({ show: () => {} })

/** Short confirmations at the bottom of the screen, optionally with one action such as Undo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])
  const api = useMemo<ToastApi>(
    () => ({
      show(text, action) {
        const id = next.current++
        setToasts((all) => [...all, { id, text, action }])
        window.setTimeout(() => dismiss(id), action ? 10_000 : 4_000)
      },
    }),
    [dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => {
                  dismiss(toast.id)
                  toast.action!.run()
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react/only-export-components
export const useToast = () => useContext(ToastContext)
