/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEB3FORMS_ACCESS_KEY?: string
  /** Supabase project URL for Client Login CRM (optional — local mode without it) */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon/public key */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Local-mode CRM password when Supabase is not configured (default: iom-local) */
  readonly VITE_CRM_LOCAL_PASSWORD?: string
  /** Artist Globe admin unlock password (default: iom-globe-admin) */
  readonly VITE_ARTIST_GLOBE_ADMIN_PASSWORD?: string
  /** ICM client demo unlock password (default: volimte) */
  readonly VITE_ICM_DEMO_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
