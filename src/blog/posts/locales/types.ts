import type { DemoPostSpec } from '../demoPostBuilder'

/** Translatable fields from a demo post spec (URLs / ids stay on EN base). */
export type DemoPostLocaleOverlay = Partial<
  Pick<
    DemoPostSpec,
    | 'title'
    | 'pageTitle'
    | 'excerpt'
    | 'seo_title'
    | 'seo_description'
    | 'demoLabel'
    | 'hook'
    | 'coverNote'
    | 'whatYouSeeIntro'
    | 'whyBullets'
    | 'whyUses'
    | 'beginner'
    | 'glossary'
    | 'trySteps'
    | 'requirements'
    | 'alsoCan'
    | 'howWorks'
    | 'whatsNew'
    | 'tourBridge'
    | 'faq'
    | 'reading'
    | 'related'
    | 'heroVideoCaption'
  >
> & {
  viewA?: Partial<DemoPostSpec['viewA']>
  viewB?: Partial<DemoPostSpec['viewB']>
  viewC?: Partial<NonNullable<DemoPostSpec['viewC']>>
}

export type DemoPostLocalePack = Record<string, DemoPostLocaleOverlay>
