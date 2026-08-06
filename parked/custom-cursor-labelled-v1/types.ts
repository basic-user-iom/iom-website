export type CursorMode =
  | 'default'
  | 'link'
  | 'view'
  | 'play'
  | 'pause'
  | 'explore'
  | 'drag'
  | 'look'
  | 'start'
  | 'external'
  | 'native'

export type CursorState = Exclude<CursorMode, 'default' | 'native'>

export type ResolvedCursor = {
  mode: CursorMode
  label: string | null
  icon: 'none' | 'external' | 'play' | 'drag' | 'look'
}

export type ProgrammaticCursor = {
  mode: CursorMode | null
  label: string | null
}
