/**
 * Email-safe HTML wrapper for CRM outreach (tables + inline CSS).
 * Avoids flex/grid/animations so Gmail/Outlook stay intact.
 */

const SITE = 'https://iobjectm.com'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function linkifyEscaped(escaped) {
  return escaped.replace(
    /(https?:\/\/[^\s<&]+)/g,
    '<a href="$1" style="color:#c4a574;text-decoration:underline;">$1</a>',
  )
}

function bodyToHtml(plainBody) {
  const trimmed = String(plainBody || '').trim()
  if (!trimmed) return ''
  const paragraphs = trimmed.split(/\n{2,}/)
  return paragraphs
    .map((block) => {
      const lines = block.split(/\n/).map((line) => linkifyEscaped(escapeHtml(line)))
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2a2a2a;">${lines.join('<br>')}</p>`
    })
    .join('')
}

/**
 * @param {{ subject: string, body: string, recipientName?: string }} opts
 */
export function renderOutreachEmailHtml(opts) {
  const subject = escapeHtml(opts.subject || '')
  const bodyHtml = bodyToHtml(opts.body)
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f1ec;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f1ec;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#faf9f6;border:1px solid #e4e0d8;">
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #e4e0d8;background-color:#1a1a1a;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:0.08em;color:#f5f0e8;">IOM</p>
              <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.04em;color:#b8b0a4;text-transform:uppercase;">Interactive Object Media</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;font-family:Arial,Helvetica,sans-serif;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color:#1a1a1a;">
                    <a href="${SITE}/" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.04em;color:#f5f0e8;text-decoration:none;text-transform:uppercase;">View IOM work</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #e4e0d8;background-color:#f0ede6;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#6a655c;">
                IOM — Interactive Object Media · <a href="${SITE}/" style="color:#8a7a5c;text-decoration:none;">iobjectm.com</a>
              </p>
              <p style="margin:0;font-size:11px;line-height:1.4;color:#8a857c;">
                © ${year} IOM. Sent from Lead CRM via contact@iobjectm.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function renderOutreachPlainText(body) {
  const text = String(body || '').trim()
  if (!text) return ''
  return `${text}\n\n—\nIOM — Interactive Object Media\n${SITE}/`
}
