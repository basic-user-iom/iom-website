import type { MouseEvent } from 'react'
import { useEffect, useId, useState } from 'react'
import { BrandMark } from './BrandMark'
import { NAV } from './data/site'
import {
  HERO_DEFAULT_VOLUME,
  onHeroSoundStatus,
  requestHeroSoundToggle,
  requestHeroSoundVolume,
} from './heroSound'
import { useScrolled } from './hooks'
import { LanguageSwitcher } from './i18n/LanguageSwitcher'
import { useLocale } from './i18n/LocaleContext'
import { formatMessage } from './i18n/messages'
import { LINAR_CONFIGURATOR_HREF, openLinarConfigurator } from './openLinar'
import { navigate } from './router'

type Props = {
  transparent?: boolean
}

export function Header({ transparent = false }: Props) {
  const { t } = useLocale()
  const scrolled = useScrolled(80)
  const compact = scrolled || !transparent
  const [open, setOpen] = useState(false)
  const [soundAvailable, setSoundAvailable] = useState(false)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(HERO_DEFAULT_VOLUME)
  const menuId = useId()
  const volumeId = useId()

  useEffect(() => {
    document.body.classList.toggle('dk-lock', open)
    return () => document.body.classList.remove('dk-lock')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    return onHeroSoundStatus((status) => {
      setSoundAvailable(status.available)
      setMuted(status.muted)
      setVolume(status.volume)
    })
  }, [])

  const onNav = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    setOpen(false)
    navigate(href)
  }

  const soundControls = soundAvailable ? (
    <div className="dk-header__sound-group">
      <button
        type="button"
        className={`dk-header__sound${muted ? '' : ' is-on'}`}
        onClick={() => requestHeroSoundToggle()}
        aria-pressed={!muted}
      >
        {muted ? t.actions.unmute : t.actions.mute}
      </button>
      <label className="dk-header__volume" htmlFor={volumeId}>
        <span className="dk-sr">{t.actions.volume}</span>
        <input
          id={volumeId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          aria-valuetext={formatMessage(t.a11y.volumePercent, { n: volume })}
          onChange={(e) => requestHeroSoundVolume(Number(e.target.value))}
        />
        <span className="dk-header__volume-value" aria-hidden="true">
          {volume}%
        </span>
      </label>
    </div>
  ) : null

  return (
    <header className={`dk-header${compact ? ' is-compact' : ''}${open ? ' is-open' : ''}`}>
      <div className="dk-header__bar">
        <BrandMark size={compact ? 'nav' : 'hero'} withTagline={!compact} />
        <nav className="dk-header__nav" aria-label={t.a11y.primaryNav}>
          {NAV.map((item) => (
            <a key={item.id} href={item.href} onClick={onNav(item.href)}>
              {t.nav[item.id]}
            </a>
          ))}
        </nav>
        <div className="dk-header__actions">
          <LanguageSwitcher />
          {soundControls}
          <a className="dk-header__cta" href={LINAR_CONFIGURATOR_HREF} onClick={openLinarConfigurator}>
            {t.actions.configureLinar}
          </a>
        </div>
        <button
          className="dk-header__menu"
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="dk-header__menu-label">{open ? t.actions.close : t.actions.menu}</span>
          <span className="dk-header__menu-icon" aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
      </div>

      <div className="dk-menu" id={menuId} hidden={!open}>
        <nav className="dk-menu__nav" aria-label={t.a11y.mobileNav}>
          {NAV.map((item) => (
            <a key={item.id} href={item.href} onClick={onNav(item.href)}>
              {t.nav[item.id]}
            </a>
          ))}
          <LanguageSwitcher />
          {soundAvailable ? (
            <div className="dk-menu__sound-block">
              <button
                type="button"
                className="dk-menu__sound"
                onClick={() => requestHeroSoundToggle()}
                aria-pressed={!muted}
              >
                {muted ? t.actions.unmuteFilm : t.actions.muteFilm}
              </button>
              <label className="dk-menu__volume">
                <span>
                  {t.actions.volume} {volume}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={volume}
                  onChange={(e) => requestHeroSoundVolume(Number(e.target.value))}
                />
              </label>
            </div>
          ) : null}
          <a className="dk-menu__cta" href={LINAR_CONFIGURATOR_HREF} onClick={openLinarConfigurator}>
            {t.actions.configureLinar}
          </a>
        </nav>
      </div>
    </header>
  )
}
