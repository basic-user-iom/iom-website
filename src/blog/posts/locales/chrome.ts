import type { BlogContentLocale } from '../../types'
import type { DemoSection } from '../demoPostBuilder'

export type BlogBuilderChrome = {
  sectionLabel: Record<DemoSection, string>
  livesIn: (sectionLabel: string, sectionLink: string, title: string) => string
  openDemoHeading: string
  launch: (demoLabel: string) => string
  noInstall: string
  tourBridgeHeading: string
  openPanorama: string
  playGuidedTour: string
  visitorPreview: string
  whyHeading: string
  typicalUses: string
  beginnerHeading: string
  glossaryHeading: string
  tryHeading: string
  requirementsHeading: string
  whatYouSeeHeading: string
  whatYouSeeDefault: string
  whatYouSeeTour: string
  alsoInBuild: string
  howWorksHeading: string
  faqHeading: string
  readingHeading: string
  relatedHeading: string
  relatedBrowse: (sectionLabel: string, sectionLink: string, related: string) => string
  contactUs: string
}

const en: BlogBuilderChrome = {
  sectionLabel: {
    software: 'Software',
    '3d': '3D',
    '360': '360 Tours',
    experiments: 'Experiments',
  },
  livesIn: (sectionLabel, sectionLink, title) =>
    `It lives in our [${sectionLabel} section](${sectionLink}) as **${title}**.`,
  openDemoHeading: '## Open the live demo',
  launch: (demoLabel) => `**[→ Launch ${demoLabel}]`,
  noInstall:
    'No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.',
  tourBridgeHeading: '## Also in the 360° guided tour',
  openPanorama: '**[→ Open Panorama 360]',
  playGuidedTour: 'Play guided tour',
  visitorPreview: 'visitor preview',
  whyHeading: '## Why this matters (even if you are not a developer)',
  typicalUses: 'Typical uses:',
  beginnerHeading: '## For beginners — what is this, in plain words?',
  glossaryHeading: '**Quick glossary**',
  tryHeading: '## Try this in about 60 seconds',
  requirementsHeading: '## Requirements and performance',
  whatYouSeeHeading: '## What you see',
  whatYouSeeDefault:
    'Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:',
  whatYouSeeTour:
    'The cover is guided-tour step 1; the stills below continue the same Black Witness walkthrough:',
  alsoInBuild: 'Also in this build:',
  howWorksHeading: '## How it works',
  faqHeading: '## FAQ',
  readingHeading: '## Tech stack and further reading',
  relatedHeading: '## Related on IOM',
  relatedBrowse: (sectionLabel, sectionLink, related) =>
    `Browse more in [${sectionLabel}](${sectionLink})${related ? `, plus ${related}` : ''}, or [contact us](/#contact) if you want something like this scoped for a client pitch.`,
  contactUs: 'contact us',
}

const de: BlogBuilderChrome = {
  sectionLabel: {
    software: 'Software',
    '3d': '3D',
    '360': '360°-Touren',
    experiments: 'Experimente',
  },
  livesIn: (sectionLabel, sectionLink, title) =>
    `Es liegt in unserem [${sectionLabel}-Bereich](${sectionLink}) als **${title}**.`,
  openDemoHeading: '## Live-Demo öffnen',
  launch: (demoLabel) => `**[→ ${demoLabel} starten]`,
  noInstall:
    'Für die Browser-Builds ist keine Installation nötig. Wenn eine Funktion eine neuere GPU-API braucht, sagt die Seite das klar statt still zu scheitern.',
  tourBridgeHeading: '## Auch in der 360°-Guided-Tour',
  openPanorama: '**[→ Panorama 360 öffnen]',
  playGuidedTour: 'Guided Tour abspielen',
  visitorPreview: 'Besucher-Vorschau',
  whyHeading: '## Warum das zählt (auch ohne Entwickler-Hintergrund)',
  typicalUses: 'Typische Einsätze:',
  beginnerHeading: '## Für Einsteiger — was ist das, in einfachen Worten?',
  glossaryHeading: '**Kurzes Glossar**',
  tryHeading: '## In etwa 60 Sekunden ausprobieren',
  requirementsHeading: '## Anforderungen und Performance',
  whatYouSeeHeading: '## Was Sie sehen',
  whatYouSeeDefault:
    'Zwei weitere Blickwinkel derselben Erfahrung. Das Cover ist die erste Ansicht; die Stillbilder setzen den Rundgang fort:',
  whatYouSeeTour:
    'Das Cover ist Guided-Tour-Schritt 1; die Stillbilder darunter setzen denselben Black-Witness-Rundgang fort:',
  alsoInBuild: 'Ebenfalls in diesem Build:',
  howWorksHeading: '## So funktioniert es',
  faqHeading: '## FAQ',
  readingHeading: '## Tech-Stack und weiterführende Links',
  relatedHeading: '## Verwandt bei IOM',
  relatedBrowse: (sectionLabel, sectionLink, related) =>
    `Mehr in [${sectionLabel}](${sectionLink})${related ? `, plus ${related}` : ''}, oder [kontaktieren Sie uns](/#contact), wenn Sie etwas Vergleichbares für ein Kundenpitch scoped brauchen.`,
  contactUs: 'kontaktieren Sie uns',
}

const fr: BlogBuilderChrome = {
  sectionLabel: {
    software: 'Logiciel',
    '3d': '3D',
    '360': 'Visites 360°',
    experiments: 'Expériences',
  },
  livesIn: (sectionLabel, sectionLink, title) =>
    `Il se trouve dans notre [section ${sectionLabel}](${sectionLink}) sous **${title}**.`,
  openDemoHeading: '## Ouvrir la démo en direct',
  launch: (demoLabel) => `**[→ Lancer ${demoLabel}]`,
  noInstall:
    'Aucune installation pour les builds navigateur. Si une fonction nécessite une API GPU plus récente, la page l’indique clairement au lieu d’échouer en silence.',
  tourBridgeHeading: '## Aussi dans la visite guidée 360°',
  openPanorama: '**[→ Ouvrir Panorama 360]',
  playGuidedTour: 'Lancer la visite guidée',
  visitorPreview: 'aperçu visiteur',
  whyHeading: '## Pourquoi c’est important (même sans être développeur)',
  typicalUses: 'Usages typiques :',
  beginnerHeading: '## Pour débutants — qu’est-ce que c’est, en mots simples ?',
  glossaryHeading: '**Glossaire rapide**',
  tryHeading: '## Essayez en environ 60 secondes',
  requirementsHeading: '## Prérequis et performances',
  whatYouSeeHeading: '## Ce que vous voyez',
  whatYouSeeDefault:
    'Deux autres angles de la même expérience. La couverture est la première vue ; ces images poursuivent le parcours :',
  whatYouSeeTour:
    'La couverture est l’étape 1 de la visite guidée ; les images ci-dessous poursuivent le même parcours Black Witness :',
  alsoInBuild: 'Aussi dans ce build :',
  howWorksHeading: '## Comment ça marche',
  faqHeading: '## FAQ',
  readingHeading: '## Stack technique et lectures',
  relatedHeading: '## Sur IOM',
  relatedBrowse: (sectionLabel, sectionLink, related) =>
    `Parcourez [${sectionLabel}](${sectionLink})${related ? `, plus ${related}` : ''}, ou [contactez-nous](/#contact) si vous voulez quelque chose de ce type pour un pitch client.`,
  contactUs: 'contactez-nous',
}

const nl: BlogBuilderChrome = {
  sectionLabel: {
    software: 'Software',
    '3d': '3D',
    '360': '360°-tours',
    experiments: 'Experimenten',
  },
  livesIn: (sectionLabel, sectionLink, title) =>
    `Het staat in onze [${sectionLabel}-sectie](${sectionLink}) als **${title}**.`,
  openDemoHeading: '## Open de live demo',
  launch: (demoLabel) => `**[→ Start ${demoLabel}]`,
  noInstall:
    'Geen installatie nodig voor de browser-builds. Als een functie een nieuwere GPU-API nodig heeft, zegt de pagina dat duidelijk in plaats van stil te falen.',
  tourBridgeHeading: '## Ook in de 360° guided tour',
  openPanorama: '**[→ Open Panorama 360]',
  playGuidedTour: 'Speel guided tour',
  visitorPreview: 'bezoekersvoorbeeld',
  whyHeading: '## Waarom dit telt (ook zonder ontwikkelaar te zijn)',
  typicalUses: 'Typische toepassingen:',
  beginnerHeading: '## Voor beginners — wat is dit, in gewone taal?',
  glossaryHeading: '**Korte glossary**',
  tryHeading: '## Probeer dit in ongeveer 60 seconden',
  requirementsHeading: '## Vereisten en performance',
  whatYouSeeHeading: '## Wat je ziet',
  whatYouSeeDefault:
    'Nog twee hoeken van dezelfde ervaring. De cover is de eerste view; deze stills zetten de walkthrough voort:',
  whatYouSeeTour:
    'De cover is guided-tour stap 1; de stills hieronder zetten dezelfde Black Witness-walkthrough voort:',
  alsoInBuild: 'Ook in deze build:',
  howWorksHeading: '## Hoe het werkt',
  faqHeading: '## FAQ',
  readingHeading: '## Tech stack en verder lezen',
  relatedHeading: '## Gerelateerd op IOM',
  relatedBrowse: (sectionLabel, sectionLink, related) =>
    `Bekijk meer in [${sectionLabel}](${sectionLink})${related ? `, plus ${related}` : ''}, of [neem contact op](/#contact) als je zoiets wilt scoped voor een client pitch.`,
  contactUs: 'neem contact op',
}

const it: BlogBuilderChrome = {
  sectionLabel: {
    software: 'Software',
    '3d': '3D',
    '360': 'Tour 360°',
    experiments: 'Esperimenti',
  },
  livesIn: (sectionLabel, sectionLink, title) =>
    `Si trova nella nostra [sezione ${sectionLabel}](${sectionLink}) come **${title}**.`,
  openDemoHeading: '## Apri la demo live',
  launch: (demoLabel) => `**[→ Avvia ${demoLabel}]`,
  noInstall:
    'Nessuna installazione per le build nel browser. Se una funzione richiede un’API GPU più recente, la pagina lo dice chiaramente invece di fallire in silenzio.',
  tourBridgeHeading: '## Anche nel tour guidato 360°',
  openPanorama: '**[→ Apri Panorama 360]',
  playGuidedTour: 'Avvia tour guidato',
  visitorPreview: 'anteprima visitatore',
  whyHeading: '## Perché conta (anche se non sei uno sviluppatore)',
  typicalUses: 'Usi tipici:',
  beginnerHeading: '## Per principianti — cos’è, in parole semplici?',
  glossaryHeading: '**Glossario rapido**',
  tryHeading: '## Provalo in circa 60 secondi',
  requirementsHeading: '## Requisiti e prestazioni',
  whatYouSeeHeading: '## Cosa vedi',
  whatYouSeeDefault:
    'Altri due angoli della stessa esperienza. La cover è la prima vista; queste immagini continuano il percorso:',
  whatYouSeeTour:
    'La cover è lo step 1 del tour guidato; le immagini sotto continuano lo stesso percorso Black Witness:',
  alsoInBuild: 'Anche in questa build:',
  howWorksHeading: '## Come funziona',
  faqHeading: '## FAQ',
  readingHeading: '## Stack tecnico e letture',
  relatedHeading: '## Correlati su IOM',
  relatedBrowse: (sectionLabel, sectionLink, related) =>
    `Esplora di più in [${sectionLabel}](${sectionLink})${related ? `, più ${related}` : ''}, o [contattaci](/#contact) se vuoi qualcosa di simile scoped per un pitch cliente.`,
  contactUs: 'contattaci',
}

const es: BlogBuilderChrome = {
  sectionLabel: {
    software: 'Software',
    '3d': '3D',
    '360': 'Tours 360°',
    experiments: 'Experimentos',
  },
  livesIn: (sectionLabel, sectionLink, title) =>
    `Está en nuestra [sección ${sectionLabel}](${sectionLink}) como **${title}**.`,
  openDemoHeading: '## Abrir la demo en vivo',
  launch: (demoLabel) => `**[→ Lanzar ${demoLabel}]`,
  noInstall:
    'No hace falta instalar nada en las builds del navegador. Si una función necesita una API de GPU más nueva, la página lo dice con claridad en lugar de fallar en silencio.',
  tourBridgeHeading: '## También en el tour guiado 360°',
  openPanorama: '**[→ Abrir Panorama 360]',
  playGuidedTour: 'Reproducir tour guiado',
  visitorPreview: 'vista previa de visitante',
  whyHeading: '## Por qué importa (aunque no seas desarrollador)',
  typicalUses: 'Usos típicos:',
  beginnerHeading: '## Para principiantes — ¿qué es esto, en palabras simples?',
  glossaryHeading: '**Glosario rápido**',
  tryHeading: '## Pruébalo en unos 60 segundos',
  requirementsHeading: '## Requisitos y rendimiento',
  whatYouSeeHeading: '## Lo que ves',
  whatYouSeeDefault:
    'Dos ángulos más de la misma experiencia. La portada es la primera vista; estas imágenes continúan el recorrido:',
  whatYouSeeTour:
    'La portada es el paso 1 del tour guiado; las imágenes de abajo continúan el mismo recorrido Black Witness:',
  alsoInBuild: 'También en este build:',
  howWorksHeading: '## Cómo funciona',
  faqHeading: '## FAQ',
  readingHeading: '## Stack técnico y lecturas',
  relatedHeading: '## Relacionado en IOM',
  relatedBrowse: (sectionLabel, sectionLink, related) =>
    `Explora más en [${sectionLabel}](${sectionLink})${related ? `, más ${related}` : ''}, o [contáctanos](/#contact) si quieres algo así scoped para un pitch de cliente.`,
  contactUs: 'contáctanos',
}

export const BLOG_BUILDER_CHROME: Record<BlogContentLocale, BlogBuilderChrome> = {
  en,
  de,
  fr,
  nl,
  it,
  es,
}
