/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEB3FORMS_ACCESS_KEY?: string
  /** Supabase project URL for Client Login CRM (optional — local mode without it) */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon/public key */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Local DEV CRM password when Supabase is not configured (ignored in production builds) */
  readonly VITE_CRM_LOCAL_PASSWORD?: string
  /** ICM client demo unlock password (default: volimte) */
  readonly VITE_ICM_DEMO_PASSWORD?: string
  /** ICM building viewer unlock password (default: animated) */
  readonly VITE_BUILDING_VIEWER_DEMO_PASSWORD?: string
  /** Kelly Kettle client demo unlock password (default: kettle) */
  readonly VITE_KELLY_KETTLE_DEMO_PASSWORD?: string
  /** Precision object study unlock password (default: precision) */
  readonly VITE_PRECISION_OBJECT_DEMO_PASSWORD?: string
  /** Automotive Studio unlock password (default: automotive) */
  readonly VITE_AUTOMOTIVE_STUDIO_DEMO_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
