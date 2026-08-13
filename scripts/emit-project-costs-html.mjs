#!/usr/bin/env node
/**
 * Post-build: clone dist/index.html into dist/project-costs/index.html
 * (and locale variants) with route-specific meta + a no-JS snapshot in #root.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://iobjectm.com'
const OG_IMAGE = `${SITE}/og-image.svg`
const AUGUST_ENDS = Date.parse('2026-09-01T00:00:00+02:00')

const OG_LOCALE = {
  en: 'en_US',
  de: 'de_DE',
  fr: 'fr_FR',
  es: 'es_ES',
  it: 'it_IT',
  nl: 'nl_NL',
}

const COPY = {
  en: {
    htmlLang: 'en',
    title: 'Project Costs & Production Capacity — IOM',
    description:
      'Understand how IOM projects are priced, from focused specialist support and small website interactions to additional studio capacity and larger custom projects.',
    h1: 'Project Costs',
    lead: 'Choose the level of production capacity that fits the project. Use specialist capacity for a focused task, add studio capacity when parallel work is useful, or scope a larger project with us.',
    specialistTitle: 'Senior specialist capacity',
    specialistRate: '€550 / production day',
    specialistIntro: '€450 / production day',
    specialistSummary: 'For a focused technical, 3D or realtime task within a wider project.',
    studioTitle: 'Additional studio capacity',
    studioRate: 'from €900 / production day',
    studioIntro: 'from €800 / production day',
    studioSummary:
      'For larger production packages or parallel workstreams where extra capacity is genuinely useful.',
    projectTitle: 'Complete / larger project',
    projectRate: 'Scoped after consultation',
    projectSummary:
      'For end-to-end work where scope, source material, schedule and required capacity should be reviewed together.',
    augustBadge: 'August intro',
    untilNotice: 'Available until the end of August',
    standardLabel: 'Standard {rate}',
    fixedTitle: 'Small, clearly defined work',
    fixedBody:
      'Not every collaboration needs to begin with a large project or a day-rate engagement. Small interactions, product-presentation improvements, prototypes and clearly defined website components can also be quoted as fixed-price scopes.',
    ctaTitle: 'Tell us what you are trying to build',
    ctaLead:
      'You do not need a technical brief. Send us the goal, anything you already have, and the date you are working toward. We can help determine the appropriate production setup.',
    cta: 'Discuss a project',
  },
  de: {
    htmlLang: 'de',
    title: 'Projektkosten & Produktionskapazität — IOM',
    description:
      'Verstehen Sie, wie IOM-Projekte kalkuliert werden — von fokussierter Spezialisten-Unterstützung und kleinen Website-Interaktionen bis zu zusätzlicher Studio-Kapazität und größeren individuellen Projekten.',
    h1: 'Projektkosten',
    lead: 'Wählen Sie die Produktionskapazität, die zum Projekt passt. Nutzen Sie Spezialisten-Kapazität für eine fokussierte Aufgabe, ergänzen Sie Studio-Kapazität, wenn parallele Arbeit sinnvoll ist, oder definieren Sie mit uns den Umfang eines größeren Projekts.',
    specialistTitle: 'Senior-Spezialisten-Kapazität',
    specialistRate: '€550 / Produktionstag',
    specialistIntro: '€450 / Produktionstag',
    specialistSummary:
      'Für eine fokussierte technische, 3D- oder Echtzeit-Aufgabe innerhalb eines größeren Projekts.',
    studioTitle: 'Zusätzliche Studio-Kapazität',
    studioRate: 'Ab €900 / Produktionstag',
    studioIntro: 'Ab €800 / Produktionstag',
    studioSummary:
      'Für größere Produktionspakete oder parallele Workstreams, bei denen zusätzliche Kapazität wirklich nützlich ist.',
    projectTitle: 'Komplettes / größeres Projekt',
    projectRate: 'Nach Beratung scoped',
    projectSummary:
      'Für End-to-End-Arbeit, bei der Umfang, Ausgangsmaterial, Zeitplan und benötigte Kapazität gemeinsam geprüft werden sollten.',
    augustBadge: 'August-Intro',
    untilNotice: 'Verfügbar bis Ende August',
    standardLabel: 'Standard {rate}',
    fixedTitle: 'Kleine, klar definierte Arbeit',
    fixedBody:
      'Nicht jede Zusammenarbeit muss mit einem großen Projekt oder einem Tagessatz beginnen. Kleine Interaktionen, Verbesserungen der Produktpräsentation, Prototypen und klar definierte Website-Komponenten können auch als Festpreis-Scopes angeboten werden.',
    ctaTitle: 'Erzählen Sie uns, was Sie bauen möchten',
    ctaLead:
      'Sie brauchen kein technisches Briefing. Senden Sie uns das Ziel, was Sie bereits haben, und den Termin, auf den Sie hinarbeiten. Wir helfen, das passende Produktions-Setup zu bestimmen.',
    cta: 'Projekt besprechen',
  },
  fr: {
    htmlLang: 'fr',
    title: 'Coûts de projet & capacité de production — IOM',
    description:
      'Comprenez comment les projets IOM sont tarifés, du soutien spécialiste ciblé et des petites interactions web à la capacité studio supplémentaire et aux projets sur mesure plus importants.',
    h1: 'Coûts de projet',
    lead: 'Choisissez le niveau de capacité de production adapté au projet. Utilisez la capacité spécialiste pour une tâche ciblée, ajoutez de la capacité studio lorsque le travail en parallèle est utile, ou cadrez un projet plus large avec nous.',
    specialistTitle: 'Capacité de spécialiste senior',
    specialistRate: '€550 / jour de production',
    specialistIntro: '€450 / jour de production',
    specialistSummary:
      'Pour une tâche technique, 3D ou temps réel ciblée au sein d’un projet plus large.',
    studioTitle: 'Capacité studio supplémentaire',
    studioRate: 'À partir de €900 / jour de production',
    studioIntro: 'À partir de €800 / jour de production',
    studioSummary:
      'Pour des lots de production plus importants ou des flux de travail parallèles où une capacité supplémentaire est réellement utile.',
    projectTitle: 'Projet complet / plus large',
    projectRate: 'Cadrage après consultation',
    projectSummary:
      'Pour un travail de bout en bout dont le périmètre, les sources, le calendrier et la capacité requise doivent être examinés ensemble.',
    augustBadge: 'Intro août',
    untilNotice: 'Disponible jusqu’à fin août',
    standardLabel: 'Tarif standard {rate}',
    fixedTitle: 'Travaux petits et clairement définis',
    fixedBody:
      'Toutes les collaborations n’ont pas besoin de commencer par un grand projet ou un engagement au tarif journalier. De petites interactions, des améliorations de présentation produit, des prototypes et des composants de site clairement définis peuvent aussi être chiffrés au forfait.',
    ctaTitle: 'Dites-nous ce que vous cherchez à construire',
    ctaLead:
      'Vous n’avez pas besoin d’un brief technique. Envoyez-nous l’objectif, ce que vous avez déjà, et la date visée. Nous aiderons à déterminer le dispositif de production adapté.',
    cta: 'Discuter d’un projet',
  },
  es: {
    htmlLang: 'es',
    title: 'Costes de proyecto y capacidad de producción — IOM',
    description:
      'Entienda cómo se cotizan los proyectos de IOM, desde apoyo especialista puntual e interacciones web pequeñas hasta capacidad de estudio adicional y proyectos a medida de mayor envergadura.',
    h1: 'Costes de proyecto',
    lead: 'Elija el nivel de capacidad de producción que encaje con el proyecto. Use capacidad especialista para una tarea concreta, añada capacidad de estudio cuando el trabajo en paralelo sea útil, o definamos juntos el alcance de un proyecto mayor.',
    specialistTitle: 'Capacidad de especialista sénior',
    specialistRate: '€550 / día de producción',
    specialistIntro: '€450 / día de producción',
    specialistSummary:
      'Para una tarea técnica, 3D o en tiempo real concreta dentro de un proyecto más amplio.',
    studioTitle: 'Capacidad adicional de estudio',
    studioRate: 'Desde €900 / día de producción',
    studioIntro: 'Desde €800 / día de producción',
    studioSummary:
      'Para paquetes de producción mayores o líneas de trabajo en paralelo donde la capacidad extra resulta realmente útil.',
    projectTitle: 'Proyecto completo / mayor',
    projectRate: 'Acotado tras consulta',
    projectSummary:
      'Para trabajo de extremo a extremo en el que el alcance, el material de origen, el calendario y la capacidad necesaria deben revisarse juntos.',
    augustBadge: 'Intro agosto',
    untilNotice: 'Disponible hasta finales de agosto',
    standardLabel: 'Estándar {rate}',
    fixedTitle: 'Trabajo pequeño y claramente definido',
    fixedBody:
      'No toda colaboración tiene que empezar con un proyecto grande o un encargo a tarifa diaria. Interacciones pequeñas, mejoras de presentación de producto, prototipos y componentes web claramente definidos también pueden cotizarse como alcances a precio fijo.',
    ctaTitle: 'Cuéntenos qué quiere construir',
    ctaLead:
      'No necesita un brief técnico. Envíenos el objetivo, lo que ya tenga y la fecha a la que trabaja. Podemos ayudar a determinar la configuración de producción adecuada.',
    cta: 'Hablar de un proyecto',
  },
  it: {
    htmlLang: 'it',
    title: 'Costi di progetto e capacità di produzione — IOM',
    description:
      'Capite come vengono quotati i progetti IOM, dal supporto specialista mirato e dalle piccole interazioni per siti web alla capacità di studio aggiuntiva e ai progetti su misura più ampi.',
    h1: 'Costi di progetto',
    lead: 'Scegliete il livello di capacità produttiva adatto al progetto. Usate la capacità specialista per un compito mirato, aggiungete capacità di studio quando il lavoro in parallelo è utile, oppure definiamo insieme lo scope di un progetto più ampio.',
    specialistTitle: 'Capacità di specialista senior',
    specialistRate: '€550 / giorno di produzione',
    specialistIntro: '€450 / giorno di produzione',
    specialistSummary:
      'Per un compito tecnico, 3D o realtime mirato all’interno di un progetto più ampio.',
    studioTitle: 'Capacità aggiuntiva di studio',
    studioRate: 'Da €900 / giorno di produzione',
    studioIntro: 'Da €800 / giorno di produzione',
    studioSummary:
      'Per pacchetti di produzione più ampi o flussi di lavoro paralleli in cui la capacità extra è davvero utile.',
    projectTitle: 'Progetto completo / più ampio',
    projectRate: 'Definito dopo consulenza',
    projectSummary:
      'Per un lavoro end-to-end in cui scope, materiali di partenza, tempi e capacità necessaria vanno valutati insieme.',
    augustBadge: 'Intro agosto',
    untilNotice: 'Disponibile fino a fine agosto',
    standardLabel: 'Standard {rate}',
    fixedTitle: 'Lavoro piccolo e chiaramente definito',
    fixedBody:
      'Non ogni collaborazione deve iniziare con un progetto grande o un incarico a tariffa giornaliera. Piccole interazioni, miglioramenti della presentazione prodotto, prototipi e componenti di sito chiaramente definiti possono essere quotati anche come scope a prezzo fisso.',
    ctaTitle: 'Raccontateci cosa volete costruire',
    ctaLead:
      'Non serve un brief tecnico. Inviateci l’obiettivo, ciò che avete già e la data a cui puntate. Possiamo aiutare a determinare l’assetto di produzione adatto.',
    cta: 'Parlare di un progetto',
  },
  nl: {
    htmlLang: 'nl',
    title: 'Projectkosten & productiecapaciteit — IOM',
    description:
      'Begrijp hoe IOM-projecten worden geprijsd, van gerichte specialistenondersteuning en kleine website-interacties tot extra studiocapaciteit en grotere maatwerkprojecten.',
    h1: 'Projectkosten',
    lead: 'Kies het niveau van productiecapaciteit dat bij het project past. Gebruik specialistcapaciteit voor een gerichte taak, voeg studiocapaciteit toe wanneer parallel werk zinvol is, of scope samen met ons een groter project.',
    specialistTitle: 'Senior specialistcapaciteit',
    specialistRate: '€550 / productiedag',
    specialistIntro: '€450 / productiedag',
    specialistSummary: 'Voor een gerichte technische, 3D- of realtime-taak binnen een breder project.',
    studioTitle: 'Extra studiocapaciteit',
    studioRate: 'Vanaf €900 / productiedag',
    studioIntro: 'Vanaf €800 / productiedag',
    studioSummary:
      'Voor grotere productiepakketten of parallelle werkstromen waarbij extra capaciteit echt zinvol is.',
    projectTitle: 'Compleet / groter project',
    projectRate: 'Gescooped na overleg',
    projectSummary:
      'Voor end-to-end-werk waarbij scope, bronmateriaal, planning en benodigde capaciteit samen moeten worden bekeken.',
    augustBadge: 'Augustus-intro',
    untilNotice: 'Beschikbaar tot eind augustus',
    standardLabel: 'Standaard {rate}',
    fixedTitle: 'Klein, duidelijk afgebakend werk',
    fixedBody:
      'Niet elke samenwerking hoeft te beginnen met een groot project of een dagtarief. Kleine interacties, verbeteringen van productpresentatie, prototypen en duidelijk afgebakende website-onderdelen kunnen ook als vaste-prijs-scopes worden geoffreerd.',
    ctaTitle: 'Vertel wat je wilt bouwen',
    ctaLead:
      'Je hebt geen technische brief nodig. Stuur het doel, wat je al hebt, en de datum waarnaartoe je werkt. Wij helpen de juiste productie-opzet te bepalen.',
    cta: 'Een project bespreken',
  },
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function replaceAttr(html, attr, key, value) {
  const re = new RegExp(`(<meta[^>]*${attr}="${key}"[^>]*content=")([^"]*)(")`, 'i')
  if (re.test(html)) return html.replace(re, `$1${esc(value)}$3`)
  const re2 = new RegExp(`(<meta[^>]*content=")([^"]*)("[^>]*${attr}="${key}")`, 'i')
  if (re2.test(html)) return html.replace(re2, `$1${esc(value)}$3`)
  return html
}

function replaceLinkHref(html, rel, href) {
  const re = new RegExp(`(<link[^>]*rel="${rel}"[^>]*href=")([^"]*)(")`, 'i')
  if (re.test(html)) return html.replace(re, `$1${esc(href)}$3`)
  return html
}

function replaceRoot(html, inner) {
  const token = '<div id="root">'
  const start = html.indexOf(token)
  if (start < 0) throw new Error('emit-project-costs-html: #root not found')
  let i = start + token.length
  let depth = 1
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i)
    const nextClose = html.indexOf('</div>', i)
    if (nextClose < 0) break
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1
      i = nextOpen + 4
    } else {
      depth -= 1
      if (depth === 0) {
        return `${html.slice(0, start)}${token}\n${inner}\n    </div>${html.slice(nextClose + 6)}`
      }
      i = nextClose + 6
    }
  }
  throw new Error('emit-project-costs-html: unclosed #root')
}

function snapshot(lang, augustOn) {
  const c = COPY[lang]
  const introCard = (title, rate, introRate, summary) => {
    const heading =
      augustOn && introRate
        ? `${title} — ${c.augustBadge} · ${introRate}`
        : `${title} — ${rate}`
    return `
        <article>
          <h3>${esc(heading)}</h3>
          ${
            augustOn && introRate
              ? `<p>${esc(c.untilNotice)}</p><p>${esc(c.standardLabel.replace('{rate}', rate))}</p>`
              : ''
          }
          <p>${esc(summary)}</p>
        </article>`
  }

  return `      <main id="project-costs-snapshot" style="padding:5.5rem 1.25rem 3rem;max-width:52rem;margin:0 auto;">
        <h1>${esc(c.h1)}</h1>
        <p>${esc(c.lead)}</p>
        <section>
          ${introCard(c.specialistTitle, c.specialistRate, c.specialistIntro, c.specialistSummary)}
          ${introCard(c.studioTitle, c.studioRate, c.studioIntro, c.studioSummary)}
          ${introCard(c.projectTitle, c.projectRate, '', c.projectSummary)}
        </section>
        <section>
          <h2>${esc(c.fixedTitle)}</h2>
          <p>${esc(c.fixedBody)}</p>
        </section>
        <section>
          <h2>${esc(c.ctaTitle)}</h2>
          <p>${esc(c.ctaLead)}</p>
          <p><a href="mailto:projects@iobjectm.com">${esc(c.cta)}</a> — projects@iobjectm.com</p>
        </section>
      </main>`
}

function applyMeta(html, lang) {
  const c = COPY[lang]
  const canonicalPath = lang === 'en' ? '/project-costs' : `/${lang}/project-costs`
  const canonical = `${SITE}${canonicalPath}`

  let next = html.replace(/<html lang="[^"]*"/, `<html lang="${c.htmlLang}"`)
  next = next.replace(/<title>[^<]*<\/title>/, `<title>${esc(c.title)}</title>`)
  next = replaceAttr(next, 'name', 'description', c.description)
  next = replaceAttr(next, 'property', 'og:title', c.title)
  next = replaceAttr(next, 'property', 'og:description', c.description)
  next = replaceAttr(next, 'property', 'og:url', canonical)
  next = replaceAttr(next, 'property', 'og:image', OG_IMAGE)
  next = replaceAttr(next, 'property', 'og:locale', OG_LOCALE[lang])
  next = replaceAttr(next, 'name', 'twitter:title', c.title)
  next = replaceAttr(next, 'name', 'twitter:description', c.description)
  next = replaceAttr(next, 'name', 'twitter:image', OG_IMAGE)
  next = replaceLinkHref(next, 'canonical', canonical)

  const alts = Object.keys(COPY)
    .map((code) => {
      const href = code === 'en' ? `${SITE}/project-costs` : `${SITE}/${code}/project-costs`
      return `    <link rel="alternate" hreflang="${code}" href="${href}">`
    })
    .join('\n')
  next = next.replace(
    /<link rel="canonical"[^>]*>/,
    (m) =>
      `${m}\n${alts}\n    <link rel="alternate" hreflang="x-default" href="${SITE}/project-costs">`,
  )
  return { html: next, canonical }
}

function hideHomepageChrome(html) {
  let next = html.replace(
    /<img(\s[^>]*?)id="lcp-poster"/,
    '<img hidden$1id="lcp-poster"',
  )
  next = next.replace(/<noscript>\s*<section id="engage-iom">[\s\S]*?<\/noscript>/, '')
  return next
}

export function emitProjectCostsHtml(distDir = join(root, 'dist')) {
  const sourcePath = join(distDir, 'index.html')
  const source = readFileSync(sourcePath, 'utf8')
  const augustOn = Date.now() < AUGUST_ENDS

  for (const lang of Object.keys(COPY)) {
    const { html: withMeta } = applyMeta(source, lang)
    const withChrome = hideHomepageChrome(withMeta)
    const out = replaceRoot(withChrome, snapshot(lang, augustOn))
    const dir =
      lang === 'en' ? join(distDir, 'project-costs') : join(distDir, lang, 'project-costs')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.html'), out)
  }

  console.log('emit-project-costs-html: wrote EN + locale /project-costs snapshots')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    emitProjectCostsHtml()
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
