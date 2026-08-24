/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ICM building viewer unlock password (default: animated) */
  readonly VITE_BUILDING_VIEWER_DEMO_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
