/**
 * Client-side mirror of api/lib/outreach-email-html.js for CRM preview.
 * Keep in sync when changing the send template.
 */

const SITE = 'https://iobjectm.com'
const LOGO_GIF = `${SITE}/assets/email/iom-raven.gif`
const FONT_DISPLAY = "'Syne', Arial, Helvetica, sans-serif"
const FONT_BODY = "'IBM Plex Sans', Arial, Helvetica, sans-serif"

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function linkifyEscaped(escaped: string): string {
  return escaped.replace(
    /(https?:\/\/[^\s<&]+)/g,
    '<a href="$1" style="color:#00b8cc;text-decoration:underline;">$1</a>',
  )
}

function bodyToHtml(plainBody: string): string {
  const trimmed = String(plainBody || '').trim()
  if (!trimmed) return ''
  return trimmed
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split(/\n/)
        .map((line) => linkifyEscaped(escapeHtml(line)))
      return `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:#1c1c22;">${lines.join('<br>')}</p>`
    })
    .join('')
}

export function renderOutreachEmailHtml(opts: {
  subject: string
  body: string
}): string {
  const subject = escapeHtml(opts.subject || '')
  const bodyHtml = bodyToHtml(opts.body)
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Syne:wght@600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#ececf2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ececf2;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#f7f7fa;border:1px solid #d8d8e0;">
          <tr>
            <td style="padding:22px 28px;background-color:#08080a;border-bottom:1px solid rgba(0,229,255,0.18);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="56" valign="middle" style="padding-right:14px;">
                    <img src="${LOGO_GIF}" width="48" height="48" alt="IOM" style="display:block;border:0;width:48px;height:48px;" />
                  </td>
                  <td valign="middle">
                    <p style="margin:0;font-family:${FONT_DISPLAY};font-size:22px;font-weight:800;letter-spacing:0.06em;line-height:1.1;color:#ececf2;">IOM</p>
                    <p style="margin:4px 0 0;font-family:${FONT_BODY};font-size:11px;font-weight:500;letter-spacing:0.08em;line-height:1.3;color:#8b8b9a;text-transform:uppercase;">Interactive Object Media</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">${bodyHtml}</td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color:#08080a;border:1px solid rgba(0,229,255,0.35);">
                    <a href="${SITE}/" style="display:inline-block;padding:12px 22px;font-family:${FONT_BODY};font-size:12px;font-weight:600;letter-spacing:0.08em;color:#00e5ff;text-decoration:none;text-transform:uppercase;">View IOM work</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #d8d8e0;background-color:#e8e8ee;">
              <p style="margin:0 0 4px;font-family:${FONT_BODY};font-size:12px;line-height:1.5;color:#6a6a78;">
                IOM — Interactive Object Media · <a href="${SITE}/" style="color:#007a8a;text-decoration:none;">iobjectm.com</a>
              </p>
              <p style="margin:0;font-family:${FONT_BODY};font-size:11px;line-height:1.4;color:#8b8b9a;">
                © ${year} IOM · contact@iobjectm.com
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
