import { memo } from 'react'
import { useSiteI18n } from '../i18n'

export const Footer = memo(function Footer() {
  const { t, href } = useSiteI18n()
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <div className="footer-brand-block">
        <span className="footer-brand">{t('footer.brand')}</span>
        <p className="footer-entity">{t('footer.entity')}</p>
      </div>
      <div className="footer-links">
        <a href={href('/#about')}>{t('footer.about')}</a>
        <a href={href('/#clients')}>{t('footer.clients')}</a>
        <a href={href('/#360')}>{t('footer.caseStudies')}</a>
        <a href={href('/blog')}>{t('footer.blog')}</a>
        <a href={href('/#contact')}>{t('footer.contact')}</a>
        <a href="/client-login">{t('footer.login')}</a>
        <a href="/crm-demo">{t('footer.crmDemo')}</a>
        <a href={href('/privacy')}>{t('footer.privacy')}</a>
        <a href={href('/terms')}>{t('footer.terms')}</a>
        <a href={href('/cookies')}>{t('footer.cookies')}</a>
        <a href="mailto:contact@iobjectm.com">contact@iobjectm.com</a>
        <span>{t('footer.rights', { year })}</span>
      </div>
    </footer>
  )
})
