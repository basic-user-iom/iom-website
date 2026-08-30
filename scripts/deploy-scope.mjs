const NAMED_SCOPES = {
  'automotive-studio': [
    'automotive-studio/',
    'public/demos/automotive-studio/',
    'scripts/build-automotive-studio.mjs',
  ],
  'building-viewer': [
    '.vercelignore',
    'building-viewer/',
    'public/demos/building-viewer/',
    'public/demos/icm-building/',
    'public/models/manifest.json',
    'public/models/camera-views.json',
    'public/models/icm-ext/',
    'public/models/icm-anim-2025/model-web.glb',
    'public/models/icm-anim-2025/model-quest.glb',
    'public/models/icm-anim-2025/collision.glb',
    'public/models/icm-anim-2025/collision-activation-v1.json',
    'public/models/icm-anim-2025/collision-coverage-v1.json',
    'public/models/icm-anim-2025/spatial-meta.json',
    'public/models/icm-anim-2025/animations.glb',
    'public/robots.txt',
    'public/sitemap.xml',
    'scripts/build-building-viewer.mjs',
    'scripts/deploy-production.mjs',
    'scripts/deploy-scope.mjs',
    'scripts/generate-sitemap.mjs',
    'scripts/patch-demo-back-links.mjs',
    'src/analytics/track.ts',
    'src/crm/DemosView.tsx',
    'src/crm/i18n.tsx',
    'vercel.json',
  ],
  'panorama-360': [
    'public/demos/panorama-360/',
    'scripts/build-panorama-360.mjs',
  ],
  'streets-gl': [
    'public/demos/streets-gl/',
    'scripts/build-streets-gl.mjs',
  ],
  deployment: [
    '.cursor/hooks.json',
    '.cursor/hooks/block-unsafe-deploy.mjs',
    '.vercelignore',
    'AGENTS.md',
    'DEPLOY.md',
    'package.json',
    'scripts/build-building-viewer.mjs',
    'scripts/cleanup-deploy-stage.mjs',
    'scripts/deploy-production.mjs',
    'scripts/deploy-scope.mjs',
    'scripts/pre-deploy-check.mjs',
    'scripts/test-deploy-safety.mjs',
    'vercel.json',
  ],
  crm: [
    'src/crm/',
    'api/crm-send-email.js',
    'api/_lib/crm-auto-reply.js',
    'api/_lib/crm-auto-reply.test.js',
    'api/_lib/crm-inbound-ingest.js',
    'api/_lib/crm-send-outreach.js',
    'api/_lib/email-attachments.js',
    'scripts/deploy-scope.mjs',
    'scripts/test-deploy-safety.mjs',
  ],
}

const PROJECT_SCOPE_RULES = {
  'harp-configurator-demo': [
    '.vercelignore',
    'harp-configurator-demo/',
    'public/demos/harp-configurator-demo/',
    'public/robots.txt',
    'scripts/build-harp-configurator-demo.mjs',
    'scripts/deploy-scope.mjs',
    'scripts/generate-sitemap.mjs',
    'scripts/patch-demo-back-links.mjs',
    'src/crm/DemosView.tsx',
  ],
  'dukta-linar-concept': [
    'demos/dukta-linar-concept/',
    'scripts/deploy-scope.mjs',
    'src/demo/dukta-linar-concept/',
  ],
  'precision-object': [
    'demos/precision-object/',
    'scripts/deploy-scope.mjs',
    'src/demo/precision-object/',
  ],
  'floating-stone': [
    'demos/floating-stone/',
    'public/demos/iom-back.js',
    'public/models/stone.glb',
    'scripts/deploy-scope.mjs',
    'src/demo/floating-stone/',
  ],
}

const RESERVED_PROJECT_SLUGS = new Set([
  'api',
  'assets',
  'docs',
  'node_modules',
  'public',
  'scripts',
  'src',
  'supabase',
])

export function normalizeDeployPath(file) {
  return String(file || '').replaceAll('\\', '/').replace(/^\.\//, '')
}

function matchesRule(file, rule) {
  const normalized = normalizeDeployPath(file)
  return rule.endsWith('/') ? normalized.startsWith(rule) : normalized === rule
}

export function isValidDemoSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ''))
}

export function isValidProjectSlug(slug) {
  return isValidDemoSlug(slug) && !RESERVED_PROJECT_SLUGS.has(slug)
}

export function matchesDeployScope(file, scope) {
  const normalized = normalizeDeployPath(file)
  if (scope === 'site') return true

  const namedRules = NAMED_SCOPES[scope]
  if (namedRules) return namedRules.some((rule) => matchesRule(normalized, rule))

  if (scope.startsWith('demo:')) {
    const slug = scope.slice('demo:'.length)
    if (!isValidDemoSlug(slug)) return false
    return (
      normalized.startsWith(`public/demos/${slug}/`) ||
      normalized.startsWith(`demos/${slug}/`)
    )
  }

  if (scope.startsWith('project:')) {
    const slug = scope.slice('project:'.length)
    if (!isValidProjectSlug(slug)) return false
    const projectRules = PROJECT_SCOPE_RULES[slug]
    if (projectRules) {
      return projectRules.some((rule) => matchesRule(normalized, rule))
    }
    return (
      normalized.startsWith(`${slug}/`) ||
      normalized.startsWith(`public/demos/${slug}/`) ||
      normalized.startsWith(`demos/${slug}/`) ||
      normalized === `scripts/build-${slug}.mjs`
    )
  }

  return false
}

export function invalidFilesForScope(files, scope) {
  return files
    .map(normalizeDeployPath)
    .filter(Boolean)
    .filter((file) => !matchesDeployScope(file, scope))
}

export function inferDeployScope(files) {
  const normalized = files.map(normalizeDeployPath).filter(Boolean)
  if (normalized.length === 0) return 'redeploy'

  for (const scope of Object.keys(NAMED_SCOPES)) {
    if (normalized.every((file) => matchesDeployScope(file, scope))) return scope
  }

  const demoSlugs = new Set()
  let demoOnly = true
  for (const file of normalized) {
    const match = file.match(/^(?:public\/)?demos\/([^/]+)\//)
    if (!match || !isValidDemoSlug(match[1])) {
      demoOnly = false
      break
    }
    demoSlugs.add(match[1])
  }

  if (demoOnly && demoSlugs.size === 1) {
    const [slug] = demoSlugs
    const scope = `demo:${slug}`
    if (normalized.every((file) => matchesDeployScope(file, scope))) return scope
  }

  for (const slug of Object.keys(PROJECT_SCOPE_RULES)) {
    const scope = `project:${slug}`
    if (normalized.every((file) => matchesDeployScope(file, scope))) return scope
  }

  const projectSlugs = new Set()
  for (const file of normalized) {
    const match =
      file.match(/^(?:public\/)?demos\/([^/]+)\//) ||
      file.match(/^scripts\/build-([a-z0-9]+(?:-[a-z0-9]+)*)\.mjs$/) ||
      file.match(/^([^/]+)\//)
    if (!match || !isValidProjectSlug(match[1])) return null
    projectSlugs.add(match[1])
  }

  if (projectSlugs.size !== 1) return null
  const [slug] = projectSlugs
  const scope = `project:${slug}`
  return normalized.every((file) => matchesDeployScope(file, scope)) ? scope : null
}

export function knownDeployScopes() {
  return [...Object.keys(NAMED_SCOPES), 'demo:<slug>', 'project:<slug>', 'site']
}
