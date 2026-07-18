import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Header } from '../../components/Header'
import { Footer } from '../../components/Footer'
import {
  FORMAT_OPTIONS,
  SIZE_PRESETS,
  type OutputFormat,
  type SizePresetId,
} from './presets'
import { downloadBlob, formatBytes, processImage } from './processImage'
import './image-prep.css'

const BASE = '/tools/image-prep'
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif'

export function isImagePrepPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === BASE
}

type JobStatus = 'queued' | 'working' | 'done' | 'error'

type Job = {
  id: string
  file: File
  previewUrl: string
  status: JobStatus
  error?: string
  result?: Awaited<ReturnType<typeof processImage>>
  sourceBytes: number
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function ImagePrepApp() {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [presetId, setPresetId] = useState<SizePresetId>('gallery')
  const [customEdge, setCustomEdge] = useState(1600)
  const [format, setFormat] = useState<OutputFormat>('image/jpeg')
  const [quality, setQuality] = useState(0.82)
  const [jobs, setJobs] = useState<Job[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const fromIcm =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('from') === 'icm'

  const jobsRef = useRef(jobs)
  jobsRef.current = jobs
  useEffect(() => {
    return () => {
      jobsRef.current.forEach((j) => URL.revokeObjectURL(j.previewUrl))
    }
  }, [])

  const activePreset = SIZE_PRESETS.find((p) => p.id === presetId) ?? SIZE_PRESETS[1]
  const maxEdge =
    presetId === 'custom'
      ? customEdge
      : presetId === 'original'
        ? null
        : activePreset.maxEdge

  function addFiles(fileList: FileList | File[]) {
    const next: Job[] = []
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) continue
      next.push({
        id: uid(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'queued',
        sourceBytes: file.size,
      })
    }
    if (next.length) setJobs((prev) => [...next, ...prev])
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFiles(e.target.files)
    e.target.value = ''
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  async function runAll() {
    const pending = jobs.filter((j) => j.status === 'queued' || j.status === 'error')
    if (!pending.length || busy) return
    setBusy(true)

    for (const job of pending) {
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: 'working', error: undefined } : j)),
      )
      try {
        const result = await processImage(job.file, {
          maxEdge,
          format,
          quality,
        })
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, status: 'done', result } : j)),
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Processing failed'
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, status: 'error', error: message } : j)),
        )
      }
    }

    setBusy(false)
  }

  function clearDone() {
    setJobs((prev) => {
      prev.filter((j) => j.status === 'done').forEach((j) => URL.revokeObjectURL(j.previewUrl))
      return prev.filter((j) => j.status !== 'done')
    })
  }

  function removeJob(id: string) {
    setJobs((prev) => {
      const hit = prev.find((j) => j.id === id)
      if (hit) URL.revokeObjectURL(hit.previewUrl)
      return prev.filter((j) => j.id !== id)
    })
  }

  const doneCount = jobs.filter((j) => j.status === 'done' && j.result).length

  return (
    <>
      <Header />
      <main className="imgprep">
        <header className="imgprep__hero">
          <p className="imgprep__kicker">IOM tools</p>
          <h1>Image prep</h1>
          <p>
            Resize, compress, and strip EXIF from photos in your browser. Files never leave this
            device unless you download them.
          </p>
          {fromIcm ? (
            <p className="imgprep__hint" style={{ marginTop: '0.75rem' }}>
              <a href="/demo/icm">← Back to ICM demo</a>
            </p>
          ) : null}
        </header>

        <div className="imgprep__layout">
          <aside className="imgprep__panel">
            <h2>Settings</h2>

            <div className="imgprep__field">
              <span>Size preset</span>
              <div className="imgprep__presets">
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`imgprep__preset${presetId === p.id ? ' is-active' : ''}`}
                    onClick={() => setPresetId(p.id)}
                  >
                    <strong>{p.label}</strong>
                    <small>{p.hint}</small>
                  </button>
                ))}
              </div>
            </div>

            {presetId === 'custom' ? (
              <label className="imgprep__field">
                <span>Longest edge (px)</span>
                <input
                  className="imgprep__input"
                  type="number"
                  min={320}
                  max={8000}
                  step={10}
                  value={customEdge}
                  onChange={(e) => setCustomEdge(Number(e.target.value) || 1600)}
                />
              </label>
            ) : null}

            <label className="imgprep__field">
              <span>Format</span>
              <select
                className="imgprep__select"
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            {format !== 'image/png' ? (
              <label className="imgprep__field">
                <span>
                  Quality <span className="imgprep__range-val">{Math.round(quality * 100)}%</span>
                </span>
                <input
                  className="imgprep__range"
                  type="range"
                  min={0.5}
                  max={0.95}
                  step={0.01}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
              </label>
            ) : (
              <p className="imgprep__hint">PNG is lossless — quality slider does not apply.</p>
            )}

            <p className="imgprep__hint">
              Target longest edge:{' '}
              {maxEdge == null ? 'original' : `${maxEdge}px`}. Images smaller than the limit are
              not upscaled.
            </p>
          </aside>

          <section>
            <label
              className={`imgprep__drop${dragOver ? ' is-drag' : ''}`}
              htmlFor={inputId}
              onDragEnter={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <strong>Drop photos here</strong>
              <span>or click to browse — JPEG, PNG, WebP, GIF, AVIF</span>
              <input
                ref={inputRef}
                id={inputId}
                className="imgprep__file"
                type="file"
                accept={ACCEPT}
                multiple
                onChange={onInputChange}
              />
            </label>

            <div className="imgprep__actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !jobs.some((j) => j.status === 'queued' || j.status === 'error')}
                onClick={() => void runAll()}
              >
                {busy ? 'Processing…' : 'Process queue'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!doneCount}
                onClick={() => {
                  jobs
                    .filter((j) => j.status === 'done' && j.result)
                    .forEach((j) => downloadBlob(j.result!.blob, j.result!.filename))
                }}
              >
                Download all ({doneCount})
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!doneCount}
                onClick={clearDone}
              >
                Clear finished
              </button>
            </div>

            {jobs.length === 0 ? (
              <p className="imgprep__empty">
                Add images, pick a preset (Gallery = 1400px fits ICM stills), then process. Output
                has no EXIF camera / GPS data.
              </p>
            ) : (
              <ul className="imgprep__list">
                {jobs.map((job) => (
                  <li key={job.id} className="imgprep__item">
                    <img className="imgprep__thumb" src={job.previewUrl} alt="" />
                    <div className="imgprep__item-meta">
                      <strong title={job.file.name}>{job.file.name}</strong>
                      {job.status === 'queued' ? (
                        <p>
                          {formatBytes(job.sourceBytes)} · waiting
                        </p>
                      ) : null}
                      {job.status === 'working' ? <p>Processing…</p> : null}
                      {job.status === 'error' ? (
                        <p className="is-err">{job.error ?? 'Failed'}</p>
                      ) : null}
                      {job.status === 'done' && job.result ? (
                        <p className="is-ok">
                          {job.result.width}×{job.result.height} · {formatBytes(job.sourceBytes)} →{' '}
                          {formatBytes(job.result.bytes)} · EXIF stripped
                        </p>
                      ) : null}
                    </div>
                    <div className="imgprep__item-actions">
                      {job.result ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => downloadBlob(job.result!.blob, job.result!.filename)}
                        >
                          Download
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => removeJob(job.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="imgprep__note">
              Processing runs entirely in your browser (canvas re-encode). Next step for the ICM
              demo: push prepared files into placeholder slots — that connection comes after this
              tool is solid.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
