import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import {
  EMAIL_ATTACH_ACCEPT,
  EMAIL_ATTACH_MAX_FILES,
  filesFromClipboard,
  formatAttachBytes,
  isImageAttachment,
  isPdfAttachment,
  mergeOutgoingFiles,
  prepareEmailAttachmentFile,
  sanitizeAttachmentFilename,
  validateOutgoingFiles,
  type OutreachAttachmentMeta,
} from './emailAttachments'
import { useCrmI18n } from './i18n'

interface EmailAttachmentsFieldProps {
  files: File[]
  onChange: (next: File[]) => void
  disabled?: boolean
}

function AttachmentThumb({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!isImageAttachment(file)) return
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  if (!url) return null
  return (
    <img
      className="crm-email-attach-thumb"
      src={url}
      alt=""
      width={40}
      height={40}
    />
  )
}

export function EmailAttachmentsField({
  files,
  onChange,
  disabled = false,
}: EmailAttachmentsFieldProps) {
  const { t } = useCrmI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const filesRef = useRef(files)
  filesRef.current = files
  const applyIncomingRef = useRef<(incoming: File[]) => Promise<void>>(async () => {})
  const [localError, setLocalError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [preparing, setPreparing] = useState(false)

  const applyIncoming = async (incoming: File[]) => {
    if (!incoming.length || disabled) return
    setPreparing(true)
    try {
      const prepared: File[] = []
      for (const file of incoming) {
        prepared.push(await prepareEmailAttachmentFile(file))
      }
      const current = filesRef.current
      const issue = validateOutgoingFiles(current, prepared)
      if (issue) {
        setLocalError(t(issue.key, issue.vars))
        return
      }
      setLocalError('')
      onChange(mergeOutgoingFiles(current, prepared))
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : t('outreach.attachTypeBlocked', { name: 'file' }),
      )
    } finally {
      setPreparing(false)
    }
  }
  applyIncomingRef.current = applyIncoming

  const onPick = (list: FileList | null) => {
    void applyIncoming(list ? Array.from(list) : [])
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    void applyIncoming(Array.from(e.dataTransfer.files || []))
  }

  useEffect(() => {
    const root =
      rootRef.current?.closest(
        '.crm-email-reply-compose, .crm-outreach-form, .crm-outreach',
      ) || rootRef.current
    if (!root) return
    const onPaste = (event: Event) => {
      if (disabled) return
      const clip = event as ClipboardEvent
      const incoming = filesFromClipboard(clip)
      if (!incoming.length) return
      clip.preventDefault()
      void applyIncomingRef.current(incoming)
    }
    root.addEventListener('paste', onPaste)
    return () => root.removeEventListener('paste', onPaste)
  }, [disabled])

  return (
    <div className="crm-field crm-email-attach" ref={rootRef}>
      <span className="crm-label">{t('outreach.attach')}</span>
      <div
        className={
          dragOver
            ? 'crm-email-attach-drop crm-email-attach-drop--over'
            : 'crm-email-attach-drop'
        }
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="crm-email-attach-toolbar">
          <label className="btn btn-ghost crm-email-attach-pick">
            {t('outreach.attachAdd')}
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept={EMAIL_ATTACH_ACCEPT}
              disabled={disabled || preparing || files.length >= EMAIL_ATTACH_MAX_FILES}
              onChange={(e) => onPick(e.target.files)}
            />
          </label>
          {files.length > 0 ? (
            <span className="crm-muted">
              {t('outreach.attachCount', { n: String(files.length) })}
            </span>
          ) : null}
        </div>
        {files.length > 0 ? (
          <ul className="crm-email-attach-list">
            {files.map((file, index) => {
              const name = sanitizeAttachmentFilename(file.name)
              const kind = isPdfAttachment(file)
                ? 'PDF'
                : isImageAttachment(file)
                  ? t('outreach.attachImageKind')
                  : ''
              return (
                <li key={`${name}:${file.size}:${file.lastModified}:${index}`}>
                  <AttachmentThumb file={file} />
                  <span className="crm-email-attach-name" title={name}>
                    {name}
                  </span>
                  <span className="crm-muted crm-email-attach-size">
                    {kind ? `${kind} · ` : ''}
                    {formatAttachBytes(file.size)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost crm-email-attach-remove"
                    disabled={disabled || preparing}
                    onClick={() => {
                      setLocalError('')
                      onChange(files.filter((_, i) => i !== index))
                    }}
                    aria-label={t('outreach.attachRemove', { name })}
                  >
                    {t('outreach.attachRemoveShort')}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="crm-muted crm-email-attach-empty">{t('outreach.attachEmpty')}</p>
        )}
      </div>
      <p className="crm-muted crm-email-attach-hint">{t('outreach.attachHint')}</p>
      {preparing ? (
        <p className="crm-muted" role="status">
          {t('outreach.attachPreparing')}
        </p>
      ) : null}
      {files.length > 0 ? (
        <p className="crm-muted crm-email-attach-schedule-note">
          {t('outreach.attachScheduleNote')}
        </p>
      ) : null}
      {localError ? (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {localError}
        </p>
      ) : null}
    </div>
  )
}

export function EmailMessageAttachments({
  items,
}: {
  items: OutreachAttachmentMeta[]
}) {
  const { t } = useCrmI18n()
  if (!items.length) return null
  return (
    <p className="crm-email-attach-sent">
      <span className="crm-email-attach-sent-label">{t('thread.attachments')}:</span>{' '}
      {items.map((item, i) => (
        <span key={`${item.filename}:${i}`}>
          {i > 0 ? ', ' : ''}
          <span className="crm-email-attach-sent-name">{item.filename}</span>
          {item.size > 0 ? (
            <span className="crm-muted"> ({formatAttachBytes(item.size)})</span>
          ) : null}
        </span>
      ))}
    </p>
  )
}
