import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentUser } from './api'
import { isCrmDemoMode } from './demoMode'
import { useCrmI18n } from './i18n'
import {
  listAiVoices,
  morphVoiceWithAi,
  probeAiVoiceAvailable,
  type ElevenLabsVoiceOption,
} from './recorder/audioPipeline'
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
import {
  deleteRecording,
  embedSnippetForSlug,
  getRecordingSignedUrl,
  isRecordingsSchemaMissing,
  listRecordings,
  setRecordingPassword,
  shareUrlForSlug,
  uploadRecording,
} from './recordingsApi'
import { useLiveCrmBackend } from './supabaseClient'
import type { CrmRecording } from './types'

type Panel = 'record' | 'library'

export function ScreenRecorderView() {
  const { t } = useCrmI18n()
  const demoMode = isCrmDemoMode()
  const live = useLiveCrmBackend()

  const [panel, setPanel] = useState<Panel>('record')
  const [mic, setMic] = useState(true)
  const [camera, setCamera] = useState(true)
  const [voice, setVoice] = useState<VoicePreset>('natural')
  const [appearance, setAppearance] = useState<AppearanceMode>('real')
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

  const [localRecs, setLocalRecs] = useState<LocalRecording[]>([])
  const [onlineRecs, setOnlineRecs] = useState<CrmRecording[]>([])
  const [libLoading, setLibLoading] = useState(false)
  const [libError, setLibError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [passwordDraft, setPasswordDraft] = useState<Record<string, string>>({})

  const captureRef = useRef<ActiveCapture | null>(null)
  const recorderRef = useRef<RecordingHandle | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const timerRef = useRef<number | null>(null)

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
    ctx?.drawImage(source, 0, 0)
  }, [])

  const startRecording = async () => {
    setError('')
    setPreviewUrl(null)
    try {
      const capture = await startCapture({
        mic,
        camera,
        voice: voice === 'ai' ? 'natural' : voice,
        appearance,
        onFrame: paintPreview,
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
            setError(
              err instanceof Error
                ? err.message
                : t('recorder.voice.aiUnavailable'),
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
              className="crm-recorder-preview"
              aria-label={t('recorder.preview')}
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
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('recorder.titlePlaceholder')}
                disabled={recording || busy}
              />
            </label>

            <div className="crm-recorder-toggles">
              <label className="crm-recorder-check">
                <input
                  type="checkbox"
                  checked={mic}
                  onChange={(e) => setMic(e.target.checked)}
                  disabled={recording || busy}
                />
                {t('recorder.mic')}
              </label>
              <label className="crm-recorder-check">
                <input
                  type="checkbox"
                  checked={camera}
                  onChange={(e) => setCamera(e.target.checked)}
                  disabled={recording || busy}
                />
                {t('recorder.camera')}
              </label>
            </div>

            <label className="crm-recorder-field">
              <span>{t('recorder.voice')}</span>
              <select
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
              <span className="crm-recorder-hint">
                {voice === 'ai'
                  ? aiAvailable
                    ? t('recorder.voice.aiHint')
                    : t('recorder.voice.aiUnavailable')
                  : t('recorder.voice.aiHint')}
              </span>
            </label>

            <label className="crm-recorder-field">
              <span>{t('recorder.appearance')}</span>
              <select
                value={appearance}
                onChange={(e) =>
                  setAppearance(e.target.value as AppearanceMode)
                }
                disabled={recording || busy || !camera}
              >
                <option value="real">{t('recorder.appearance.real')}</option>
                <option value="filters">{t('recorder.appearance.filters')}</option>
                <option value="avatar">{t('recorder.appearance.avatar')}</option>
              </select>
            </label>

            <label className="crm-recorder-field">
              <span>{t('recorder.destination')}</span>
              <select
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
                      onClick={() => void downloadOnline(rec)}
                    >
                      {t('recorder.download')}
                    </button>
                    <div className="crm-recorder-password-row">
                      <input
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
