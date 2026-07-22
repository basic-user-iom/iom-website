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
  const { t, demo } = useCrmI18n()
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
            items={[
              t('guide.what1'),
              t('guide.what2'),
              t('guide.what3'),
              t('guide.what4'),
              t('guide.what5'),
              t('guide.what6'),
              t('guide.what7'),
              t('guide.what8'),
              t('guide.what9'),
              t('guide.what10'),
            ]}
          />
          <GuideSection
            heading={t('guide.navHeading')}
            text={t('guide.navText')}
            items={[
              t('guide.nav1'),
              t('guide.nav2'),
              t('guide.nav3'),
              t('guide.nav4'),
              t('guide.nav5'),
              t('guide.nav6'),
              t('guide.nav7'),
              t('guide.nav8'),
              t('guide.nav9'),
              t('guide.nav10'),
            ]}
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
              t('guide.start5'),
            ]}
          />
          <GuideSection
            heading={t('guide.pipeHeading')}
            items={[
              t('guide.pipe1'),
              t('guide.pipe2'),
              t('guide.pipe3'),
              t('guide.pipe4'),
              t('guide.pipe5'),
            ]}
          />
          <GuideSection
            heading={t('guide.outreachHeading')}
            text={demo ? t('guide.outreachDemoText') : t('guide.outreachText')}
            items={
              demo
                ? [
                    t('guide.outreachDemo1'),
                    t('guide.outreachDemo2'),
                    t('guide.outreachDemo3'),
                    t('guide.outreachDemo4'),
                    t('guide.outreachDemo5'),
                    t('guide.outreachDemo6'),
                    t('guide.outreach6'),
                    t('guide.outreach7'),
                  ]
                : [
                    t('guide.outreach1'),
                    t('guide.outreach2'),
                    t('guide.outreach3'),
                    t('guide.outreach4'),
                    t('guide.outreach5'),
                    t('guide.outreach6'),
                    t('guide.outreach7'),
                  ]
            }
          />
          <GuideSection
            heading={t('guide.calendarHeading')}
            text={t('guide.calendarText')}
            items={[t('guide.calendar1'), t('guide.calendar2'), t('guide.calendar3')]}
          />
          <GuideSection
            heading={t('guide.commHeading')}
            text={t('guide.commText')}
            items={[t('guide.comm1'), t('guide.comm2'), t('guide.comm3')]}
          />
          <GuideSection
            heading={t('guide.findHeading')}
            items={[t('guide.find1'), t('guide.find2'), t('guide.find3')]}
          />
          <GuideSection
            heading={t('guide.chatgptHeading')}
            text={t('guide.chatgptText')}
            items={[t('guide.chatgpt1'), t('guide.chatgpt2'), t('guide.chatgpt3')]}
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
            heading={t('guide.notesHeading')}
            text={t('guide.notesText')}
            items={[
              t('guide.notes1'),
              t('guide.notes2'),
              t('guide.notes3'),
              t('guide.notes4'),
              t('guide.notes5'),
            ]}
          />
          <GuideSection
            heading={t('guide.recordingsHeading')}
            text={
              demo ? t('guide.recordingsDemoText') : t('guide.recordingsText')
            }
            items={
              demo
                ? [
                    t('guide.recordingsDemo1'),
                    t('guide.recordingsDemo2'),
                    t('guide.recordingsDemo3'),
                    t('guide.recordingsDemo4'),
                  ]
                : [
                    t('guide.recordings1'),
                    t('guide.recordings2'),
                    t('guide.recordings3'),
                    t('guide.recordings4'),
                    t('guide.recordings5'),
                  ]
            }
          />
          <GuideSection
            heading={t('guide.demosHeading')}
            text={t('guide.demosText')}
            items={[t('guide.demos1'), t('guide.demos2'), t('guide.demos3')]}
          />
          <GuideSection
            heading={t('guide.blogHeading')}
            text={demo ? t('guide.blogDemoText') : t('guide.blogText')}
            items={
              demo
                ? [
                    t('guide.blogDemo1'),
                    t('guide.blogDemo2'),
                    t('guide.blogDemo3'),
                    t('guide.blogDemo4'),
                    t('guide.blogDemo5'),
                  ]
                : [
                    t('guide.blog1'),
                    t('guide.blog2'),
                    t('guide.blog3'),
                    t('guide.blog4'),
                    t('guide.blog5'),
                  ]
            }
          />
          <GuideSection
            heading={t('guide.linksHeading')}
            text={demo ? t('guide.linksDemoText') : t('guide.linksText')}
            items={
              demo
                ? [
                    t('guide.linksDemo1'),
                    t('guide.linksDemo2'),
                    t('guide.linksDemo3'),
                    t('guide.linksDemo4'),
                  ]
                : [
                    t('guide.links1'),
                    t('guide.links2'),
                    t('guide.links3'),
                    t('guide.links4'),
                  ]
            }
          />
          <GuideSection
            heading={t('guide.seoHeading')}
            text={demo ? t('guide.seoDemoText') : t('guide.seoText')}
            items={
              demo
                ? [t('guide.seoDemo1'), t('guide.seoDemo2'), t('guide.seoDemo3')]
                : [t('guide.seo1'), t('guide.seo2'), t('guide.seo3')]
            }
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
