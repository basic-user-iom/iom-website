import type { BlogPost, BlogPostTranslations } from '../blog/types'
import { translationFieldsFromPost } from '../blog/types'

/** Attach EN + short CRM-sandbox translations for the four fictional demo posts. */
export function withSandboxBlogTranslations(post: BlogPost, locales: Omit<BlogPostTranslations, 'en'>): BlogPost {
  return {
    ...post,
    translations: {
      en: translationFieldsFromPost(post),
      ...locales,
    },
  }
}

export const SANDBOX_BLOG_TRANSLATIONS: Record<string, Omit<BlogPostTranslations, 'en'>> = {
  'browser-360-showrooms-that-convert': {
    de: {
      title: 'Browser-360°-Showrooms, die konvertieren',
      excerpt:
        'Wie immersive Panoramen Messeneugier in qualifizierte Leads verwandeln — ohne App-Installation.',
      seo_title: 'Browser-360°-Showrooms, die konvertieren — IOM',
      seo_description:
        'Immersive Panorama-Showrooms für Messen: Guided Tours, Lead Capture und WebGL ohne Apps.',
      body: `# Browser-360°-Showrooms, die konvertieren

Messebesucher erinnern Erlebnisse. Ein geführtes [360°-Panorama](/demos/panorama-360/) lässt sie Stand, Produktlinie oder Venue von jedem Gerät aus begehen.

## Was funktioniert

- Klare **Call-to-Action**-Hotspots zu Kontakt oder Broschüre
- Kurze Narration oder Captions — keine Textwände
- Schnelle Loads auf Midrange-Handys

## Interne Links (SEO)

Mehr unter [360 Tours](/#360) oder [Kontakt](/#contact), wenn Sie einen Showroom für Ihr nächstes Event brauchen.

DEMO SAMPLE — fiktives Editorial für die CRM-Blog-Sandbox.`,
    },
    fr: {
      title: 'Showrooms 360° navigateur qui convertissent',
      excerpt:
        'Comment les panoramas immersifs transforment la curiosité de salon en leads qualifiés — sans installer d’app.',
      seo_title: 'Showrooms 360° navigateur qui convertissent — IOM',
      seo_description:
        'Showrooms panoramiques immersifs pour salons : visites guidées, capture de leads et WebGL sans apps.',
      body: `# Showrooms 360° navigateur qui convertissent

Les visiteurs de salon retiennent les expériences. Un [panorama 360°](/demos/panorama-360/) guidé leur fait parcourir stand, gamme ou lieu depuis n’importe quel appareil.

## Ce qui marche

- Hotspots **CTA** clairs vers contact ou brochure
- Narration courte — pas un mur de texte
- Chargements rapides sur téléphones milieu de gamme

## Liens internes (SEO)

Explorez [360 Tours](/#360) ou [contactez-nous](/#contact) pour un showroom à votre prochain événement.

DEMO SAMPLE — éditorial fictif pour le sandbox Blog CRM.`,
    },
    nl: {
      title: 'Browser-360°-showrooms die converteren',
      excerpt:
        'Hoe immersieve panorama’s beursnieuwsgierigheid omzetten in gekwalificeerde leads — zonder app.',
      seo_title: 'Browser-360°-showrooms die converteren — IOM',
      seo_description:
        'Immersieve panorama-showrooms voor events: guided tours, lead capture en WebGL zonder apps.',
      body: `# Browser-360°-showrooms die converteren

Beursbezoekers onthouden ervaringen. Een geleide [360°-panorama](/demos/panorama-360/) laat hen stand, productlijn of venue vanaf elk device belopen.

## Wat werkt

- Duidelijke **CTA**-hotspots naar contact of brochure
- Korte narratie — geen tekstmuur
- Snelle loads op midrange-phones

## Interne links (SEO)

Bekijk [360 Tours](/#360) of [neem contact op](/#contact) voor een showroom op je volgende event.

DEMO SAMPLE — fictieve editorial voor de CRM Blog-sandbox.`,
    },
    it: {
      title: 'Showroom 360° nel browser che convertono',
      excerpt:
        'Come i panorami immersivi trasformano la curiosità da fiera in lead qualificati — senza installare un’app.',
      seo_title: 'Showroom 360° nel browser che convertono — IOM',
      seo_description:
        'Showroom panoramici immersivi per eventi: tour guidati, lead capture e WebGL senza app.',
      body: `# Showroom 360° nel browser che convertono

I visitatori di fiera ricordano le esperienze. Un [panorama 360°](/demos/panorama-360/) guidato fa percorrere stand, linea prodotto o venue da qualsiasi device.

## Cosa funziona

- Hotspot **CTA** chiari verso contatto o brochure
- Narration breve — non un muro di testo
- Carichi veloci su telefoni mid-range

## Link interni (SEO)

Esplora [360 Tours](/#360) o [contattaci](/#contact) per uno showroom al prossimo evento.

DEMO SAMPLE — editoriale fittizio per la sandbox Blog CRM.`,
    },
    es: {
      title: 'Showrooms 360° en el navegador que convierten',
      excerpt:
        'Cómo los panoramas inmersivos convierten la curiosidad de feria en leads cualificados — sin instalar una app.',
      seo_title: 'Showrooms 360° en el navegador que convierten — IOM',
      seo_description:
        'Showrooms panorámicos inmersivos para eventos: tours guiados, captura de leads y WebGL sin apps.',
      body: `# Showrooms 360° en el navegador que convierten

Los visitantes de feria recuerdan experiencias. Un [panorama 360°](/demos/panorama-360/) guiado les deja recorrer stand, línea de producto o venue desde cualquier dispositivo.

## Qué funciona

- Hotspots **CTA** claros a contacto o brochure
- Narración corta — no un muro de texto
- Cargas rápidas en móviles de gama media

## Enlaces internos (SEO)

Explora [360 Tours](/#360) o [contáctanos](/#contact) si quieres un showroom para tu próximo evento.

DEMO SAMPLE — editorial ficticio para el sandbox Blog del CRM.`,
    },
  },
  'case-study-guided-museum-companion': {
    de: {
      title: 'Case Study: geführter Museum-Companion',
      excerpt:
        'Wie ein räumlicher Web-Companion für Copper Lantern Museums Besuche über den Galerieboden hinaus verlängerte (fiktive Case Study zur Demo-Lead).',
      seo_title: 'Case Study: geführter Museum-Companion — IOM',
      seo_description:
        'Wie ein browserbasierter Guided Companion Museumsbesuche mit Spatial Storytelling und WebGL verlängerte.',
      body: `## Das Briefing

[Copper Lantern Museums](/crm-demo) (Demo-Lead) brauchte einen **Browser-Companion**, den Besucher auf dem Handy öffnen — Waypoints, kurze Stories, ruhige visuelle Sprache.

## Was wir geliefert haben

- Photogrammetrie-gestützte Räume in WebGL
- Leichte Path-UI inspiriert von [Raven Path](/demos/raven-path/)
- Analytics-Hooks, welche Stops Aufmerksamkeit halten

## Outcome (Sample)

Verweildauer an Featured Exhibits stieg; weniger „Wohin als Nächstes?“-Fragen.

Siehe [3D-Arbeit](/#3d) oder [Kontakt IOM](/#contact).

DEMO SAMPLE — Case-Study-Stil für Blog → Posts.`,
    },
    fr: {
      title: 'Étude de cas : compagnon de musée guidé',
      excerpt:
        'Comment un compagnon web spatial pour Copper Lantern Museums a prolongé les visites au-delà de la galerie (cas fictif lié au lead démo).',
      seo_title: 'Étude de cas : compagnon de musée guidé — IOM',
      seo_description:
        'Comment un compagnon guidé navigateur a prolongé les visites muséales avec storytelling spatial et WebGL.',
      body: `## Le brief

[Copper Lantern Museums](/crm-demo) (lead démo) voulait un **compagnon navigateur** sur téléphone — waypoints, courtes histoires, langage visuel calme.

## Ce que nous avons livré

- Espaces photogrammétriques en WebGL
- UI de parcours légère inspirée de [raven path](/demos/raven-path/)
- Hooks analytics sur les arrêts qui retiennent l’attention

## Résultat (échantillon)

Le temps passé sur les œuvres phares a augmenté ; moins de « où aller ensuite ? ».

Voir [travaux 3D](/#3d) ou [contacter IOM](/#contact).

DEMO SAMPLE — style étude de cas pour Blog → Posts.`,
    },
    nl: {
      title: 'Case study: geleide museum-companion',
      excerpt:
        'Hoe een spatial web-companion voor Copper Lantern Museums bezoeken verlengde voorbij de galerijvloer (fictieve case bij de demo-lead).',
      seo_title: 'Case study: geleide museum-companion — IOM',
      seo_description:
        'Hoe een browser-based geleide companion museumbezoeken verlengde met spatial storytelling en WebGL.',
      body: `## De brief

[Copper Lantern Museums](/crm-demo) (demo-lead) wilde een **browser-companion** op de telefoon — waypoints, korte verhalen, rustige visual language.

## Wat we leverden

- Photogrammetry-backed spaces in WebGL
- Lichte path-UI geïnspireerd op [raven path](/demos/raven-path/)
- Analytics-hooks voor stops die aandacht vasthouden

## Uitkomst (sample)

Dwell time op featured exhibits steeg; minder “waar nu heen?”-vragen.

Zie [3D-werk](/#3d) of [contact IOM](/#contact).

DEMO SAMPLE — case-study-stijl voor Blog → Posts.`,
    },
    it: {
      title: 'Case study: companion museale guidato',
      excerpt:
        'Come un companion web spaziale per Copper Lantern Museums ha prolungato le visite oltre la gallery (case fittizio legato al lead demo).',
      seo_title: 'Case study: companion museale guidato — IOM',
      seo_description:
        'Come un companion guidato nel browser ha prolungato le visite museali con storytelling spaziale e WebGL.',
      body: `## Il brief

[Copper Lantern Museums](/crm-demo) (lead demo) voleva un **companion browser** sul telefono — waypoint, storie brevi, linguaggio visivo calmo.

## Cosa abbiamo consegnato

- Spazi con photogrammetry in WebGL
- UI di percorso leggera ispirata a [raven path](/demos/raven-path/)
- Hook analytics su quali stop tengono attenzione

## Esito (sample)

Il dwell time sulle opere in evidenza è salito; meno domande “dove vado dopo?”.

Vedi [lavori 3D](/#3d) o [contatta IOM](/#contact).

DEMO SAMPLE — stile case study per Blog → Posts.`,
    },
    es: {
      title: 'Case study: companion guiado de museo',
      excerpt:
        'Cómo un companion web espacial para Copper Lantern Museums alargó las visitas más allá de la galería (caso ficticio ligado al lead demo).',
      seo_title: 'Case study: companion guiado de museo — IOM',
      seo_description:
        'Cómo un companion guiado en el navegador alargó visitas de museo con storytelling espacial y WebGL.',
      body: `## El brief

[Copper Lantern Museums](/crm-demo) (lead demo) necesitaba un **companion de navegador** en el móvil — waypoints, historias cortas y un lenguaje visual calmado.

## Qué entregamos

- Espacios con fotogrametría en WebGL
- UI de ruta ligera inspirada en [raven path](/demos/raven-path/)
- Hooks de analytics sobre qué paradas retienen atención

## Resultado (sample)

Subió el dwell time en piezas destacadas; menos “¿adónde voy ahora?”.

Ver [trabajo 3D](/#3d) o [contactar IOM](/#contact).

DEMO SAMPLE — estilo case study para Blog → Posts.`,
    },
  },
  'why-webgpu-particles-matter-for-brands': {
    de: {
      title: 'Warum WebGPU-Partikel für Brands zählen',
      excerpt:
        'Field Notes zu Echtzeit-Partikelsystemen als atmosphärische Brand-Momente — nicht nur Tech-Demos.',
      seo_title: 'Warum WebGPU-Partikel für Brands zählen — IOM',
      seo_description:
        'Field Notes zu WebGPU-Partikelsystemen als atmosphärische Brand-Erlebnisse im Web.',
      body: `Echtzeit-Partikel bedeuteten früher Native Apps. Mit [WebGPU-Particle-Demos](/demos/webgpu-particles/) können Brands Atmosphäre im Browser ausliefern.

## Wann einsetzen

- Product Launches mit Motion ohne Videodateien
- Spatial Identity auf Landing Pages
- Live audio-reaktive Visuals (siehe [FFT Ocean](/demos/fft-ocean/) und Music Experiments)

## Vor dem Publish

- Interne Links zu [Experiments](/#experiments) und CTA zu [/#contact](/#contact)
- SEO-Titel + Description im Blog-Editor füllen
- Public Site bleibt **Coming soon**, bis \`BLOG_PUBLIC_ENABLED\` aktiv ist

DEMO SAMPLE — Draft in Blog → Posts.`,
    },
    fr: {
      title: 'Pourquoi les particules WebGPU comptent pour les marques',
      excerpt:
        'Notes de terrain sur les systèmes de particules temps réel comme moments de marque atmosphériques — pas seulement des démos tech.',
      seo_title: 'Pourquoi les particules WebGPU comptent pour les marques — IOM',
      seo_description:
        'Notes sur les systèmes de particules WebGPU comme expériences de marque atmosphériques sur le web.',
      body: `Les particules temps réel voulaient dire apps natives. Avec les [démos particules WebGPU](/demos/webgpu-particles/), les marques livrent de l’atmosphère dans le navigateur.

## Quand les utiliser

- Lancements produit avec motion sans fichiers vidéo
- Moments d’identité spatiale sur une landing
- Visuels audio-réactifs live (voir [FFT ocean](/demos/fft-ocean/) et expériences musique)

## Avant publication

- Liens internes vers [Experiments](/#experiments) et CTA vers [/#contact](/#contact)
- Remplir titre + description SEO dans l’éditeur Blog
- Le site public reste **Coming soon** tant que \`BLOG_PUBLIC_ENABLED\` est off

DEMO SAMPLE — brouillon dans Blog → Posts.`,
    },
    nl: {
      title: 'Waarom WebGPU-particles ertoe doen voor merken',
      excerpt:
        'Veldnotities over realtime particle systems als atmosferische brand moments — niet alleen tech demo’s.',
      seo_title: 'Waarom WebGPU-particles ertoe doen voor merken — IOM',
      seo_description:
        'Veldnotities over WebGPU particle systems als atmosferische brand experiences op het web.',
      body: `Realtime particles betekenden vroeger native apps. Met [WebGPU particle demo’s](/demos/webgpu-particles/) kunnen merken sfeer in de browser shippen.

## Wanneer gebruiken

- Product launches met motion zonder videobestanden
- Spatial identity op een landing page
- Live audio-reactieve visuals (zie [FFT ocean](/demos/fft-ocean/) en music experiments)

## Voor publicatie

- Interne links naar [Experiments](/#experiments) en CTA naar [/#contact](/#contact)
- SEO title + description invullen in de Blog-editor
- Public site blijft **Coming soon** tot \`BLOG_PUBLIC_ENABLED\` aan staat

DEMO SAMPLE — draft in Blog → Posts.`,
    },
    it: {
      title: 'Perché le particelle WebGPU contano per i brand',
      excerpt:
        'Note di campo sui sistemi particellari real-time come momenti di brand atmosferici — non solo demo tech.',
      seo_title: 'Perché le particelle WebGPU contano per i brand — IOM',
      seo_description:
        'Note sui sistemi particellari WebGPU come esperienze di brand atmosferiche sul web.',
      body: `Le particelle real-time un tempo volevano dire app native. Con le [demo particelle WebGPU](/demos/webgpu-particles/), i brand consegnano atmosfera nel browser.

## Quando usarle

- Launch di prodotto con motion senza file video
- Momenti di identity spaziale su una landing
- Visual audio-reattivi live (vedi [FFT ocean](/demos/fft-ocean/) e music experiments)

## Prima di pubblicare

- Link interni a [Experiments](/#experiments) e CTA a [/#contact](/#contact)
- Compilare SEO title + description nell’editor Blog
- Il sito pubblico resta **Coming soon** finché \`BLOG_PUBLIC_ENABLED\` è off

DEMO SAMPLE — bozza in Blog → Posts.`,
    },
    es: {
      title: 'Por qué importan las partículas WebGPU para las marcas',
      excerpt:
        'Notas de campo sobre sistemas de partículas en tiempo real como momentos de marca atmosféricos — no solo demos tech.',
      seo_title: 'Por qué importan las partículas WebGPU para las marcas — IOM',
      seo_description:
        'Notas sobre sistemas de partículas WebGPU como experiencias de marca atmosféricas en la web.',
      body: `Las partículas en tiempo real antes significaban apps nativas. Con las [demos de partículas WebGPU](/demos/webgpu-particles/), las marcas pueden entregar atmósfera en el navegador.

## Cuándo usarlas

- Lanzamientos de producto con motion sin archivos de vídeo
- Momentos de identidad espacial en una landing
- Visuales audio-reactivos en vivo (ver [FFT ocean](/demos/fft-ocean/) y experiments de música)

## Antes de publicar

- Enlaces internos a [Experiments](/#experiments) y CTA a [/#contact](/#contact)
- Rellenar SEO title + description en el editor Blog
- El sitio público sigue **Coming soon** hasta activar \`BLOG_PUBLIC_ENABLED\`

DEMO SAMPLE — borrador en Blog → Posts.`,
    },
  },
  'how-we-use-the-iom-journal-for-seo': {
    de: {
      title: 'So nutzen wir das IOM Journal für SEO',
      excerpt:
        'Kurzes Playbook: Case Studies, Service-Erklärer und verifizierte Comments, die eine E-Mail-Liste wachsen lassen, ohne Adressen zu publizieren.',
      seo_title: 'So nutzen wir das IOM Journal für SEO — IOM',
      seo_description:
        'Wie IOM Case Studies, Service-Artikel und private verifizierte Comments für Search und Lead Capture nutzt.',
      body: `## Warum ein Studio-Blog

Search und AI-Answers belohnen nützliche Tiefe. Das Journal ist der Ort für:

1. Service-Erklärer (360°, WebGL, Immersive)
2. Client-Style Success Stories
3. Field Notes mit Links zu [Demos](/demos/panorama-360/) und [/#contact](/#contact)

## Comment-E-Mails bleiben privat

Leser müssen eine echte E-Mail verifizieren. Adressen erscheinen nie öffentlich — sie landen in **Blog → Emails** für das Team.

DEMO SAMPLE — SEO-/Prozess-Post für die Blog-Sandbox.`,
    },
    fr: {
      title: 'Comment nous utilisons le Journal IOM pour le SEO',
      excerpt:
        'Petit playbook : études de cas, explainer services et commentaires vérifiés qui font grandir une liste e-mail sans publier les adresses.',
      seo_title: 'Comment nous utilisons le Journal IOM pour le SEO — IOM',
      seo_description:
        'Comment IOM utilise études de cas, articles services et commentaires vérifiés privés pour le search et la capture de leads.',
      body: `## Pourquoi un blog de studio

Le search et les réponses IA récompensent la profondeur utile. Le Journal publie :

1. Explainers de services (360°, WebGL, immersif)
2. Success stories façon client
3. Field notes avec liens vers [demos](/demos/panorama-360/) et [/#contact](/#contact)

## Les e-mails de commentaires restent privés

Les lecteurs doivent vérifier un vrai e-mail. Les adresses n’apparaissent jamais en public — elles arrivent dans **Blog → Emails**.

DEMO SAMPLE — post SEO / process pour le sandbox Blog.`,
    },
    nl: {
      title: 'Hoe we het IOM Journal voor SEO gebruiken',
      excerpt:
        'Kort playbook: case studies, service-uitleg en geverifieerde comments die een e-maillijst laten groeien zonder adressen te publiceren.',
      seo_title: 'Hoe we het IOM Journal voor SEO gebruiken — IOM',
      seo_description:
        'Hoe IOM case studies, service-artikelen en privé geverifieerde comments inzet voor search en lead capture.',
      body: `## Waarom een studio-blog

Search en AI-antwoorden belonen nuttige diepte. Het Journal is waar we publiceren:

1. Service-uitleg (360°, WebGL, immersive)
2. Client-achtige success stories
3. Field notes met links naar [demos](/demos/panorama-360/) en [/#contact](/#contact)

## Comment-e-mails blijven privé

Lezers moeten een echt e-mailadres verifiëren. Adressen verschijnen nooit publiek — ze landen in **Blog → Emails**.

DEMO SAMPLE — SEO-/procespost voor de Blog-sandbox.`,
    },
    it: {
      title: 'Come usiamo lo IOM Journal per la SEO',
      excerpt:
        'Playbook breve: case study, explainer di servizio e commenti verificati che fanno crescere una lista email senza pubblicare gli indirizzi.',
      seo_title: 'Come usiamo lo IOM Journal per la SEO — IOM',
      seo_description:
        'Come IOM usa case study, articoli di servizio e commenti verificati privati per search e lead capture.',
      body: `## Perché un blog di studio

Search e risposte AI premiano la profondità utile. Il Journal pubblica:

1. Explainer di servizi (360°, WebGL, immersive)
2. Success story in stile cliente
3. Field notes con link a [demo](/demos/panorama-360/) e [/#contact](/#contact)

## Le email dei commenti restano private

I lettori devono verificare un’email reale. Gli indirizzi non compaiono mai in pubblico — arrivano in **Blog → Emails**.

DEMO SAMPLE — post SEO / process per la sandbox Blog.`,
    },
    es: {
      title: 'Cómo usamos el IOM Journal para SEO',
      excerpt:
        'Playbook corto: case studies, explainers de servicio y comentarios verificados que crecen una lista de email sin publicar direcciones.',
      seo_title: 'Cómo usamos el IOM Journal para SEO — IOM',
      seo_description:
        'Cómo IOM usa case studies, artículos de servicio y comentarios verificados privados para search y captura de leads.',
      body: `## Por qué un blog de estudio

Search y respuestas de IA premian la profundidad útil. El Journal es donde publicamos:

1. Explainers de servicio (360°, WebGL, immersive)
2. Success stories al estilo cliente
3. Field notes con enlaces a [demos](/demos/panorama-360/) y [/#contact](/#contact)

## Los emails de comentarios siguen privados

Los lectores deben verificar un email real. Las direcciones nunca aparecen en público — llegan a **Blog → Emails**.

DEMO SAMPLE — post SEO / proceso para el sandbox Blog.`,
    },
  },
}

