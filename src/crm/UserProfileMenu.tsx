import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { removeUserAvatar, uploadUserAvatar } from './api'
import { validateAvatarSource } from './avatarCrop'
import { AvatarCropDialog } from './AvatarCropDialog'
import { useCrmI18n } from './i18n'
import type { CrmUser } from './types'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

export function UserAvatar({
  photoUrl,
  name,
  size = 'sm',
}: {
  photoUrl: string | null | undefined
  name: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const initial = (name.trim().charAt(0) || '?').toUpperCase()
  return (
    <div className={`crm-avatar crm-avatar--${size}${photoUrl ? '' : ' is-empty'}`}>
      {photoUrl ? (
        <img src={photoUrl} alt="" className="crm-avatar-img" />
      ) : (
        <span className="crm-avatar-initial" aria-hidden="true">
          {initial}
        </span>
      )}
    </div>
  )
}

interface UserProfileMenuProps {
  user: CrmUser
  onUserChange: (user: CrmUser) => void
}

export function UserProfileMenu({ user, onUserChange }: UserProfileMenuProps) {
  const { t } = useCrmI18n()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cropFile, setCropFile] = useState<File | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuId = useId()
  const label = user.email.split('@')[0] || user.email

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (cropFile) return
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cropFile) setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, cropFile])

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const validation = validateAvatarSource(file)
    if (validation === 'invalid') {
      setError(t('profile.invalidImage'))
      return
    }
    if (validation === 'tooLarge') {
      setError(t('profile.tooLarge'))
      return
    }
    setError('')
    setCropFile(file)
  }

  const handleCropped = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const avatar_url = await uploadUserAvatar(file)
      onUserChange({ ...user, avatar_url })
      setCropFile(null)
      setOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.uploadFailed')
      setError(message)
      throw new Error(message)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    setError('')
    try {
      await removeUserAvatar()
      onUserChange({ ...user, avatar_url: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.removeFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="crm-profile" ref={rootRef}>
      <button
        type="button"
        className="crm-profile-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="dialog"
        title={t('profile.title')}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        <UserAvatar photoUrl={user.avatar_url} name={label} size="sm" />
        <span className="crm-user">{user.email}</span>
      </button>

      {open && (
        <div
          className="crm-profile-menu"
          id={menuId}
          role="dialog"
          aria-label={t('profile.title')}
        >
          <div className="crm-photo-row">
            <UserAvatar photoUrl={user.avatar_url} name={label} size="md" />
            <div className="crm-photo-actions">
              <p className="crm-profile-menu-title">{t('profile.photo')}</p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="crm-photo-input"
                disabled={busy}
                onChange={handleFilePick}
              />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {user.avatar_url ? t('profile.change') : t('profile.upload')}
              </button>
              {user.avatar_url && (
                <button
                  type="button"
                  className="btn btn-ghost crm-danger"
                  disabled={busy}
                  onClick={() => void handleRemove()}
                >
                  {t('profile.remove')}
                </button>
              )}
              <p className="crm-photo-hint">{t('profile.hint')}</p>
              {error && (
                <p className="crm-feedback crm-feedback--error" role="alert">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {cropFile && (
        <AvatarCropDialog
          file={cropFile}
          onCancel={() => {
            if (!busy) setCropFile(null)
          }}
          onConfirm={handleCropped}
        />
      )}
    </div>
  )
}
