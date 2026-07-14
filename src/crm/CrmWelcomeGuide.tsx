import { useEffect, useId, useRef } from 'react'
import { useCrmI18n } from './i18n'

export const CRM_WELCOME_SEEN_KEY = 'iom-crm-welcome-seen'

export function hasSeenCrmWelcome(): boolean {
  try {
    return localStorage.getItem(CRM_WELCOME_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markCrmWelcomeSeen(): void {
  try {
    localStorage.setItem(CRM_WELCOME_SEEN_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}

interface CrmWelcomeGuideProps {
  open: boolean
  onClose: () => void
}

function GuideSection({
  heading,
  text,
  items,
}: {
  heading: string
  text?: string
  items: string[]
}) {
  return (
    <section className="crm-guide-section">
      <h3 className="crm-guide-heading">{heading}</h3>
      {text ? <p className="crm-guide-text">{text}</p> : null}
      <ul className="crm-guide-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export function CrmWelcomeGuide({ open, onClose }: CrmWelcomeGuideProps) {
  const { t } = useCrmI18n()
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="crm-guide-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="crm-guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="crm-guide-header">
          <div>
            <p className="crm-kicker">{t('guide.kicker')}</p>
            <h2 id={titleId} className="crm-guide-title">
              {t('guide.title')}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost crm-guide-x"
            aria-label={t('guide.close')}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="crm-guide-body">
          <GuideSection
            heading={t('guide.whatHeading')}
            text={t('guide.whatText')}
            items={[t('guide.what1'), t('guide.what2'), t('guide.what3'), t('guide.what4')]}
          />
          <GuideSection
            heading={t('guide.navHeading')}
            text={t('guide.navText')}
            items={[t('guide.nav1'), t('guide.nav2'), t('guide.nav3'), t('guide.nav4')]}
          />
          <GuideSection
            heading={t('guide.leadHeading')}
            text={t('guide.leadText')}
            items={[t('guide.lead1'), t('guide.lead2'), t('guide.lead3')]}
          />
          <GuideSection
            heading={t('guide.pipelineHeading')}
            text={t('guide.pipelineText')}
            items={[t('guide.pipeline1'), t('guide.pipeline2'), t('guide.pipeline3')]}
          />
          <GuideSection
            heading={t('guide.tempHeading')}
            text={t('guide.tempText')}
            items={[
              t('guide.temp1'),
              t('guide.temp2'),
              t('guide.temp3'),
              t('guide.temp4'),
            ]}
          />
          <GuideSection
            heading={t('guide.fieldsHeading')}
            items={[t('guide.fields1'), t('guide.fields2'), t('guide.fields3')]}
          />
          <GuideSection
            heading={t('guide.startHeading')}
            items={[
              t('guide.start1'),
              t('guide.start2'),
              t('guide.start3'),
              t('guide.start4'),
            ]}
          />
          <GuideSection
            heading={t('guide.pipeHeading')}
            items={[
              t('guide.pipe1'),
              t('guide.pipe2'),
              t('guide.pipe3'),
              t('guide.pipe4'),
            ]}
          />
          <GuideSection
            heading={t('guide.commHeading')}
            items={[t('guide.comm1'), t('guide.comm2'), t('guide.comm3')]}
          />
          <GuideSection
            heading={t('guide.findHeading')}
            items={[t('guide.find1'), t('guide.find2'), t('guide.find3')]}
          />
          <GuideSection
            heading={t('guide.projectsHeading')}
            text={t('guide.projectsText')}
            items={[
              t('guide.projects1'),
              t('guide.projects2'),
              t('guide.projects3'),
              t('guide.projects4'),
              t('guide.projects5'),
            ]}
          />
          <GuideSection
            heading={t('guide.timeHeading')}
            text={t('guide.timeText')}
            items={[
              t('guide.time1'),
              t('guide.time2'),
              t('guide.time3'),
              t('guide.time4'),
            ]}
          />
          <GuideSection
            heading={t('guide.ideasHeading')}
            text={t('guide.ideasText')}
            items={[
              t('guide.ideas1'),
              t('guide.ideas2'),
              t('guide.ideas3'),
              t('guide.ideas4'),
            ]}
          />
          <GuideSection
            heading={t('guide.photoHeading')}
            items={[t('guide.photo1'), t('guide.photo2'), t('guide.photo3')]}
          />
          <GuideSection
            heading={t('guide.uiHeading')}
            items={[t('guide.ui1'), t('guide.ui2')]}
          />

          <p className="crm-guide-hint">{t('guide.hint')}</p>
        </div>

        <footer className="crm-guide-footer">
          <button
            ref={closeRef}
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            {t('guide.gotIt')}
          </button>
        </footer>
      </div>
    </div>
  )
}
