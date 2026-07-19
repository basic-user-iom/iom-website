import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useCrmI18n } from './i18n'
import {
  normalizeRect,
  pointerToNormalized,
  strokeBlurRegions,
  type BlurRegion,
  type BlurStrength,
} from './recorder/blurRegions'
import { downloadBlob, formatDuration } from './recorder/mediaRecorder'
import { processVideoBlob } from './recorder/videoEdit'

export interface RecordingEditorResult {
  blob: Blob
  durationMs: number
}

interface RecordingEditorProps {
  title: string
  sourceBlob: Blob
  /** When true, primary action overwrites the online file. */
  canSaveOnline: boolean
  onCancel: () => void
  onSaved: (result: RecordingEditorResult) => void | Promise<void>
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'recording'
  )
}

export function RecordingEditor({
  title,
  sourceBlob,
  canSaveOnline,
  onCancel,
  onSaved,
}: RecordingEditorProps) {
  const { t } = useCrmI18n()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  const [objectUrl] = useState(() => URL.createObjectURL(sourceBlob))
  const [durationMs, setDurationMs] = useState(0)
  const [trimStartMs, setTrimStartMs] = useState(0)
  const [trimEndMs, setTrimEndMs] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [blurTool, setBlurTool] = useState(false)
  const [blurRegions, setBlurRegions] = useState<BlurRegion[]>([])
  const [blurStrength, setBlurStrength] = useState<BlurStrength>('medium')
  const [blurDraft, setBlurDraft] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [savingOnline, setSavingOnline] = useState(false)

  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  const effectiveVolume = muted ? 0 : volume

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = Math.min(1, effectiveVolume)
    v.muted = effectiveVolume <= 0.001
  }, [effectiveVolume])

  const paintOverlay = useCallback(() => {
    const video = videoRef.current
    const canvas = overlayRef.current
    if (!video || !canvas) return
    const w = video.clientWidth
    const h = video.clientHeight
    if (!w || !h) return
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    if (blurRegions.length || blurDraft) {
      strokeBlurRegions(ctx, canvas, blurRegions, blurDraft)
    }
  }, [blurDraft, blurRegions])

  useEffect(() => {
    paintOverlay()
  }, [paintOverlay, durationMs])

  const onMeta = () => {
    const v = videoRef.current
    if (!v) return
    const ms = Math.round((v.duration || 0) * 1000)
    setDurationMs(ms)
    setTrimStartMs(0)
    setTrimEndMs(ms)
    paintOverlay()
  }

  const clampTrim = (start: number, end: number) => {
    const max = durationMs || 0
    let s = Math.max(0, Math.min(start, max))
    let e = Math.max(0, Math.min(end, max))
    if (e - s < 200) {
      if (s + 200 <= max) e = s + 200
      else s = Math.max(0, e - 200)
    }
    setTrimStartMs(s)
    setTrimEndMs(e)
  }

  const seekPreview = (ms: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = ms / 1000
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!blurTool || busy) return
    const canvas = overlayRef.current
    if (!canvas) return
    const p = pointerToNormalized(canvas, e.clientX, e.clientY)
    if (!p) return
    dragStartRef.current = p
    setBlurDraft({ x: p.x, y: p.y, w: 0, h: 0 })
    canvas.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragStartRef.current) return
    const canvas = overlayRef.current
    if (!canvas) return
    const p = pointerToNormalized(canvas, e.clientX, e.clientY)
    if (!p) return
    const s = dragStartRef.current
    setBlurDraft(normalizeRect(s.x, s.y, p.x, p.y))
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragStartRef.current) return
    const canvas = overlayRef.current
    if (!canvas) return
    const p = pointerToNormalized(canvas, e.clientX, e.clientY)
    const s = dragStartRef.current
    dragStartRef.current = null
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (!p || !s) {
      setBlurDraft(null)
      return
    }
    const box = normalizeRect(s.x, s.y, p.x, p.y)
    setBlurDraft(null)
    if (box.w < 0.02 || box.h < 0.02) return
    setBlurRegions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), ...box },
    ])
  }

  const runEncode = async (): Promise<RecordingEditorResult> => {
    setBusy(true)
    setError('')
    setProgress(0)
    try {
      const result = await processVideoBlob(sourceBlob, {
        trimStartMs,
        trimEndMs: trimEndMs || 0,
        volume: effectiveVolume,
        blurRegions,
        blurStrength,
        onProgress: setProgress,
      })
      return result
    } finally {
      setBusy(false)
    }
  }

  const handleDownload = async () => {
    try {
      const { blob } = await runEncode()
      downloadBlob(blob, `${slugify(title)}-edited.webm`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recorder.edit.error'))
    }
  }

  const handleSave = async () => {
    setSavingOnline(true)
    try {
      const result = await runEncode()
      await onSaved(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recorder.edit.error'))
    } finally {
      setSavingOnline(false)
    }
  }

  const trimLabel = `${formatDuration(trimStartMs)} – ${formatDuration(trimEndMs)}`

  return (
    <div className="crm-recorder-editor-backdrop" role="presentation">
      <div
        className="crm-recorder-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-recorder-editor-title"
      >
        <header className="crm-recorder-editor-header">
          <h2 id="crm-recorder-editor-title">{t('recorder.edit.title')}</h2>
          <p className="crm-recorder-hint">{title}</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={busy || savingOnline}
          >
            {t('recorder.edit.cancel')}
          </button>
        </header>

        <div className="crm-recorder-editor-preview-wrap">
          <video
            ref={videoRef}
            className="crm-recorder-editor-video"
            src={objectUrl}
            controls
            playsInline
            onLoadedMetadata={onMeta}
            onTimeUpdate={() => {
              const v = videoRef.current
              if (!v || !durationMs) return
              if (v.currentTime * 1000 < trimStartMs - 50) {
                v.currentTime = trimStartMs / 1000
              }
              if (v.currentTime * 1000 > trimEndMs) {
                v.pause()
                v.currentTime = trimEndMs / 1000
              }
            }}
          />
          <canvas
            ref={overlayRef}
            className={`crm-recorder-editor-overlay${blurTool ? ' is-blur-tool' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              dragStartRef.current = null
              setBlurDraft(null)
            }}
          />
        </div>

        <div className="crm-recorder-editor-controls">
          <label className="crm-recorder-field">
            <span>{t('recorder.edit.trimStart')}</span>
            <input
              className="crm-input"
              type="range"
              min={0}
              max={durationMs || 0}
              step={50}
              value={trimStartMs}
              disabled={busy || !durationMs}
              onChange={(e) => {
                const v = Number(e.target.value)
                clampTrim(v, Math.max(v + 200, trimEndMs))
                seekPreview(v)
              }}
            />
          </label>
          <label className="crm-recorder-field">
            <span>{t('recorder.edit.trimEnd')}</span>
            <input
              className="crm-input"
              type="range"
              min={0}
              max={durationMs || 0}
              step={50}
              value={trimEndMs}
              disabled={busy || !durationMs}
              onChange={(e) => {
                const v = Number(e.target.value)
                clampTrim(Math.min(v - 200, trimStartMs), v)
                seekPreview(Math.max(trimStartMs, v - 200))
              }}
            />
          </label>
          <p className="crm-recorder-hint crm-recorder-hint--meta">
            {t('recorder.edit.trimRange').replace('{range}', trimLabel)}
          </p>

          <div className="crm-recorder-editor-volume-row">
            <label className="crm-recorder-field" style={{ flex: 1 }}>
              <span>{t('recorder.edit.volume')}</span>
              <input
                className="crm-input"
                type="range"
                min={0}
                max={200}
                step={5}
                value={Math.round(volume * 100)}
                disabled={busy || muted}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
              />
            </label>
            <label className="crm-recorder-check">
              <input
                type="checkbox"
                checked={muted}
                disabled={busy}
                onChange={(e) => setMuted(e.target.checked)}
              />
              <span>{t('recorder.edit.mute')}</span>
            </label>
            <span className="crm-recorder-hint crm-recorder-hint--meta">
              {muted ? '0%' : `${Math.round(volume * 100)}%`}
            </span>
          </div>

          <div className="crm-recorder-toggles">
            <label className="crm-recorder-check">
              <input
                type="checkbox"
                checked={blurTool}
                disabled={busy}
                onChange={(e) => setBlurTool(e.target.checked)}
              />
              <span>{t('recorder.blur.tool')}</span>
            </label>
          </div>

          {(blurTool || blurRegions.length > 0) && (
            <div className="crm-recorder-blur-panel">
              <label className="crm-recorder-field">
                <span>{t('recorder.blur.strength')}</span>
                <select
                  className="crm-input"
                  value={blurStrength}
                  disabled={busy}
                  onChange={(e) =>
                    setBlurStrength(e.target.value as BlurStrength)
                  }
                >
                  <option value="light">{t('recorder.blur.light')}</option>
                  <option value="medium">{t('recorder.blur.medium')}</option>
                  <option value="strong">{t('recorder.blur.strong')}</option>
                </select>
              </label>
              <p className="crm-recorder-hint">{t('recorder.edit.blurHint')}</p>
              <p className="crm-recorder-hint crm-recorder-hint--meta">
                {t('recorder.blur.count').replace(
                  '{n}',
                  String(blurRegions.length),
                )}
              </p>
              <div className="crm-recorder-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!blurRegions.length || busy}
                  onClick={() =>
                    setBlurRegions((prev) => prev.slice(0, -1))
                  }
                >
                  {t('recorder.blur.undo')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!blurRegions.length || busy}
                  onClick={() => setBlurRegions([])}
                >
                  {t('recorder.blur.clear')}
                </button>
              </div>
            </div>
          )}

          {busy && (
            <div className="crm-recorder-editor-progress" role="status">
              <div
                className="crm-recorder-editor-progress-bar"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
              <span>
                {t('recorder.edit.encoding').replace(
                  '{pct}',
                  String(Math.round(progress * 100)),
                )}
              </span>
            </div>
          )}

          {error && (
            <p className="crm-recorder-error" role="alert">
              {error}
            </p>
          )}

          <p className="crm-recorder-hint">{t('recorder.edit.slowHint')}</p>

          <div className="crm-recorder-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || savingOnline}
              onClick={() => void handleDownload()}
            >
              {t('recorder.download')}
            </button>
            {canSaveOnline && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || savingOnline || !durationMs}
                onClick={() => void handleSave()}
              >
                {savingOnline || busy
                  ? t('recorder.edit.saving')
                  : t('recorder.edit.save')}
              </button>
            )}
            {!canSaveOnline && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !durationMs}
                onClick={() => void handleSave()}
              >
                {busy ? t('recorder.edit.encoding').replace('{pct}', String(Math.round(progress * 100))) : t('recorder.edit.applyLocal')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
