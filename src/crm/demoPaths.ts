/** Path helper only — keep free of demoStore / blog seed data. */

export function isCrmDemoPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/crm-demo'
}
