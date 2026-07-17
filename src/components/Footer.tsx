import { memo } from 'react'

export const Footer = memo(function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <span className="footer-brand">IOM — Interactive Object Media</span>
      <div className="footer-links">
        <a href="/blog">Blog</a>
        <a href="/client-login">Login</a>
        <a href="/crm-demo">CRM Demo</a>
        <a href="mailto:contact@iobjectm.com">contact@iobjectm.com</a>
        <span>© {year} IOM. All rights reserved.</span>
      </div>
    </footer>
  )
})
