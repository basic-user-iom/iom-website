import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { getCurrentUser } from './api'
import { isCrmDemoMode } from './demoMode'
import { useCrmI18n } from './i18n'
import {
  listAiVoices,
  morphVoiceWithAi,
  probeAiVoiceAvailable,
  type ElevenLabsVoiceOption,
} from './recorder/audioPipeline'
import {
  applyBlurToVideoBlob,
  normalizeRect,
  pointerToNormalized,
  strokeBlurRegions,
  type BlurRegion,
  type BlurStrength,
} from './recorder/blurRegions'
import { startCapture, type ActiveCapture } from './recorder/capture'
import {
  downloadBlob,
  formatBytes,
  formatDuration,
  startMediaRecorder,
  type RecordingHandle,
} from './recorder/mediaRecorder'
import type {
  AppearanceMode,
  LocalRecording,
  RecorderStatus,
  SaveDestination,
  VoicePreset,
} from './recorder/types'
import { RecordingEditor } from './RecordingEditor'
import {
  deleteRecording,
  embedSnippetForSlug,
  getRecordingSignedUrl,
  isRecordingsSchemaMissing,
  listRecordings,
  replaceRecordingBlob,
  setRecordingPassword,
  shareUrlForSlug,
  uploadRecording,
} from './recordingsApi'
import { useLiveCrmBackend } from './supabaseClient'
import type { CrmRecording } from './types'

type EditorTarget =
  | { kind: 'local'; id: string; title: string; blob: Blob; durationMs: number }
  | {
      kind: 'online'
      rec: CrmRecording
      blob: Blob
      previewUrl: string
    }

type Panel = 'record' | 'library'

const STATIC_AVATAR_KEY = 'iom-crm-recorder-static-avatar'
const STATIC_AVATAR_MAX_CHARS = 900_000 // ~keep localStorage sane
/** Circular low-poly raven (same art as header mascot / favicon). */
const IOM_RAVEN_STATIC_URL = '/favicon.png'

function readStoredStaticAvatar(): string {
  try {
    return localStorage.getItem(STATIC_AVATAR_KEY) || ''
  } catch {
    return ''
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

export function ScreenRecorderView() {
  const { t } = useCrmI18n()
  const demoMode = isCrmDemoMode()
  const live = useLiveCrmBackend()

  const [panel, setPanel] = useState<Panel>('record')
  const [mic, setMic] = useState(true)
  const [camera, setCamera] = useState(true)
  const [noiseSuppression, setNoiseSuppression] = useState(true)
  const [voice, setVoice] = useState<VoicePreset>('natural')
  const [appearance, setAppearance] = useState<AppearanceMode>('real')
  const [staticAvatarUrl, setStaticAvatarUrl] = useState(readStoredStaticAvatar)
  const staticFileRef = useRef<HTMLInputElement | null>(null)
  const [destination, setDestination] = useState<SaveDestination>(
    live ? 'online' : 'local',
  )
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [aiAvailable, setAiAvailable] = useState(false)
  const [aiVoices, setAiVoices] = useState<ElevenLabsVoiceOption[]>([])
  const [aiVoiceId, setAiVoiceId] = useState('')
  const [aiVoicesLoading, setAiVoicesLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [blurTool, setBlurTool] = useState(false)
  const [blurRegions, setBlurRegions] = useState<BlurRegion[]>([])
  const [blurStrength, setBlurStrength] = useState<BlurStrength>('medium')
  const [blurDraft, setBlurDraft] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  const [postBlurBusy, setPostBlurBusy] = useState(false)

  const [localRecs, setLocalRecs] = useState<LocalRecording[]>([])
  const [onlineRecs, setOnlineRecs] = useState<CrmRecording[]>([])
  const [libLoading, setLibLoading] = useState(false)
  const [libError, setLibError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [passwordDraft, setPasswordDraft] = useState<Record<string, string>>({})
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null)
  const [editorBusyId, setEditorBusyId] = useState<string | null>(null)

  const captureRef = useRef<ActiveCapture | null>(null)
  const recorderRef = useRef<RecordingHandle | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const blurRegionsRef = useRef<BlurRegion[]>([])
  const blurStrengthRef = useRef<BlurStrength>('medium')
  const blurDraftRef = useRef<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const lastBlobRef = useRef<Blob | null>(null)

  useEffect(() => {
    blurRegionsRef.current = blurRegions
  }, [blurRegions])
  useEffect(() => {
    blurStrengthRef.current = blurStrength
  }, [blurStrength])
  useEffect(() => {
    blurDraftRef.current = blurDraft
  }, [blurDraft])

  useEffect(() => {
    void probeAiVoiceAvailable().then(setAiAvailable)
  }, [])

  useEffect(() => {
    if (voice !== 'ai' || !aiAvailable) return
    let cancelled = false
    setAiVoicesLoading(true)
    void listAiVoices()
      .then(({ voices, defaultVoiceId }) => {
        if (cancelled) return
        setAiVoices(voices)
        setAiVoiceId((prev) => {
          if (prev && voices.some((v) => v.id === prev)) return prev
          if (defaultVoiceId && voices.some((v) => v.id === defaultVoiceId)) {
            return defaultVoiceId
          }
          return voices[0]?.id ?? ''
        })
      })
      .finally(() => {
        if (!cancelled) setAiVoicesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [voice, aiAvailable])

  const refreshLibrary = useCallback(async () => {
    if (!live) {
      setOnlineRecs([])
      return
    }
    setLibLoading(true)
    setLibError('')
    try {
      setOnlineRecs(await listRecordings())
    } catch (err) {
      if (isRecordingsSchemaMissing(err)) {
        setLibError(t('recorder.library.schemaMissing'))
      } else {
        setLibError(err instanceof Error ? err.message : t('recorder.error.save'))
      }
    } finally {
      setLibLoading(false)
    }
  }, [live, t])

  useEffect(() => {
    if (panel === 'library') void refreshLibrary()
  }, [panel, refreshLibrary])

  useEffect(() => {
    return () => {
      captureRef.current?.stop()
      if (timerRef.current) window.clearInterval(timerRef.current)
      localRecs.forEach((r) => URL.revokeObjectURL(r.objectUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  }, [])

  const paintPreview = useCallback((source: HTMLCanvasElement) => {
    const dest = previewCanvasRef.current
    if (!dest) return
    if (dest.width !== source.width || dest.height !== source.height) {
      dest.width = source.width
      dest.height = source.height
    }
    const ctx = dest.getContext('2d')
    if (!ctx) return
    ctx.drawImage(source, 0, 0)
    strokeBlurRegions(
      ctx,
      dest,
      blurRegionsRef.current,
      blurDraftRef.current,
    )
  }, [])

  const onPreviewPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!blurTool) return
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const pt = pointerToNormalized(canvas, e.clientX, e.clientY)
    if (!pt) return
    canvas.setPointerCapture(e.pointerId)
    dragStartRef.current = pt
    setBlurDraft({ x: pt.x, y: pt.y, w: 0, h: 0 })
  }

  const onPreviewPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!blurTool || !dragStartRef.current) return
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const pt = pointerToNormalized(canvas, e.clientX, e.clientY)
    if (!pt) return
    const start = dragStartRef.current
    setBlurDraft(normalizeRect(start.x, start.y, pt.x, pt.y))
  }

  const onPreviewPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!blurTool || !dragStartRef.current) return
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const pt = pointerToNormalized(canvas, e.clientX, e.clientY)
    const start = dragStartRef.current
    dragStartRef.current = null
    setBlurDraft(null)
    if (!pt) return
    const box = normalizeRect(start.x, start.y, pt.x, pt.y)
    if (box.w < 0.02 || box.h < 0.02) return
    setBlurRegions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), ...box },
    ])
  }

  const startRecording = async () => {
    setError('')
    setPreviewUrl(null)
    if (appearance === 'static' && !staticAvatarUrl.trim()) {
      setError(t('recorder.appearance.staticMissing'))
      return
    }
    const needsCameraWarn = appearance !== 'static' && !camera
    if (!mic || needsCameraWarn) {
      const missing = [
        !mic ? t('recorder.mic') : null,
        needsCameraWarn ? t('recorder.camera') : null,
      ]
        .filter(Boolean)
        .join(', ')
      const ok = window.confirm(
        t('recorder.warn.inputsOff').replace('{items}', missing),
      )
      if (!ok) return
    }
    try {
      const capture = await startCapture({
        mic,
        camera,
        noiseSuppression,
        voice: voice === 'ai' ? 'natural' : voice,
        appearance,
        staticAvatarUrl:
          appearance === 'static' ? staticAvatarUrl.trim() : null,
        onFrame: paintPreview,
        getBlurRegions: () => blurRegionsRef.current,
        getBlurStrength: () => blurStrengthRef.current,
      })
      captureRef.current = capture
      recorderRef.current = startMediaRecorder(capture.stream)
      setStatus('recording')
      setElapsed(0)
      timerRef.current = window.setInterval(() => {
        setElapsed(recorderRef.current?.getElapsedMs() ?? 0)
      }, 250)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (/display|Permission|share/i.test(msg)) {
        setError(t('recorder.error.screen'))
      } else if (/audio|microphone/i.test(msg)) {
        setError(t('recorder.error.mic'))
      } else if (/video|camera/i.test(msg)) {
        setError(t('recorder.error.camera'))
      } else {
        setError(msg || t('recorder.error.screen'))
      }
      setStatus('idle')
    }
  }

  const persistStaticAvatar = (url: string) => {
    setStaticAvatarUrl(url)
    try {
      if (url) localStorage.setItem(STATIC_AVATAR_KEY, url)
      else localStorage.removeItem(STATIC_AVATAR_KEY)
    } catch {
      /* quota — keep in memory only */
    }
  }

  const onPickStaticFile = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('recorder.appearance.staticBadType'))
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      if (dataUrl.length > STATIC_AVATAR_MAX_CHARS) {
        setError(t('recorder.appearance.staticTooLarge'))
        return
      }
      setError('')
      persistStaticAvatar(dataUrl)
    } catch {
      setError(t('recorder.appearance.staticBadType'))
    }
  }

  const useProfileStaticAvatar = async () => {
    try {
      const user = await getCurrentUser()
      const url = user?.avatar_url?.trim()
      if (!url) {
        setError(t('recorder.appearance.staticNoProfile'))
        return
      }
      setError('')
      persistStaticAvatar(url)
    } catch {
      setError(t('recorder.appearance.staticNoProfile'))
    }
  }

  const pauseRecording = () => {
    recorderRef.current?.pause()
    setStatus('paused')
  }

  const resumeRecording = () => {
    recorderRef.current?.resume()
    setStatus('recording')
  }

  const stopRecording = async () => {
    if (!recorderRef.current) return
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    const durationMs = recorderRef.current.getElapsedMs()
    setStatus('processing')
    try {
      let blob = await recorderRef.current.stop()
      captureRef.current?.stop()
      captureRef.current = null
      recorderRef.current = null

      if (voice === 'ai') {
        if (aiAvailable) {
          try {
            blob = await morphVoiceWithAi(blob, aiVoiceId || undefined)
          } catch (err) {
            console.warn('[recorder] AI morph failed, keeping original', err)
            const detail =
              err instanceof Error ? err.message : t('recorder.voice.aiUnavailable')
            setError(
              t('recorder.voice.aiFailedKeep').replace('{detail}', detail),
            )
          }
        } else {
          setError(t('recorder.voice.aiUnavailable'))
        }
      }

      const recTitle =
        title.trim() ||
        `Recording ${new Date().toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}`

      lastBlobRef.current = blob

      if (destination === 'local' || demoMode || !live) {
        const objectUrl = URL.createObjectURL(blob)
        const local: LocalRecording = {
          id: crypto.randomUUID(),
          title: recTitle,
          blob,
          mimeType: blob.type || 'video/webm',
          durationMs,
          createdAt: new Date().toISOString(),
          objectUrl,
        }
        setLocalRecs((prev) => [local, ...prev])
        setPreviewUrl(objectUrl)
        downloadBlob(
          blob,
          `${slugify(recTitle)}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`,
        )
        setStatus('idle')
        setPanel('library')
        return
      }

      setStatus('uploading')
      const user = await getCurrentUser()
      if (!user) throw new Error('Not signed in')
      await uploadRecording({
        blob,
        title: recTitle,
        durationMs,
        ownerId: user.id,
      })
      setPreviewUrl(URL.createObjectURL(blob))
      setStatus('idle')
      setPanel('library')
      void refreshLibrary()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('recorder.error.upload'),
      )
      setStatus('idle')
    }
  }

  const applyPostBlur = async () => {
    const source = lastBlobRef.current
    if (!source || !blurRegionsRef.current.length) return
    setPostBlurBusy(true)
    setError('')
    try {
      const next = await applyBlurToVideoBlob(
        source,
        blurRegionsRef.current,
        blurStrengthRef.current,
      )
      lastBlobRef.current = next
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(next)
      setPreviewUrl(url)
      downloadBlob(next, `recording-blurred.webm`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recorder.error.save'))
    } finally {
      setPostBlurBusy(false)
    }
  }

  const statusLabel =
    status === 'recording'
      ? t('recorder.status.recording')
      : status === 'paused'
        ? t('recorder.status.paused')
        : status === 'processing'
          ? t('recorder.status.processing')
          : status === 'uploading'
            ? t('recorder.status.uploading')
            : t('recorder.status.idle')

  const busy = status === 'processing' || status === 'uploading'
  const recording = status === 'recording' || status === 'paused'

  const applyPassword = async (id: string, password: string | null) => {
    try {
      await setRecordingPassword(id, password)
      setPasswordDraft((prev) => ({ ...prev, [id]: '' }))
      await refreshLibrary()
    } catch (err) {
      setLibError(err instanceof Error ? err.message : t('recorder.error.save'))
    }
  }

  const removeOnline = async (rec: CrmRecording) => {
    if (
      !window.confirm(
        t('recorder.deleteConfirm').replace('{title}', rec.title),
      )
    ) {
      return
    }
    try {
      await deleteRecording(rec)
      await refreshLibrary()
    } catch (err) {
      setLibError(err instanceof Error ? err.message : t('recorder.error.save'))
    }
  }

  const downloadOnline = async (rec: CrmRecording) => {
    try {
      const url = await getRecordingSignedUrl(rec.storage_path)
      const res = await fetch(url)
      const blob = await res.blob()
      downloadBlob(blob, `${slugify(rec.title)}.webm`)
    } catch (err) {
      setLibError(err instanceof Error ? err.message : t('recorder.error.save'))
    }
  }

  const openLocalEditor = (rec: LocalRecording) => {
    setEditorTarget({
      kind: 'local',
      id: rec.id,
      title: rec.title,
      blob: rec.blob,
      durationMs: rec.durationMs,
    })
  }

  const openOnlineEditor = async (rec: CrmRecording) => {
    setEditorBusyId(rec.id)
    setLibError('')
    try {
      const url = await getRecordingSignedUrl(rec.storage_path)
      const res = await fetch(url)
      if (!res.ok) throw new Error(t('recorder.edit.loadFailed'))
      const raw = await res.blob()
      const mime =
        rec.mime_type?.startsWith('video/')
          ? rec.mime_type
          : raw.type.startsWith('video/')
            ? raw.type
            : 'video/webm'
      const blob =
        raw.type === mime ? raw : new Blob([raw], { type: mime })
      setEditorTarget({ kind: 'online', rec, blob, previewUrl: url })
    } catch (err) {
      setLibError(
        err instanceof Error ? err.message : t('recorder.edit.loadFailed'),
      )
    } finally {
      setEditorBusyId(null)
    }
  }

  const handleEditorSaved = async (result: {
    blob: Blob
    durationMs: number
  }) => {
    if (!editorTarget) return
    if (editorTarget.kind === 'local') {
      const id = editorTarget.id
      setLocalRecs((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r
          URL.revokeObjectURL(r.objectUrl)
          return {
            ...r,
            blob: result.blob,
            mimeType: result.blob.type || r.mimeType,
            durationMs: result.durationMs,
            objectUrl: URL.createObjectURL(result.blob),
          }
        }),
      )
      setEditorTarget(null)
      return
    }
    await replaceRecordingBlob(
      editorTarget.rec,
      result.blob,
      result.durationMs,
    )
    setEditorTarget(null)
    await refreshLibrary()
  }

  return (
    <div className="crm-recorder">
      <p className="crm-recorder-intro">
        {demoMode ? t('recorder.introDemo') : t('recorder.intro')}
      </p>

      <div className="crm-recorder-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'record'}
          className={`crm-section-tab${panel === 'record' ? ' is-active' : ''}`}
          onClick={() => setPanel('record')}
        >
          {t('recorder.tab.record')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'library'}
          className={`crm-section-tab${panel === 'library' ? ' is-active' : ''}`}
          onClick={() => setPanel('library')}
        >
          {t('recorder.tab.library')}
        </button>
      </div>

      {error && (
        <p className="crm-recorder-error" role="alert">
          {error}
        </p>
      )}

      {panel === 'record' && (
        <div className="crm-recorder-record">
          <div className="crm-recorder-preview-wrap">
            <canvas
              ref={previewCanvasRef}
              className={`crm-recorder-preview${blurTool ? ' is-blur-tool' : ''}`}
              aria-label={t('recorder.preview')}
              onPointerDown={onPreviewPointerDown}
              onPointerMove={onPreviewPointerMove}
              onPointerUp={onPreviewPointerUp}
              onPointerCancel={() => {
                dragStartRef.current = null
                setBlurDraft(null)
              }}
            />
            {!recording && !previewUrl && (
              <div className="crm-recorder-preview-placeholder">
                {t('recorder.preview')}
              </div>
            )}
            {previewUrl && !recording && (
              <video
                className="crm-recorder-preview-video"
                src={previewUrl}
                controls
                playsInline
              />
            )}
            <div
              className="crm-recorder-hud"
              role="status"
              aria-live="polite"
            >
              <span
                className={`crm-recorder-hud-pill${mic ? ' is-on' : ' is-off'}`}
              >
                <span className="crm-recorder-hud-dot" aria-hidden />
                {mic ? t('recorder.hud.micOn') : t('recorder.hud.micOff')}
              </span>
              <span
                className={`crm-recorder-hud-pill${
                  appearance === 'static'
                    ? staticAvatarUrl
                      ? ' is-on'
                      : ' is-off'
                    : camera
                      ? ' is-on'
                      : ' is-off'
                }`}
              >
                <span className="crm-recorder-hud-dot" aria-hidden />
                {appearance === 'static'
                  ? staticAvatarUrl
                    ? t('recorder.hud.staticOn')
                    : t('recorder.hud.staticOff')
                  : camera
                    ? t('recorder.hud.cameraOn')
                    : t('recorder.hud.cameraOff')}
              </span>
              {recording && (
                <span className="crm-recorder-hud-pill is-live">
                  {t('recorder.hud.live')}
                </span>
              )}
            </div>
            <div className="crm-recorder-status-bar">
              <span
                className={`crm-recorder-dot${recording ? ' is-live' : ''}`}
                aria-hidden
              />
              <span>{statusLabel}</span>
              <span className="crm-recorder-timer">{formatDuration(elapsed)}</span>
            </div>
          </div>

          <div className="crm-recorder-controls">
            <label className="crm-recorder-field">
              <span>{t('recorder.title')}</span>
              <input
                className="crm-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('recorder.titlePlaceholder')}
                disabled={recording || busy}
              />
            </label>

            <div className="crm-recorder-toggles" role="group" aria-label={t('recorder.mic')}>
              <label className="crm-recorder-check">
                <input
                  type="checkbox"
                  checked={mic}
                  onChange={(e) => setMic(e.target.checked)}
                  disabled={recording || busy}
                />
                <span>{t('recorder.mic')}</span>
              </label>
              <label className="crm-recorder-check">
                <input
                  type="checkbox"
                  checked={camera}
                  onChange={(e) => setCamera(e.target.checked)}
                  disabled={recording || busy || appearance === 'static'}
                />
                <span>{t('recorder.camera')}</span>
              </label>
              <label
                className="crm-recorder-check"
                title={t('recorder.noiseHint')}
              >
                <input
                  type="checkbox"
                  checked={noiseSuppression}
                  onChange={(e) => setNoiseSuppression(e.target.checked)}
                  disabled={recording || busy || !mic}
                />
                <span>{t('recorder.noise')}</span>
              </label>
              <label className="crm-recorder-check">
                <input
                  type="checkbox"
                  checked={blurTool}
                  onChange={(e) => setBlurTool(e.target.checked)}
                  disabled={busy}
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
                    onChange={(e) =>
                      setBlurStrength(e.target.value as BlurStrength)
                    }
                    disabled={busy}
                  >
                    <option value="light">{t('recorder.blur.light')}</option>
                    <option value="medium">{t('recorder.blur.medium')}</option>
                    <option value="strong">{t('recorder.blur.strong')}</option>
                  </select>
                </label>
                <p className="crm-recorder-hint">{t('recorder.blur.hint')}</p>
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
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={
                      !lastBlobRef.current ||
                      !blurRegions.length ||
                      busy ||
                      recording ||
                      postBlurBusy
                    }
                    onClick={() => void applyPostBlur()}
                  >
                    {postBlurBusy
                      ? t('recorder.blur.applying')
                      : t('recorder.blur.applyPost')}
                  </button>
                </div>
              </div>
            )}

            <label className="crm-recorder-field">
              <span>{t('recorder.voice')}</span>
              <select
                className="crm-input"
                value={voice}
                onChange={(e) => setVoice(e.target.value as VoicePreset)}
                disabled={recording || busy}
              >
                <option value="natural">{t('recorder.voice.natural')}</option>
                <option value="deep">{t('recorder.voice.deep')}</option>
                <option value="high">{t('recorder.voice.high')}</option>
                <option value="robot">{t('recorder.voice.robot')}</option>
                <option value="ai">{t('recorder.voice.ai')}</option>
              </select>
              {voice === 'ai' && aiAvailable && (
                <label className="crm-recorder-field crm-recorder-field--nested">
                  <span>{t('recorder.voice.aiPick')}</span>
                  <select
                    className="crm-input"
                    value={aiVoiceId}
                    onChange={(e) => setAiVoiceId(e.target.value)}
                    disabled={
                      recording ||
                      busy ||
                      aiVoicesLoading ||
                      aiVoices.length === 0
                    }
                  >
                    {aiVoicesLoading && (
                      <option value="">{t('recorder.voice.aiLoading')}</option>
                    )}
                    {!aiVoicesLoading && aiVoices.length === 0 && (
                      <option value="">{t('recorder.voice.aiEmpty')}</option>
                    )}
                    {aiVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                        {v.category ? ` (${v.category})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {voice === 'ai' && (
                <span className="crm-recorder-hint">
                  {aiAvailable
                    ? t('recorder.voice.aiHint')
                    : t('recorder.voice.aiUnavailable')}
                </span>
              )}
            </label>

            <label className="crm-recorder-field">
              <span>{t('recorder.appearance')}</span>
              <select
                className="crm-input"
                value={appearance}
                onChange={(e) => {
                  const next = e.target.value as AppearanceMode
                  setAppearance(next)
                  if (next === 'static') {
                    setCamera(false)
                    if (!staticAvatarUrl.trim()) {
                      persistStaticAvatar(IOM_RAVEN_STATIC_URL)
                    }
                  }
                }}
                disabled={recording || busy}
              >
                <option value="real">{t('recorder.appearance.real')}</option>
                <option value="filters">{t('recorder.appearance.filters')}</option>
                <option value="avatar">{t('recorder.appearance.avatar')}</option>
                <option value="static">{t('recorder.appearance.static')}</option>
              </select>
            </label>

            {appearance === 'static' && (
              <div className="crm-recorder-static-panel">
                <p className="crm-recorder-hint">{t('recorder.appearance.staticHint')}</p>
                {staticAvatarUrl ? (
                  <img
                    className="crm-recorder-static-thumb"
                    src={staticAvatarUrl}
                    alt=""
                  />
                ) : (
                  <div className="crm-recorder-static-thumb is-empty">
                    {t('recorder.appearance.staticEmpty')}
                  </div>
                )}
                <input
                  ref={staticFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    e.target.value = ''
                    void onPickStaticFile(file)
                  }}
                />
                <div className="crm-recorder-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={recording || busy}
                    onClick={() => {
                      setError('')
                      persistStaticAvatar(IOM_RAVEN_STATIC_URL)
                    }}
                  >
                    {t('recorder.appearance.staticIomRaven')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={recording || busy}
                    onClick={() => staticFileRef.current?.click()}
                  >
                    {t('recorder.appearance.staticUpload')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={recording || busy}
                    onClick={() => void useProfileStaticAvatar()}
                  >
                    {t('recorder.appearance.staticUseProfile')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={recording || busy || !staticAvatarUrl}
                    onClick={() => persistStaticAvatar('')}
                  >
                    {t('recorder.appearance.staticClear')}
                  </button>
                </div>
              </div>
            )}

            <label className="crm-recorder-field">
              <span>{t('recorder.destination')}</span>
              <select
                className="crm-input"
                value={destination}
                onChange={(e) =>
                  setDestination(e.target.value as SaveDestination)
                }
                disabled={recording || busy}
              >
                <option value="local">{t('recorder.destination.local')}</option>
                <option value="online" disabled={!live || demoMode}>
                  {demoMode || !live
                    ? t('recorder.destination.onlineDemo')
                    : t('recorder.destination.online')}
                </option>
              </select>
            </label>

            <div className="crm-recorder-actions">
              {!recording && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void startRecording()}
                  disabled={busy}
                >
                  {t('recorder.start')}
                </button>
              )}
              {status === 'recording' && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={pauseRecording}
                >
                  {t('recorder.pause')}
                </button>
              )}
              {status === 'paused' && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resumeRecording}
                >
                  {t('recorder.resume')}
                </button>
              )}
              {recording && (
                <button
                  type="button"
                  className="btn btn-primary crm-recorder-stop"
                  onClick={() => void stopRecording()}
                >
                  {t('recorder.stop')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {panel === 'library' && (
        <div className="crm-recorder-library">
          {libLoading && <p>{t('recorder.library.loading')}</p>}
          {libError && (
            <p className="crm-recorder-error" role="alert">
              {libError}
            </p>
          )}

          {localRecs.length > 0 && (
            <section className="crm-recorder-lib-section">
              <h2>{t('recorder.library.local')}</h2>
              <ul className="crm-recorder-list">
                {localRecs.map((rec) => (
                  <li key={rec.id} className="crm-recorder-card">
                    <div className="crm-recorder-card-main">
                      <strong>{rec.title}</strong>
                      <span>
                        {t('recorder.duration')}: {formatDuration(rec.durationMs)}{' '}
                        · {formatBytes(rec.blob.size)}
                      </span>
                    </div>
                    <div className="crm-recorder-card-actions">
                      <video
                        className="crm-recorder-thumb"
                        src={rec.objectUrl}
                        controls
                        playsInline
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => openLocalEditor(rec)}
                      >
                        {t('recorder.edit')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          downloadBlob(
                            rec.blob,
                            `${slugify(rec.title)}.webm`,
                          )
                        }
                      >
                        {t('recorder.download')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          URL.revokeObjectURL(rec.objectUrl)
                          setLocalRecs((prev) =>
                            prev.filter((r) => r.id !== rec.id),
                          )
                        }}
                      >
                        {t('recorder.delete')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="crm-recorder-lib-section">
            <h2>{t('recorder.library.online')}</h2>
            {!live && (
              <p className="crm-recorder-hint">
                {t('recorder.destination.onlineDemo')}
              </p>
            )}
            {live && !libLoading && onlineRecs.length === 0 && !libError && (
              <p>{t('recorder.library.empty')}</p>
            )}
            <ul className="crm-recorder-list">
              {onlineRecs.map((rec) => (
                <li key={rec.id} className="crm-recorder-card">
                  <div className="crm-recorder-card-main">
                    <strong>{rec.title}</strong>
                    <span>
                      {t('recorder.duration')}:{' '}
                      {formatDuration(rec.duration_ms ?? 0)}
                      {rec.file_size != null
                        ? ` · ${formatBytes(rec.file_size)}`
                        : ''}
                      {rec.has_password ? ' · password' : ''}
                    </span>
                  </div>
                  <div className="crm-recorder-card-actions">
                    <OnlineRecordingPreview
                      storagePath={rec.storage_path}
                      title={rec.title}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        const url = shareUrlForSlug(rec.share_slug)
                        void navigator.clipboard.writeText(url)
                        setCopiedId(`share-${rec.id}`)
                        window.setTimeout(() => setCopiedId(null), 1500)
                      }}
                    >
                      {copiedId === `share-${rec.id}`
                        ? t('recorder.copied')
                        : t('recorder.copyShare')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          embedSnippetForSlug(rec.share_slug),
                        )
                        setCopiedId(`embed-${rec.id}`)
                        window.setTimeout(() => setCopiedId(null), 1500)
                      }}
                    >
                      {copiedId === `embed-${rec.id}`
                        ? t('recorder.copied')
                        : t('recorder.copyEmbed')}
                    </button>
                    <a
                      className="btn btn-ghost"
                      href={shareUrlForSlug(rec.share_slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('recorder.openShare')}
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={editorBusyId === rec.id}
                      onClick={() => void openOnlineEditor(rec)}
                    >
                      {editorBusyId === rec.id
                        ? t('recorder.edit.loading')
                        : t('recorder.edit')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void downloadOnline(rec)}
                    >
                      {t('recorder.download')}
                    </button>
                    <div className="crm-recorder-password-row">
                      <input
                        className="crm-input"
                        type="password"
                        placeholder={t('recorder.passwordPlaceholder')}
                        value={passwordDraft[rec.id] ?? ''}
                        onChange={(e) =>
                          setPasswordDraft((prev) => ({
                            ...prev,
                            [rec.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          void applyPassword(rec.id, passwordDraft[rec.id] ?? '')
                        }
                      >
                        {t('recorder.setPassword')}
                      </button>
                      {rec.has_password && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void applyPassword(rec.id, null)}
                        >
                          {t('recorder.clearPassword')}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void removeOnline(rec)}
                    >
                      {t('recorder.delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {editorTarget && (
        <RecordingEditor
          title={
            editorTarget.kind === 'local'
              ? editorTarget.title
              : editorTarget.rec.title
          }
          sourceBlob={editorTarget.blob}
          previewUrl={
            editorTarget.kind === 'online'
              ? editorTarget.previewUrl
              : undefined
          }
          fallbackDurationMs={
            editorTarget.kind === 'local'
              ? editorTarget.durationMs
              : editorTarget.rec.duration_ms ?? undefined
          }
          canSaveOnline={editorTarget.kind === 'online'}
          onCancel={() => setEditorTarget(null)}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  )
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

function OnlineRecordingPreview({
  storagePath,
  title,
}: {
  storagePath: string
  title: string
}) {
  const { t } = useCrmI18n()
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const url = await getRecordingSignedUrl(storagePath)
        if (!cancelled) setSrc(url)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [storagePath])

  if (failed) {
    return (
      <p className="crm-recorder-hint">{t('recorder.edit.loadFailed')}</p>
    )
  }
  if (!src) {
    return <p className="crm-recorder-hint">{t('recorder.edit.loading')}</p>
  }
  return (
    <video
      className="crm-recorder-thumb"
      src={src}
      controls
      playsInline
      preload="metadata"
      title={title}
    />
  )
}
