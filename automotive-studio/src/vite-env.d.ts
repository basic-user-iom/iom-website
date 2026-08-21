/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Automotive Studio unlock password (default: automotive) */
  readonly VITE_AUTOMOTIVE_STUDIO_DEMO_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
