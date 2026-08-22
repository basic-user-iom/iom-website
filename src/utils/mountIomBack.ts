/** Load the shared Back to IOM pill on SPA demo / tool routes. */
export function mountIomBackScript(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('iom-back-script')) return
  const script = document.createElement('script')
  script.id = 'iom-back-script'
  script.src = '/demos/iom-back.js'
  document.body.appendChild(script)
}
