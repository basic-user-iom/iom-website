const STORAGE_KEY = 'iom.automotive-studio.collapsedGroups'

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? new Set(parsed.filter((k): k is string => typeof k === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

function saveCollapsed(keys: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]))
  } catch {
    // Private mode / quota — collapsing still works for this session.
  }
}

/** A sibling that owns its own heading starts a new group instead of joining this one. */
function startsNewGroup(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  const el = node as Element
  return el.tagName === 'H3' || el.querySelector('h3') != null
}

function collectBody(heading: HTMLElement): HTMLElement | null {
  const nodes: Node[] = []
  let cursor = heading.nextSibling
  while (cursor && !startsNewGroup(cursor)) {
    nodes.push(cursor)
    cursor = cursor.nextSibling
  }
  if (!nodes.some((n) => n.nodeType === Node.ELEMENT_NODE)) return null
  const body = document.createElement('div')
  body.className = 'as-group-body'
  for (const node of nodes) body.appendChild(node)
  heading.after(body)
  return body
}

/**
 * Turn every `h3` group inside the inspector panels into a click-to-collapse section.
 * Heading text moves into `.as-group-label` — use `setGroupLabel` to retitle one later.
 */
export function setupCollapsibleGroups(root: ParentNode) {
  const collapsed = loadCollapsed()

  root.querySelectorAll<HTMLElement>('[data-panel]').forEach((panel) => {
    const panelKey = panel.dataset.panel || 'panel'
    panel.querySelectorAll<HTMLElement>('h3').forEach((heading, index) => {
      if (heading.dataset.groupHead) return
      const body = collectBody(heading)
      if (!body) return

      const key = `${panelKey}:${index}:${heading.textContent?.trim() ?? ''}`
      const label = document.createElement('span')
      label.className = 'as-group-label'
      while (heading.firstChild) label.appendChild(heading.firstChild)

      const caret = document.createElement('span')
      caret.className = 'as-group-caret'
      caret.setAttribute('aria-hidden', 'true')

      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = 'as-group-toggle'
      toggle.append(label, caret)
      heading.appendChild(toggle)
      heading.classList.add('as-group-head')
      heading.dataset.groupHead = key

      const apply = (open: boolean) => {
        toggle.setAttribute('aria-expanded', String(open))
        body.hidden = !open
        heading.classList.toggle('as-group-head--collapsed', !open)
      }
      apply(!collapsed.has(key))

      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true'
        apply(open)
        if (open) collapsed.delete(key)
        else collapsed.add(key)
        saveCollapsed(collapsed)
      })
    })
  })
}

/** Retitle a collapsible group without destroying its toggle button. */
export function setGroupLabel(heading: HTMLElement | null, text: string) {
  if (!heading) return
  const label = heading.querySelector('.as-group-label')
  if (label) label.textContent = text
  else heading.textContent = text
}
