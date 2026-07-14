import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { exportCircularAvatar, loadImageFromFile } from './avatarCrop'
import { useCrmI18n } from './i18n'

interface AvatarCropDialogProps {
  file: File
  onCancel: () => void
  onConfirm: (file: File) => Promise<void>
}

const VIEW = 220

export function AvatarCropDialog({ file, onCancel, onConfirm }: AvatarCropDialogProps) {
  const { t } = useCrmI18n()
  const titleId = useId()
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [loadError, setLoadError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadError('')
    setImage(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    void loadImageFromFile(file)
      .then((img) => {
        if (!cancelled) setImage(img)
      })
      .catch(() => {
        if (!cancelled) setLoadError(t('crop.failed'))
      })
    return () => {
      cancelled = true
    }
  }, [file, t])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [busy, onCancel])

  const clampOffset = (x: number, y: number, z: number) => {
    const max = (VIEW / 2) * (z - 0.35)
    return {
      x: Math.max(-max, Math.min(max, x)),
      y: Math.max(-max, Math.min(max, y)),
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (busy || !image) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    setOffset(
      clampOffset(drag.ox + (e.clientX - drag.x), drag.oy + (e.clientY - drag.y), zoom),
    )
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const handleZoom = (value: number) => {
    setZoom(value)
    setOffset((prev) => clampOffset(prev.x, prev.y, value))
  }

  const handleSave = async () => {
    if (!image) return
    setError('')
    setBusy(true)
    try {
      const out = await exportCircularAvatar({
        image,
        offsetX: offset.x,
        offsetY: offset.y,
        zoom,
        viewSize: VIEW,
      })
      await onConfirm(out)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('crop.failed'))
    } finally {
      setBusy(false)
    }
  }

  const minDim = image ? Math.min(image.naturalWidth, image.naturalHeight) : VIEW
  const displayScale = (VIEW / minDim) * zoom
  const imgW = image ? image.naturalWidth * displayScale : VIEW
  const imgH = image ? image.naturalHeight * displayScale : VIEW

  return (
    <div
      className="crm-guide-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className="crm-crop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="crm-guide-header">
          <div>
            <p className="crm-kicker">{t('profile.photo')}</p>
            <h2 id={titleId} className="crm-guide-title">
              {t('crop.title')}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost crm-guide-x"
            aria-label={t('crop.cancel')}
            disabled={busy}
            onClick={onCancel}
          >
            ×
          </button>
        </header>

        <div className="crm-crop-body">
          <p className="crm-crop-hint">{t('crop.hint')}</p>

          {loadError ? (
            <p className="crm-feedback crm-feedback--error" role="alert">
              {loadError}
            </p>
          ) : !image ? (
            <p className="crm-muted">{t('boot.loading')}</p>
          ) : (
            <div
              className="crm-crop-stage"
              style={{ width: VIEW, height: VIEW }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div
                className="crm-crop-image-wrap"
                style={{
                  width: imgW,
                  height: imgH,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              >
                <img src={image.src} alt="" draggable={false} className="crm-crop-image" />
              </div>
              <div className="crm-crop-mask" aria-hidden="true" />
            </div>
          )}

          <label className="crm-crop-zoom crm-field">
            <span className="crm-label">{t('crop.zoom')}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              disabled={busy || !image}
              onChange={(e) => handleZoom(Number(e.target.value))}
            />
          </label>

          {error && (
            <p className="crm-feedback crm-feedback--error" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="crm-guide-footer">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
            {t('crop.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !image}
            onClick={() => void handleSave()}
          >
            {busy ? t('crop.saving') : t('crop.save')}
          </button>
        </footer>
      </div>
    </div>
  )
}
