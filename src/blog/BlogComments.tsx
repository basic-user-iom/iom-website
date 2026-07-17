import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { fetchPublicComments, submitBlogComment } from './publicApi'
import { isSampleBlogPostId } from './samplePosts'
import { formatBlogDate, type BlogCommentPublic } from './types'

interface BlogCommentsProps {
  postId: string
  onSubmitted?: () => void
}

function nestComments(rows: BlogCommentPublic[]) {
  const roots: (BlogCommentPublic & { replies: BlogCommentPublic[] })[] = []
  const byId = new Map<string, BlogCommentPublic & { replies: BlogCommentPublic[] }>()
  for (const r of rows) {
    byId.set(r.id, { ...r, replies: [] })
  }
  for (const r of rows) {
    const node = byId.get(r.id)!
    if (r.parent_id && byId.has(r.parent_id)) {
      byId.get(r.parent_id)!.replies.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export function BlogComments({ postId, onSubmitted }: BlogCommentsProps) {
  const sample = isSampleBlogPostId(postId)
  const [comments, setComments] = useState<BlogCommentPublic[]>([])
  const [loading, setLoading] = useState(!sample)
  const [error, setError] = useState('')
  const [replyTo, setReplyTo] = useState<BlogCommentPublic | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [body, setBody] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [botcheck, setBotcheck] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  const load = async () => {
    if (sample) {
      setLoading(false)
      setComments([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const rows = await fetchPublicComments(postId)
      setComments(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load comments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [postId])

  const tree = useMemo(() => nestComments(comments), [comments])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFeedback('')
    const result = await submitBlogComment({
      postId,
      parentId: replyTo?.id || null,
      name,
      email,
      body,
      marketingOptIn,
      botcheck,
    })
    setBusy(false)
    if (!result.ok) {
      setFeedback(result.error || 'Submit failed')
      return
    }
    setFeedback(result.message || 'Check your email to confirm your comment.')
    setBody('')
    setReplyTo(null)
    setMarketingOptIn(false)
    onSubmitted?.()
  }

  return (
    <section className="blog-comments" aria-labelledby="blog-comments-heading">
      <h2 id="blog-comments-heading">Comments</h2>
      <p className="blog-comments-note">
        Email is required to comment and is never shown publicly. We send a confirmation link to
        verify it is real.
      </p>

      {sample && (
        <p className="blog-status">
          Showing sample article content. Publish a post from CRM (after applying the blog SQL
          migration) to enable live comments.
        </p>
      )}

      {!sample && loading && <p className="blog-status">Loading comments…</p>}
      {!sample && error && (
        <p className="blog-status blog-status--error" role="alert">
          {error}
        </p>
      )}

      {!sample && !loading && tree.length === 0 && (
        <p className="blog-status">No comments yet — start the conversation.</p>
      )}

      {!sample && (
      <ul className="blog-comment-list">
        {tree.map((c) => (
          <li key={c.id} className="blog-comment">
            <div className="blog-comment-meta">
              <strong>{c.author_name}</strong>
              <time dateTime={c.created_at}>{formatBlogDate(c.created_at)}</time>
            </div>
            <p className="blog-comment-body">{c.body}</p>
            <button
              type="button"
              className="blog-comment-reply"
              onClick={() => setReplyTo(c)}
            >
              Reply
            </button>
            {c.replies.length > 0 && (
              <ul className="blog-comment-replies">
                {c.replies.map((r) => (
                  <li key={r.id} className="blog-comment">
                    <div className="blog-comment-meta">
                      <strong>{r.author_name}</strong>
                      <time dateTime={r.created_at}>{formatBlogDate(r.created_at)}</time>
                    </div>
                    <p className="blog-comment-body">{r.body}</p>
                    <button
                      type="button"
                      className="blog-comment-reply"
                      onClick={() => setReplyTo(r)}
                    >
                      Reply
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      )}

      {!sample && (
      <form className="blog-comment-form" onSubmit={(e) => void handleSubmit(e)}>
        <h3>{replyTo ? `Reply to ${replyTo.author_name}` : 'Leave a comment'}</h3>
        {replyTo && (
          <button type="button" className="blog-comment-reply" onClick={() => setReplyTo(null)}>
            Cancel reply
          </button>
        )}
        <label>
          Name
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label>
          Email <span className="blog-field-hint">(private — never published)</span>
          <input
            required
            type="email"
            maxLength={160}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Comment
          <textarea
            required
            rows={5}
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <label className="blog-check">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
          />
          Email me occasional IOM updates (optional — separate from commenting)
        </label>
        {/* Honeypot */}
        <label className="blog-hp" aria-hidden="true">
          Leave blank
          <input
            tabIndex={-1}
            autoComplete="off"
            value={botcheck}
            onChange={(e) => setBotcheck(e.target.value)}
          />
        </label>
        {feedback && <p className="blog-status">{feedback}</p>}
        <button type="submit" className="blog-submit" disabled={busy}>
          {busy ? 'Sending…' : 'Post comment'}
        </button>
      </form>
      )}
    </section>
  )
}
