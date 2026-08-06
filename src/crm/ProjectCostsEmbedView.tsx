import { useCallback, useState } from 'react'
import { SITE_ORIGIN } from '../seo/siteConfig'
import { useCrmI18n } from './i18n'

const SHARE_URL = `${SITE_ORIGIN}/project-costs`
const EMBED_SRC = '/project-costs?embed=1'

/** Live staff CRM — iframe the public planning page without leaving the shell. */
export function ProjectCostsEmbedView() {
  const { t } = useCrmI18n()
  const [copied, setCopied] = useState(false)

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [])

  return (
    <div className="crm-pc-embed">
      <div className="crm-pc-embed-toolbar">
        <p className="crm-pc-embed-url" title={SHARE_URL}>
          {SHARE_URL}
        </p>
        <div className="crm-pc-embed-actions">
          <button type="button" className="btn btn-primary" onClick={() => void copyLink()}>
            {copied ? t('projectCosts.copied') : t('projectCosts.copyLink')}
          </button>
          <a
            className="btn btn-ghost"
            href={SHARE_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t('projectCosts.openTab')}
          </a>
        </div>
      </div>
      <iframe
        className="crm-pc-embed-frame"
        src={EMBED_SRC}
        title={t('projectCosts.iframeTitle')}
      />
    </div>
  )
}
