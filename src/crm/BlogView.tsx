import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addBlogAudienceManual,
  catalogImportMissingCount,
  createBlogPost,
  deleteBlogAudience,
  deleteBlogPost,
  demoAddPendingComment,
  importCatalogBlogPosts,
  isBlogSchemaMissing,
  listBlogAudience,
  listBlogComments,
  listBlogPosts,
  setBlogCommentStatus,
  setBlogPostStatus,
  updateBlogAudienceNotes,
  updateBlogPost,
} from './blogApi'
import { isCrmDemoMode } from './demoMode'
import { useCrmI18n } from './i18n'
import {
  renderBlogMarkdown,
  slugifyTitle,
  type BlogAudience,
  type BlogCommentAdmin,
  type BlogCommentStatus,
  type BlogPost,
  type BlogPostInput,
  type BlogPostStatus,
} from '../blog/types'
import { BLOG_ASSET_CACHE_V } from '../blog/posts/demoPostBuilder'
import '../blog/blog.css'

type BlogTab = 'pending' | 'posts' | 'comments' | 'emails'
type EditorMode = 'list' | 'edit'
type BodyPane = 'edit' | 'preview'

function statusLabelKey(status: BlogPostStatus): string {
  switch (status) {
    case 'pending_review':
      return 'blog.statusPendingReview'
    case 'published':
      return 'blog.statusPublished'
    case 'hidden':
      return 'blog.statusHidden'
    default:
      return 'blog.statusDraft'
  }
}

const DEMO_CTA_SNIPPET = `## Try the demo

Open the live build: [Try the demo](/demos/YOUR-DEMO/).

See more in [3D](/#3d) or [get in touch](/#contact).
`

const emptyDraft = (): BlogPostInput => ({
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  cover_image_url: '',
  status: 'draft',
  published_at: null,
  seo_title: '',
  seo_description: '',
  author_name: 'IOM',
  tags: [],
})

/** Markdown image: ![alt](url) or ![alt](url "title") */
const MD_IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

type BlogAttachment = {
  id: string
  kind: 'cover' | 'body'
  label: string
  alt: string
  url: string
  /** Index among body markdown images (0-based), only for kind=body */
  bodyIndex?: number
}

function filenameFromUrl(url: string): string {
  try {
    const path = url.split('?')[0] || url
    const seg = path.split('/').filter(Boolean).pop()
    return seg || 'image.jpg'
  } catch {
    return 'image.jpg'
  }
}

function withCacheBust(url: string, version = String(Date.now())): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  const [base, hash = ''] = trimmed.split('#')
  const bare = (base || '').replace(/([?&])v=[^&]*&?/g, '$1').replace(/[?&]$/, '')
  const joiner = bare.includes('?') ? '&' : '?'
  return `${bare}${joiner}v=${version}${hash ? `#${hash}` : ''}`
}

function extractBodyImages(body: string): { alt: string; url: string; start: number; end: number }[] {
  const out: { alt: string; url: string; start: number; end: number }[] = []
  const re = new RegExp(MD_IMG_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    out.push({
      alt: m[1] || '',
      url: (m[2] || '').trim(),
      start: m.index,
      end: m.index + m[0].length,
    })
  }
  return out
}

function replaceBodyImageUrl(body: string, bodyIndex: number, newUrl: string): string {
  const images = extractBodyImages(body)
  const hit = images[bodyIndex]
  if (!hit) return body
  const slice = body.slice(hit.start, hit.end)
  const replaced = slice.replace(/\(([^)\s]+)((?:\s+"[^"]*")?)\)/, `(${newUrl}$2)`)
  return body.slice(0, hit.start) + replaced + body.slice(hit.end)
}

export function BlogView() {
  const { t } = useCrmI18n()
  const demo = isCrmDemoMode()
  const [tab, setTab] = useState<BlogTab>('pending')
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [comments, setComments] = useState<BlogCommentAdmin[]>([])
  const [audience, setAudience] = useState<BlogAudience[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [mode, setMode] = useState<EditorMode>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<BlogPostInput>(emptyDraft())
  const [tagsText, setTagsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [bodyPane, setBodyPane] = useState<BodyPane>('edit')
  const bodyPreviewHtml = useMemo(() => renderBlogMarkdown(draft.body), [draft.body])
  const [replacingId, setReplacingId] = useState<string | null>(null)
  const [replaceUrlDraft, setReplaceUrlDraft] = useState('')
  const [commentFilter, setCommentFilter] = useState<BlogCommentStatus | 'all'>(
    'pending_moderation',
  )
  const [emailSearch, setEmailSearch] = useState('')
  const [marketingOnly, setMarketingOnly] = useState(false)
  const [manualEmail, setManualEmail] = useState('')
  const [manualName, setManualName] = useState('')

  const pendingPosts = useMemo(
    () => posts.filter((p) => p.status === 'pending_review'),
    [posts],
  )
  const libraryPosts = useMemo(
    () => posts.filter((p) => p.status !== 'pending_review'),
    [posts],
  )
  const missingCatalog = useMemo(() => catalogImportMissingCount(posts), [posts])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [p, c, a] = await Promise.all([
        listBlogPosts(),
        listBlogComments({ status: 'all' }),
        listBlogAudience({ search: emailSearch, marketingOnly }),
      ])
      setPosts(p)
      setComments(c)
      setAudience(a)
    } catch (err) {
      if (isBlogSchemaMissing(err)) setError(t('blog.schemaMissing'))
      else setError(err instanceof Error ? err.message : t('blog.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [emailSearch, marketingOnly, t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredComments = useMemo(() => {
    if (commentFilter === 'all') return comments
    return comments.filter((c) => c.status === commentFilter)
  }, [comments, commentFilter])

  const postTitleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of posts) m.set(p.id, p.title)
    return m
  }, [posts])

  const attachments = useMemo((): BlogAttachment[] => {
    const list: BlogAttachment[] = []
    const cover = draft.cover_image_url.trim()
    if (cover) {
      list.push({
        id: 'cover',
        kind: 'cover',
        label: t('blog.attachCover'),
        alt: draft.title || t('blog.attachCover'),
        url: cover,
      })
    }
    const bodyImgs = extractBodyImages(draft.body)
    bodyImgs.forEach((img, i) => {
      const file = filenameFromUrl(img.url)
      const fromFile = file.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      list.push({
        id: `body-${i}`,
        kind: 'body',
        label: t('blog.attachBody', { n: i + 1 }),
        alt: img.alt || fromFile || t('blog.attachBody', { n: i + 1 }),
        url: img.url,
        bodyIndex: i,
      })
    })
    return list
  }, [draft.body, draft.cover_image_url, draft.title, t])

  const beginReplace = (att: BlogAttachment) => {
    setReplacingId(att.id)
    setReplaceUrlDraft(att.url)
  }

  const cancelReplace = () => {
    setReplacingId(null)
    setReplaceUrlDraft('')
  }

  const applyReplaceUrl = (att: BlogAttachment, nextUrl: string) => {
    const url = nextUrl.trim()
    if (!url) return
    if (att.kind === 'cover') {
      setDraft((d) => ({ ...d, cover_image_url: url }))
    } else if (att.bodyIndex != null) {
      setDraft((d) => ({ ...d, body: replaceBodyImageUrl(d.body, att.bodyIndex!, url) }))
    }
    setReplacingId(null)
    setReplaceUrlDraft('')
  }

  const bustAttachmentCache = (att: BlogAttachment) => {
    applyReplaceUrl(att, withCacheBust(att.url))
  }

  const assetSlug = () => (draft.slug || 'your-slug').trim() || 'your-slug'

  const onPickLocalFile = (slotId: string, file: File | undefined) => {
    if (!file) return
    const slug = assetSlug()
    const suggested = withCacheBust(`/assets/blog/${slug}/${file.name}`)
    setReplaceUrlDraft(suggested)
    setReplacingId(slotId)
    setInfo(t('blog.attachFileHint', { path: `public/assets/blog/${slug}/${file.name}` }))
  }

  const beginAddCover = () => {
    const slug = assetSlug()
    setReplacingId('add-cover')
    setReplaceUrlDraft(`/assets/blog/${slug}/cover.jpg`)
  }

  const applyAddCover = (nextUrl: string) => {
    const url = nextUrl.trim()
    if (!url) return
    setDraft((d) => ({ ...d, cover_image_url: url }))
    setReplacingId(null)
    setReplaceUrlDraft('')
  }

  const insertBodyImageSnippet = () => {
    const slug = assetSlug()
    const n = extractBodyImages(draft.body).length + 1
    const url = `/assets/blog/${slug}/view-${n}.jpg`
    const block = `![Caption](${url})`
    setDraft((d) => {
      const body = d.body.trim() ? `${d.body.replace(/\s*$/, '')}\n\n${block}\n` : `${block}\n`
      return { ...d, body }
    })
    setBodyPane('edit')
    setInfo(t('blog.attachBodyInserted', { path: `public/assets/blog/${slug}/view-${n}.jpg` }))
  }

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setTagsText('')
    setBodyPane('edit')
    setReplacingId(null)
    setReplaceUrlDraft('')
    setMode('edit')
  }

  const openEdit = (post: BlogPost) => {
    setEditingId(post.id)
    setDraft({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      cover_image_url: post.cover_image_url,
      status: post.status,
      published_at: post.published_at,
      seo_title: post.seo_title,
      seo_description: post.seo_description,
      author_name: post.author_name,
      tags: post.tags,
    })
    setTagsText(post.tags.join(', '))
    setBodyPane('edit')
    setReplacingId(null)
    setReplaceUrlDraft('')
    setMode('edit')
  }

  const insertDemoCta = () => {
    setDraft((d) => {
      const block = DEMO_CTA_SNIPPET.trim()
      const body = d.body.trim() ? `${d.body.replace(/\s*$/, '')}\n\n${block}\n` : `${block}\n`
      return { ...d, body }
    })
    setBodyPane('edit')
  }

  const handleSave = async () => {
    if (!draft.title.trim()) {
      setError(t('blog.titleRequired'))
      return
    }
    if (!draft.excerpt.trim()) {
      setError(t('blog.excerptRequired'))
      return
    }
    setSaving(true)
    setError('')
    const input: BlogPostInput = {
      ...draft,
      slug: (draft.slug || slugifyTitle(draft.title)).trim(),
      tags: tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }
    try {
      if (editingId) await updateBlogPost(editingId, input)
      else await createBlogPost(input)
      setMode('list')
      setBodyPane('edit')
      if (input.status === 'pending_review') setTab('pending')
      else setTab('posts')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('blog.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('blog.deleteConfirm'))) return
    try {
      await deleteBlogPost(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('blog.deleteFailed'))
    }
  }

  const handleSetStatus = async (id: string, status: BlogPostStatus) => {
    setStatusBusyId(id)
    setError('')
    setInfo('')
    try {
      await setBlogPostStatus(id, status)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('blog.statusFailed'))
    } finally {
      setStatusBusyId(null)
    }
  }

  const handleImportCatalog = useCallback(async () => {
    setImporting(true)
    setError('')
    setInfo('')
    try {
      const { created, skipped, updated } = await importCatalogBlogPosts()
      setInfo(
        t('blog.importResult')
          .replace('{created}', String(created))
          .replace('{updated}', String(updated))
          .replace('{skipped}', String(skipped)),
      )
      setTab('pending')
      // Leave the editor — otherwise the open draft keeps stale body/cover forever.
      setMode('list')
      setEditingId(null)
      setDraft(emptyDraft())
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('blog.importFailed'))
    } finally {
      setImporting(false)
    }
  }, [refresh, t])

  // Empty CRM → import catalog. Stale covers / missing panorama copy → force sync.
  const autoImportTried = useRef(false)
  useEffect(() => {
    if (loading || autoImportTried.current || importing) return
    const cacheMarker = `?v=${BLOG_ASSET_CACHE_V}`
    const needsCacheBust = posts.some(
      (p) =>
        p.cover_image_url.includes('/assets/blog/') &&
        !p.cover_image_url.includes(cacheMarker),
    )
    const spoutStale = posts.some(
      (p) =>
        p.slug === 'spout' &&
        (!p.body.includes('Also in the 360') ||
          !p.body.includes('iobjectm.com/demos/panorama-360')),
    )
    const ravenPathStale = posts.some(
      (p) =>
        p.slug === 'raven-path' &&
        (!p.body.includes('/#3d') ||
          !/Export path JSON|path JSON/i.test(p.body) ||
          !/Import GLB|GLTF|FBX/i.test(p.body) ||
          p.body.includes('/#software')),
    )
    if (posts.length > 0 && !needsCacheBust && !spoutStale && !ravenPathStale && missingCatalog <= 0)
      return
    if (posts.length === 0 && missingCatalog <= 0) return
    autoImportTried.current = true
    setTab('pending')
    void handleImportCatalog()
  }, [loading, posts, missingCatalog, importing, handleImportCatalog])

  const openPreviewInEditor = (post: BlogPost) => {
    openEdit(post)
    setBodyPane('preview')
  }

  const handleCommentStatus = async (id: string, status: BlogCommentStatus) => {
    try {
      await setBlogCommentStatus(id, status)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('blog.moderationFailed'))
    }
  }

  const handleAddManual = async () => {
    if (!manualEmail.trim()) return
    try {
      await addBlogAudienceManual({
        email: manualEmail,
        name: manualName,
        marketing_opt_in: true,
      })
      setManualEmail('')
      setManualName('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('blog.audienceFailed'))
    }
  }

  const handleDeleteAudience = async (id: string) => {
    if (!window.confirm(t('blog.deleteAudienceConfirm'))) return
    try {
      await deleteBlogAudience(id)
      setAudience((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('blog.audienceFailed'))
    }
  }

  const handleDemoComment = async () => {
    const published = posts.find((p) => p.status === 'published') || posts[0]
    if (!published) return
    await demoAddPendingComment({
      postId: published.id,
      name: 'Alex Rivera',
      email: 'alex.rivera@museum-partners.example',
      body: 'Really useful write-up — curious how you handle guided narration inside the 360 viewer.',
      marketingOptIn: true,
    })
    await refresh()
    setTab('comments')
  }

  return (
    <div className="crm-blog">
      <div className="crm-blog-tabs" role="tablist">
        {(
          [
            ['pending', `${t('blog.tabPending')}${pendingPosts.length ? ` (${pendingPosts.length})` : ''}`],
            ['posts', t('blog.tabPosts')],
            ['comments', t('blog.tabComments')],
            ['emails', t('blog.tabEmails')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`crm-section-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => {
              setTab(id)
              setMode('list')
              setInfo('')
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="crm-feedback crm-feedback--error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="crm-feedback" role="status">
          {info}
        </p>
      )}
      {loading && <p className="crm-muted">{t('blog.loading')}</p>}

      {!loading && tab === 'pending' && mode === 'list' && (
        <div className="crm-blog-panel">
          <div className="crm-blog-toolbar">
            <p className="crm-muted">{t('blog.pendingHint')}</p>
            <div className="crm-blog-toolbar-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={importing}
                onClick={() => void handleImportCatalog()}
              >
                {importing
                  ? t('blog.importing')
                  : missingCatalog > 0
                    ? t('blog.importCatalog').replace('{count}', String(missingCatalog))
                    : t('blog.importCatalogDone')}
              </button>
            </div>
          </div>
          {missingCatalog > 0 && pendingPosts.length === 0 && (
            <div className="crm-blog-import-banner">
              <p>{t('blog.noPendingImport')}</p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={importing}
                onClick={() => void handleImportCatalog()}
              >
                {importing
                  ? t('blog.importing')
                  : t('blog.importCatalog').replace('{count}', String(missingCatalog))}
              </button>
            </div>
          )}
          <ul className="crm-blog-post-list">
            {pendingPosts.map((post) => (
              <li key={post.id} className="crm-blog-post-row">
                <div>
                  <strong>{post.title || t('blog.untitled')}</strong>
                  <span className="crm-muted">
                    {' '}
                    /{post.slug} · {t(statusLabelKey(post.status))}
                  </span>
                </div>
                <div className="crm-blog-row-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => openPreviewInEditor(post)}
                  >
                    {t('blog.preview')}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => openEdit(post)}>
                    {t('blog.edit')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={statusBusyId === post.id}
                    onClick={() => void handleSetStatus(post.id, 'published')}
                  >
                    {t('blog.publish')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={statusBusyId === post.id}
                    onClick={() => void handleSetStatus(post.id, 'hidden')}
                  >
                    {t('blog.hide')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void handleDelete(post.id)}
                  >
                    {t('blog.delete')}
                  </button>
                </div>
              </li>
            ))}
            {pendingPosts.length === 0 && missingCatalog === 0 && (
              <li className="crm-muted">{t('blog.noPending')}</li>
            )}
          </ul>
        </div>
      )}

      {!loading && tab === 'posts' && mode === 'list' && (
        <div className="crm-blog-panel">
          <div className="crm-blog-toolbar">
            <p className="crm-muted">{t('blog.postsHint')}</p>
            <div className="crm-blog-toolbar-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={importing}
                onClick={() => void handleImportCatalog()}
              >
                {importing
                  ? t('blog.importing')
                  : missingCatalog > 0
                    ? t('blog.importCatalog').replace('{count}', String(missingCatalog))
                    : t('blog.importCatalogDone')}
              </button>
              {demo && (
                <button type="button" className="btn btn-ghost" onClick={() => void handleDemoComment()}>
                  {t('blog.demoComment')}
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                {t('blog.newPost')}
              </button>
            </div>
          </div>
          {missingCatalog > 0 && libraryPosts.length === 0 && (
            <div className="crm-blog-import-banner">
              <p>{t('blog.noPendingImport')}</p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={importing}
                onClick={() => void handleImportCatalog()}
              >
                {importing
                  ? t('blog.importing')
                  : t('blog.importCatalog').replace('{count}', String(missingCatalog))}
              </button>
            </div>
          )}
          <ul className="crm-blog-post-list">
            {libraryPosts.map((post) => (
              <li key={post.id} className="crm-blog-post-row">
                <div>
                  <strong>{post.title || t('blog.untitled')}</strong>
                  <span className="crm-muted">
                    {' '}
                    /{post.slug} · {t(statusLabelKey(post.status))}
                    {post.published_at
                      ? ` · ${new Date(post.published_at).toLocaleDateString()}`
                      : ''}
                  </span>
                </div>
                <div className="crm-blog-row-actions">
                  {post.status === 'published' && (
                    <a
                      className="btn btn-ghost"
                      href={`/blog/${encodeURIComponent(post.slug)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('blog.viewLive')}
                    </a>
                  )}
                  {post.status !== 'published' && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => openPreviewInEditor(post)}
                    >
                      {t('blog.preview')}
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={() => openEdit(post)}>
                    {t('blog.edit')}
                  </button>
                  {post.status !== 'published' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={statusBusyId === post.id}
                      onClick={() => void handleSetStatus(post.id, 'published')}
                    >
                      {t('blog.publish')}
                    </button>
                  )}
                  {post.status === 'published' && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={statusBusyId === post.id}
                      onClick={() => void handleSetStatus(post.id, 'pending_review')}
                    >
                      {t('blog.unpublish')}
                    </button>
                  )}
                  {post.status !== 'hidden' && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={statusBusyId === post.id}
                      onClick={() => void handleSetStatus(post.id, 'hidden')}
                    >
                      {t('blog.hide')}
                    </button>
                  )}
                  {post.status === 'hidden' && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={statusBusyId === post.id}
                      onClick={() => void handleSetStatus(post.id, 'pending_review')}
                    >
                      {t('blog.restoreReview')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void handleDelete(post.id)}
                  >
                    {t('blog.delete')}
                  </button>
                </div>
              </li>
            ))}
            {libraryPosts.length === 0 && <li className="crm-muted">{t('blog.noPosts')}</li>}
          </ul>
        </div>
      )}

      {!loading && (tab === 'posts' || tab === 'pending') && mode === 'edit' && (
        <div className="crm-blog-editor">
          <div className="crm-blog-toolbar">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setMode('list')
                setBodyPane('edit')
                setReplacingId(null)
                setReplaceUrlDraft('')
              }}
            >
              {t('blog.backList')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? t('blog.saving') : t('blog.save')}
            </button>
          </div>

          <div className="crm-blog-editor-layout">
            <div className="crm-blog-editor-form">
              <p className="crm-muted crm-blog-editor-tip">{t('blog.editorTip')}</p>
              <p className="crm-muted crm-blog-editor-tip">{t('blog.markdownHint')}</p>
              <label className="crm-field">
                {t('blog.fieldTitle')}
                <input
                  value={draft.title}
                  onChange={(e) => {
                    const title = e.target.value
                    setDraft((d) => ({
                      ...d,
                      title,
                      slug: d.slug || slugifyTitle(title),
                      seo_title: d.seo_title || title,
                    }))
                  }}
                />
              </label>
              <label className="crm-field">
                {t('blog.fieldSlug')}
                <input
                  value={draft.slug}
                  onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                />
              </label>
              <label className="crm-field">
                {t('blog.fieldExcerpt')}
                <textarea
                  rows={2}
                  value={draft.excerpt}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      excerpt: e.target.value,
                      seo_description: d.seo_description || e.target.value,
                    }))
                  }
                />
              </label>
              <div className="crm-field crm-blog-body-field">
                <div className="crm-blog-body-toolbar">
                  <span>{t('blog.fieldBody')}</span>
                  <div className="crm-blog-body-toolbar-actions">
                    <button type="button" className="btn btn-ghost" onClick={insertDemoCta}>
                      {t('blog.insertDemoCta')}
                    </button>
                    <div className="crm-blog-pane-toggle" role="group" aria-label={t('blog.bodyPane')}>
                      <button
                        type="button"
                        className={`btn btn-ghost${bodyPane === 'edit' ? ' is-active' : ''}`}
                        aria-pressed={bodyPane === 'edit'}
                        onClick={() => setBodyPane('edit')}
                      >
                        {t('blog.paneEdit')}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-ghost${bodyPane === 'preview' ? ' is-active' : ''}`}
                        aria-pressed={bodyPane === 'preview'}
                        onClick={() => setBodyPane('preview')}
                      >
                        {t('blog.panePreview')}
                      </button>
                    </div>
                  </div>
                </div>
                {bodyPane === 'edit' ? (
                  <textarea
                    rows={16}
                    value={draft.body}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                    placeholder={t('blog.bodyPlaceholder')}
                  />
                ) : (
                  <div
                    className="crm-blog-md-preview blog-prose"
                    dangerouslySetInnerHTML={{
                      __html:
                        bodyPreviewHtml ||
                        `<p class="crm-muted">${t('blog.previewEmpty')}</p>`,
                    }}
                  />
                )}
              </div>
              <label className="crm-field">
                {t('blog.fieldCover')}
                <input
                  value={draft.cover_image_url}
                  onChange={(e) => setDraft((d) => ({ ...d, cover_image_url: e.target.value }))}
                  placeholder="/assets/blog/your-slug/cover.jpg"
                />
              </label>
              <p className="crm-muted crm-blog-editor-tip">{t('blog.coverHint')}</p>
              <label className="crm-field">
                {t('blog.fieldAuthor')}
                <input
                  value={draft.author_name}
                  onChange={(e) => setDraft((d) => ({ ...d, author_name: e.target.value }))}
                />
              </label>
              <label className="crm-field">
                {t('blog.fieldTags')}
                <input
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="360, WebGL, case study"
                />
              </label>
              <label className="crm-field">
                {t('blog.fieldSeoTitle')}
                <input
                  value={draft.seo_title}
                  onChange={(e) => setDraft((d) => ({ ...d, seo_title: e.target.value }))}
                />
              </label>
              <label className="crm-field">
                {t('blog.fieldSeoDesc')}
                <textarea
                  rows={2}
                  value={draft.seo_description}
                  onChange={(e) => setDraft((d) => ({ ...d, seo_description: e.target.value }))}
                />
              </label>
              <label className="crm-field">
                {t('blog.fieldStatus')}
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      status: e.target.value as BlogPostStatus,
                    }))
                  }
                >
                  <option value="pending_review">{t('blog.statusPendingReview')}</option>
                  <option value="draft">{t('blog.statusDraft')}</option>
                  <option value="published">{t('blog.statusPublished')}</option>
                  <option value="hidden">{t('blog.statusHidden')}</option>
                </select>
              </label>
            </div>

            <aside className="crm-blog-attachments" aria-label={t('blog.attachTitle')}>
              <div className="crm-blog-attachments-head">
                <h3 className="crm-blog-attachments-title">{t('blog.attachTitle')}</h3>
                <p className="crm-muted crm-blog-attachments-hint">{t('blog.attachHint')}</p>
              </div>

              {attachments.length === 0 && replacingId !== 'add-cover' && (
                <div className="crm-blog-attachments-empty">
                  <p className="crm-muted">{t('blog.attachEmpty')}</p>
                </div>
              )}

              <ul className="crm-blog-attach-list">
                {attachments.map((att) => {
                  const editing = replacingId === att.id
                  return (
                    <li key={att.id} className="crm-blog-attach-card">
                      <div className="crm-blog-attach-thumb-wrap">
                        <img
                          className="crm-blog-attach-thumb"
                          src={att.url}
                          alt={att.alt}
                          loading="lazy"
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).style.opacity = '0.35'
                          }}
                        />
                      </div>
                      <div className="crm-blog-attach-meta">
                        <div className="crm-blog-attach-label">{att.label}</div>
                        {att.alt && att.kind === 'body' ? (
                          <div className="crm-muted crm-blog-attach-alt">{att.alt}</div>
                        ) : null}
                        <code className="crm-blog-attach-url" title={att.url}>
                          {att.url}
                        </code>
                        {!editing ? (
                          <div className="crm-blog-attach-actions">
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => beginReplace(att)}
                            >
                              {t('blog.attachReplace')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => bustAttachmentCache(att)}
                              title={t('blog.attachBustTitle')}
                            >
                              {t('blog.attachBust')}
                            </button>
                          </div>
                        ) : (
                          <div className="crm-blog-attach-replace">
                            <label className="crm-field">
                              {t('blog.attachNewUrl')}
                              <input
                                value={replaceUrlDraft}
                                onChange={(e) => setReplaceUrlDraft(e.target.value)}
                                placeholder="/assets/blog/slug/file.jpg"
                              />
                            </label>
                            <p className="crm-muted crm-blog-attach-path-hint">
                              {t('blog.attachPathHint', {
                                path: `public/assets/blog/${assetSlug()}/${filenameFromUrl(replaceUrlDraft || att.url)}`,
                              })}
                            </p>
                            <div className="crm-blog-attach-actions">
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => applyReplaceUrl(att, replaceUrlDraft)}
                              >
                                {t('blog.attachApply')}
                              </button>
                              <button type="button" className="btn btn-ghost" onClick={cancelReplace}>
                                {t('blog.attachCancel')}
                              </button>
                              <label className="btn btn-ghost crm-blog-attach-file">
                                {t('blog.attachPickFile')}
                                <input
                                  type="file"
                                  accept="image/*"
                                  hidden
                                  onChange={(e) => {
                                    onPickLocalFile(att.id, e.target.files?.[0])
                                    e.target.value = ''
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>

              {replacingId === 'add-cover' && (
                <div className="crm-blog-attach-card crm-blog-attach-card--add">
                  <div className="crm-blog-attach-meta">
                    <div className="crm-blog-attach-label">{t('blog.attachCover')}</div>
                    <label className="crm-field">
                      {t('blog.attachNewUrl')}
                      <input
                        value={replaceUrlDraft}
                        onChange={(e) => setReplaceUrlDraft(e.target.value)}
                        placeholder="/assets/blog/your-slug/cover.jpg"
                      />
                    </label>
                    <p className="crm-muted crm-blog-attach-path-hint">
                      {t('blog.attachPathHint', {
                        path: `public/assets/blog/${assetSlug()}/${filenameFromUrl(replaceUrlDraft || 'cover.jpg')}`,
                      })}
                    </p>
                    <div className="crm-blog-attach-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => applyAddCover(replaceUrlDraft)}
                      >
                        {t('blog.attachApply')}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={cancelReplace}>
                        {t('blog.attachCancel')}
                      </button>
                      <label className="btn btn-ghost crm-blog-attach-file">
                        {t('blog.attachPickFile')}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            onPickLocalFile('add-cover', e.target.files?.[0])
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="crm-blog-attachments-add">
                {!draft.cover_image_url.trim() && replacingId !== 'add-cover' && (
                  <button type="button" className="btn btn-ghost" onClick={beginAddCover}>
                    {t('blog.attachAddCover')}
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={insertBodyImageSnippet}>
                  {t('blog.attachAddBody')}
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}

      {!loading && tab === 'comments' && (
        <div className="crm-blog-panel">
          <div className="crm-blog-toolbar">
            <label className="crm-field crm-field--inline">
              {t('blog.filterStatus')}
              <select
                value={commentFilter}
                onChange={(e) => setCommentFilter(e.target.value as BlogCommentStatus | 'all')}
              >
                <option value="all">{t('blog.filterAll')}</option>
                <option value="pending_moderation">{t('blog.statusPendingMod')}</option>
                <option value="pending_verify">{t('blog.statusPendingVerify')}</option>
                <option value="approved">{t('blog.statusApproved')}</option>
                <option value="rejected">{t('blog.statusRejected')}</option>
                <option value="spam">{t('blog.statusSpam')}</option>
              </select>
            </label>
          </div>
          <ul className="crm-blog-comment-list">
            {filteredComments.map((c) => (
              <li key={c.id} className="crm-blog-comment-row">
                <div>
                  <strong>{c.author_name}</strong>
                  <span className="crm-muted"> · {c.author_email}</span>
                  <div className="crm-muted">
                    {postTitleById.get(c.post_id) || c.post_id} · {c.status}
                    {c.marketing_opt_in ? ` · ${t('blog.optIn')}` : ''}
                  </div>
                  <p>{c.body}</p>
                </div>
                <div className="crm-blog-row-actions">
                  {c.status !== 'approved' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void handleCommentStatus(c.id, 'approved')}
                    >
                      {t('blog.approve')}
                    </button>
                  )}
                  {c.status !== 'rejected' && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void handleCommentStatus(c.id, 'rejected')}
                    >
                      {t('blog.reject')}
                    </button>
                  )}
                  {c.status !== 'spam' && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void handleCommentStatus(c.id, 'spam')}
                    >
                      {t('blog.spam')}
                    </button>
                  )}
                </div>
              </li>
            ))}
            {filteredComments.length === 0 && (
              <li className="crm-muted">{t('blog.noComments')}</li>
            )}
          </ul>
        </div>
      )}

      {!loading && tab === 'emails' && (
        <div className="crm-blog-panel">
          <div className="crm-blog-toolbar crm-blog-toolbar--emails">
            <input
              className="crm-input crm-blog-email-search"
              placeholder={t('blog.emailSearch')}
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
            />
            <label className="crm-check">
              <input
                type="checkbox"
                checked={marketingOnly}
                onChange={(e) => setMarketingOnly(e.target.checked)}
              />
              {t('blog.marketingOnly')}
            </label>
          </div>
          <div className="crm-blog-manual">
            <input
              className="crm-input"
              placeholder={t('blog.manualName')}
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              autoComplete="name"
            />
            <input
              className="crm-input crm-blog-manual-email"
              type="email"
              placeholder={t('blog.manualEmail')}
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              autoComplete="email"
            />
            <button type="button" className="btn btn-ghost" onClick={() => void handleAddManual()}>
              {t('blog.addManual')}
            </button>
          </div>
          <ul className="crm-blog-email-list">
            {audience.map((row) => (
              <li key={row.id} className="crm-blog-email-row">
                <div className="crm-blog-email-main">
                  <strong>{row.email}</strong>
                  {row.name ? <span className="crm-muted"> · {row.name}</span> : null}
                  <div className="crm-muted">
                    {row.source}
                    {row.marketing_opt_in ? ` · ${t('blog.optIn')}` : ` · ${t('blog.optOut')}`}
                    {row.verified_at
                      ? ` · verified ${new Date(row.verified_at).toLocaleDateString()}`
                      : ''}
                  </div>
                  <textarea
                    rows={2}
                    className="crm-blog-notes"
                    value={row.notes}
                    placeholder={t('blog.notesPlaceholder')}
                    onChange={(e) => {
                      const notes = e.target.value
                      setAudience((prev) =>
                        prev.map((a) => (a.id === row.id ? { ...a, notes } : a)),
                      )
                    }}
                    onBlur={(e) => void updateBlogAudienceNotes(row.id, e.target.value)}
                  />
                </div>
                <div className="crm-blog-row-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void handleDeleteAudience(row.id)}
                  >
                    {t('blog.delete')}
                  </button>
                </div>
              </li>
            ))}
            {audience.length === 0 && <li className="crm-muted">{t('blog.noEmails')}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
