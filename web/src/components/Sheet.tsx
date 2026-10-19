import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/** A modal panel: a bottom sheet on phones, a centered dialog on wider screens. Escape or the backdrop closes it. */
export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={typeof title === 'string' ? title : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      <div className="sheet-panel">
        <div className="sheet-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-small btn-icon" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </dialog>
  )
}
