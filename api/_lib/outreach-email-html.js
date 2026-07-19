/**
 * Email-safe HTML wrapper for CRM outreach (tables + inline CSS).
 * Avoids flex/grid/CSS animations so Gmail/Outlook stay intact.
 * Motion: hosted GIF logo + raven-flight strip (Outlook shows first frames).
 */

const SITE = 'https://iobjectm.com'
/** Animated circular GIF. First frame = last video frame (raven) for Outlook. */
const LOGO_GIF = `${SITE}/assets/email/iom-raven.gif`
/** Static circular PNG = last frame of site raven video. */
const LOGO_PNG = `${SITE}/assets/email/iom-raven.png`
/** Narrow raven-flight strip above footer (Outlook shows first frame). */
const FLIGHT_GIF = `${SITE}/assets/email/iom-raven-flight.gif`
/** Soft cloud header bg sampled from same flight recording. */
const HEADER_BG = `${SITE}/assets/email/iom-email-header-bg.png`
const FONT_DISPLAY = "'Syne', Arial, Helvetica, sans-serif"
const FONT_BODY = "'IBM Plex Sans', Arial, Helvetica, sans-serif"

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
    '<a href="$1" style="color:#00b8cc;text-decoration:underline;">$1</a>',
  )
}

function bodyToHtml(plainBody) {
  const trimmed = String(plainBody || '').trim()
  if (!trimmed) return ''
  const paragraphs = trimmed.split(/\n{2,}/)
  return paragraphs
    .map((block) => {
      const lines = block.split(/\n/).map((line) => linkifyEscaped(escapeHtml(line)))
      return `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:#1c1c22;">${lines.join('<br>')}</p>`
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
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <!--[if !mso]><!-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Syne:wght@600;700;800&display=swap" rel="stylesheet">
  <!--<![endif]-->
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Syne:wght@600;700;800&display=swap');
  </style>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#ececf2;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ececf2;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#f7f7fa;border:1px solid #d8d8e0;">
          <!-- Header: raven + IOM (cloud gradient matching flight strip) -->
          <tr>
            <td background="${HEADER_BG}" bgcolor="#0a1420" style="padding:22px 28px;background-color:#0a1420;background-image:linear-gradient(165deg,#060a10 0%,#0c1828 42%,#163048 100%),url('${HEADER_BG}');background-size:cover;background-position:center;border-bottom:1px solid rgba(0,229,255,0.18);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="56" valign="middle" style="padding-right:14px;">
                    <a href="${SITE}/" style="text-decoration:none;">
                      <img src="${LOGO_GIF}" width="48" height="48" alt="IOM" style="display:block;border:0;width:48px;height:48px;" />
                    </a>
                  </td>
                  <td valign="middle">
                    <p style="margin:0;font-family:${FONT_DISPLAY};font-size:22px;font-weight:800;letter-spacing:0.06em;line-height:1.1;color:#ececf2;">IOM</p>
                    <p style="margin:4px 0 0;font-family:${FONT_BODY};font-size:11px;font-weight:500;letter-spacing:0.08em;line-height:1.3;color:#a8b0bc;text-transform:uppercase;">Interactive Object Media</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 8px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:8px 32px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color:#08080a;border:1px solid rgba(0,229,255,0.35);">
                    <a href="${SITE}/" style="display:inline-block;padding:12px 22px;font-family:${FONT_BODY};font-size:12px;font-weight:600;letter-spacing:0.08em;color:#00e5ff;text-decoration:none;text-transform:uppercase;">View IOM work</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Raven flight strip (decorative; Outlook shows first frame) -->
          <tr>
            <td style="padding:0;line-height:0;font-size:0;background-color:#08080a;">
              <img src="${FLIGHT_GIF}" width="560" height="61" alt="" style="display:block;border:0;width:100%;max-width:600px;height:auto;" />
            </td>
          </tr>
          <!-- Footer -->
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
        <!-- Hidden PNG preload hint for clients that block GIF (rare) -->
        <div style="display:none;max-height:0;overflow:hidden;">
          <img src="${LOGO_PNG}" width="1" height="1" alt="" />
        </div>
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
