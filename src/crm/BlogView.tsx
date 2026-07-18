import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addBlogAudienceManual,
  catalogImportMissingCount,
  createBlogPost,
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

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setTagsText('')
    setBodyPane('edit')
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
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('blog.importFailed'))
    } finally {
      setImporting(false)
    }
  }, [refresh, t])

  // First open with an empty CRM blog: pull all catalog posts into Pending Review.
  const autoImportTried = useRef(false)
  useEffect(() => {
    if (loading || autoImportTried.current || importing) return
    if (posts.length > 0 || missingCatalog <= 0) return
    autoImportTried.current = true
    setTab('pending')
    void handleImportCatalog()
  }, [loading, posts.length, missingCatalog, importing, handleImportCatalog])

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
                dangerouslySetInnerHTML={{ __html: bodyPreviewHtml || `<p class="crm-muted">${t('blog.previewEmpty')}</p>` }}
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
          <div className="crm-blog-toolbar">
            <input
              className="crm-input"
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
              placeholder={t('blog.manualName')}
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
            />
            <input
              placeholder={t('blog.manualEmail')}
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
            />
            <button type="button" className="btn btn-ghost" onClick={() => void handleAddManual()}>
              {t('blog.addManual')}
            </button>
          </div>
          <ul className="crm-blog-email-list">
            {audience.map((row) => (
              <li key={row.id} className="crm-blog-email-row">
                <div>
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
              </li>
            ))}
            {audience.length === 0 && <li className="crm-muted">{t('blog.noEmails')}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
