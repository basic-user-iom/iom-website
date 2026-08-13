import { PROJECT_COSTS_META } from '../../project-costs/data'
import type { ProjectCostsCopy } from './types'

const specialist = PROJECT_COSTS_META.specialistDayRate
const intro = PROJECT_COSTS_META.specialistIntroDayRate
const studioFrom = PROJECT_COSTS_META.studioTeamFromDayRate
const deadline = PROJECT_COSTS_META.augustOfferDeadline

export const deProjectCosts: ProjectCostsCopy = {
  page: {
    print: 'Drucken / als PDF speichern',
    engageHeading: 'So können Sie IOM beauftragen',
    engageLead:
      'Wählen Sie die Produktionsunterstützung, die zum Projekt passt. Beginnen Sie mit einer Fachkraft, erweitern Sie die Studio-Kapazität, wenn parallele Arbeit sinnvoll ist, oder scopen Sie ein größeres Projekt mit uns.',
    refsHeading: 'Detaillierte Referenzprojekte',
    refsLead:
      'Was in jedem Beispiel enthalten war, typische Produktionsrahmen und warum die Referenz mit einer neuen Anfrage vergleichbar sein kann — oder auch nicht. Keine Festpreispakete.',
    factorsHeading: 'Was Kosten und Zeitplan beeinflusst',
    factorsLearnLabel: 'Mehr zu Preisfaktoren',
    factorsLearnTitle: 'Technische Faktoren, die den Produktionsaufwand verändern',
    glanceAria: 'Schneller Projektvergleich',
    glanceProject: 'Projekt',
    glanceEffort: 'Typischer vergleichbarer Aufwand',
    glanceDelivery: 'Typische Lieferung',
    glanceBudget: 'Indikatives Budget',
    glanceReference: 'Referenz: {title}',
    typicallyIncludes: 'Typischerweise enthalten',
    priceDrivers: 'Der Preis ändert sich meist durch',
    productAdditions: 'Mögliche produktbezogene Ergänzungen',
    viewCaseStudy: 'Case Study ansehen →',
    protoHeading: 'Mit einem fokussierten Prototyp beginnen',
    protoLead:
      'Die meisten Projekte müssen nicht mit dem vollständigen Referenz-Build starten. Ein kleiner, klar definierter Prototyp kann die zentrale Interaktion, die visuelle Richtung und den technischen Workflow prüfen, bevor der volle Produktionsumfang freigegeben wird.',
    protoNote:
      'Prototyp-Arbeit ist so strukturiert, dass nützlicher Code, Assets und Designentscheidungen wo sinnvoll in die nächste Produktionsstufe übergehen — über Research (Raven), Form (Fox) und Output (Octopus).',
    protoAria: 'Prototyp-Phasen · Research Form Output',
    howHeading: 'Kleines Kernteam, skalierbare Produktion',
    howLead:
      'IOM skaliert die Produktionskapazität nach den Bedürfnissen des Projekts. Manche Phasen übernimmt eine senior Fachkraft, produktionsintensive Phasen können erweitert werden, wenn parallele Arbeit wirklich nützlich ist.',
    estimateHeading: 'Zu diesen Schätzungen',
    estimateIntro:
      'Alle Zahlen auf dieser Seite sind indikative Planungsrahmen für vergleichbare Arbeit zu den referenzierten Case Studies. Sie sind keine Festpreise, Vertragsangebote oder Angaben zu den historischen Kosten der Originalprojekte.',
    estimateQuotes:
      'Angebote für größere Scopes werden nach einem Gespräch separat erstellt. Sofern nicht ausdrücklich im Angebot enthalten, werden die nebenstehenden Positionen in der Regel separat geschätzt.',
    estimateHighlightsAria: 'Wichtige Tarife',
    estimateHighlightsEyebrow: 'Planungsrahmen',
    estimateExcludes: 'In der Regel separat angeboten',
    checklistLabel: 'Hilfreiche Angaben:',
    viewCaseStudies: 'Alle Case Studies ansehen',
    bookConsult: 'Kostenlose Beratung buchen',
    requestEstimate: 'Projektschätzung anfragen',
    compareOptions: 'Beauftragungsoptionen vergleichen',
    startsPanelEyebrow: 'Kostenlose 30-Minuten-Beratung',
    startsPanelAria: 'Nächste Schritte',
    scopedAfterConsultation: 'Nach Beratung scoped',
    productionDay: '€{rate} / Produktionstag',
    fromProductionDay: 'Ab €{rate} / Produktionstag',
  },
  hero: {
    eyebrow: 'Scope · Zeit · Budget',
    title: 'Flexible Produktionskapazität',
    lead:
      'IOM kann für fokussierte senior Produktion, zusätzliche Studio-Kapazität oder ein größeres, scoped Projekt beauftragt werden. Das richtige Setup hängt davon ab, welche Arbeit wirklich parallel laufen kann.',
    sub:
      'Diese Seite ist transparente Orientierung, kein Katalog fester Pakete. Tagessätze qualifizieren einen Einstieg; größere Arbeit wird nach einem kurzen Gespräch scoped.',
    ctaPrimary: 'Projekt besprechen',
    ctaSecondary: 'Referenzprojekte ansehen',
  },
  engagement: {
    specialist: {
      title: 'Senior-Spezialisten-Kapazität',
      question: 'Eine erfahrene Fachkraft benötigt?',
      summary:
        'Holen Sie senior Produktionskapazität für einen klar definierten technischen oder 3D-Workstream in Ihr bestehendes Projekt.',
      rateLine: `€${specialist} / Produktionstag`,
      rateNote: 'Fokussierte senior Produktion für einen definierten Workstream.',
      learnMoreLabel: 'Mehr zur Senior-Spezialisten-Kapazität',
      learnMoreTitle: 'Senior-Spezialisten-Kapazität — technische Details',
      learnMoreParagraphs: [
        'Geeignet für klar definierte Arbeit wie Echtzeit-3D-Entwicklung, browserbasierte interaktive Komponenten, 3D-Asset-Vorbereitung und -Optimierung, Blender- oder Unreal-Produktion, CAD/BIM-zu-Realtime-Workflows, Photogrammetrie, 360-Produktion, Prototyping, Troubleshooting und technisches R&D.',
        'Eine einzelne Fachkraft hält die täglichen Produktionskosten niedriger, bietet aber weniger parallele Kapazität. Größere Pakete können daher eine längere Lieferzeit brauchen.',
        'Der genaue technische Stack wird nach dem Projekt gewählt und nicht als das Produkt selbst behandelt.',
        'Typische Tools und Formate, wenn sie nützlich sind: Three.js · WebGL / WebGPU · Blender · Unreal Engine · CAD / BIM · GLB / FBX / OBJ · Photogrammetrie · 360°-Produktion.',
      ],
    },
    'studio-capacity': {
      title: 'Zusätzliche Studio-Kapazität',
      question: 'Mehr Produktionskapazität benötigt?',
      summary:
        'IOM kann einen definierten Teil des Projekts übernehmen und parallele Produktion dort hinzufügen, wo sie den Zeitplan wirklich unterstützt.',
      rateLine: `Ab €${studioFrom} / Produktionstag`,
      rateNote: 'Zusätzliche parallele Kapazität, wenn das Projekt davon wirklich profitiert.',
      learnMoreLabel: 'Mehr zur zusätzlichen Studio-Kapazität',
      learnMoreTitle: 'Zusätzliche Studio-Kapazität — technische Details',
      learnMoreParagraphs: [
        'Für Arbeit, die von paralleler Produktion profitiert, kann IOM Kapazität in 3D-Produktion, Echtzeit-Entwicklung, Asset-Vorbereitung, Content-Integration, Optimierung und Tests hinzufügen.',
        'Mehr Personen machen nicht automatisch jede Aufgabe proportional schneller. Manche Phasen sind sequenziell, andere können parallel laufen. Das Produktions-Setup sollte den echten Abhängigkeiten des Projekts folgen.',
        'Die Kapazität kann sich je Phase ändern: eine Fachkraft in der Vorbereitung, zusätzliche Kapazität in der Produktion und wieder ein kleineres Team für finale Integration und Lieferung.',
      ],
    },
    'project-scoping': {
      title: 'Komplettes / größeres Projekt',
      question: 'Sollen wir das Projekt weiterführen?',
      summary:
        'Für größere interaktive, 3D- oder räumliche Projekte prüfen wir zuerst Ziele, Ausgangsmaterial, Lieferanforderungen und Zeitplan und empfehlen dann das passende Produktions-Setup.',
      rateLine: 'Nach Beratung scoped',
      rateNote:
        'Produktionsstruktur und Preis folgen dem echten Scope, Material, Zeitplan und den Abhängigkeiten.',
      learnMoreLabel: 'Mehr zu kompletten und größeren Projekten',
      learnMoreTitle: 'Komplettes / größeres Projekt — technische Details',
      learnMoreParagraphs: [
        'Bevor IOM ein größeres Projekt anbietet, prüft das Studio verfügbares Ausgangsmaterial, technische Anforderungen, Deliverables, Zeitplan, Integrationsverantwortung, Review-Prozess und externe Abhängigkeiten.',
        'Ziel ist, nur die Studio-Kapazität zu empfehlen, die wirklich nützlich ist. Größere Scopes können als Meilensteine, Phasen oder definierte Produktionspakete strukturiert werden — nicht als feste Kopfzahl für die gesamte Dauer.',
      ],
    },
  },
  capacity: {
    title: 'Preis und Zeit hängen über die Produktionskapazität zusammen',
    summary:
      'Eine Fachkraft hat niedrigere Tageskosten. Ein kleines Team kostet mehr pro Tag, kann aber oft mehrere Arbeitsteile gleichzeitig voranbringen. Größere Projekte können in manchen Phasen eine Person nutzen und zwei oder drei Personen nur, wenn parallele Produktion nützlich ist.',
    learnMoreLabel: 'Mehr zu Zeitplänen und Kapazität',
    learnMoreTitle: 'Zeitpläne, Kapazität und parallele Produktion',
    learnMoreParagraphs: [
      'Tagessätze beschreiben Produktionskapazität, keine Garantie, dass jede Aufgabe mit mehr Personen proportional schneller fertig wird. Manche Arbeit muss sequenziell laufen; andere Workstreams — Asset-Vorbereitung, Entwicklung, Integration, Tests — können bei sorgfältiger Planung parallel laufen.',
      'Eine einzelne Fachkraft ist oft der effizienteste Start für eine fokussierte Aufgabe oder wenn Ihr Team bereits einen Teil der Pipeline besitzt. Studio-Kapazität kommt hinzu, wenn Zeitplan oder Scope wirklich von paralleler Produktion profitieren.',
      'Angebote für größere Scopes bleiben von Tagessätzen getrennt. Das Gespräch klärt Deliverables, Zustand des Ausgangsmaterials, technischen Ansatz und den kleinsten nützlichen Kapazitätsplan, bevor die Arbeit beginnt.',
    ],
  },
  august: {
    eyebrow: 'August 2026 — einführende Verfügbarkeit',
    title: 'Begrenzte Senior-Spezialisten-Kapazität für neue Zusammenarbeit',
    lines: [
      `Für neue Zusammenarbeit, die bis zum ${deadline} bestätigt wird, steht eine begrenzte Menge senior Spezialisten-Kapazität zu €${intro} / Produktionstag statt des Standardtarifs von €${specialist} / Produktionstag zur Verfügung.`,
      'Der vereinbarte Einführungstarif kann über August hinaus für den zunächst bestätigten Scope gelten.',
    ],
    cta: 'Nach August-Verfügbarkeit fragen',
  },
  examples: {
    title: 'Referenzprojekte',
    lead:
      'Diese Beispiele zeigen die ungefähre Größenordnung früherer Arbeit. Sie sind keine Festpakete; finaler Scope, Zeitplan und Produktionskapazität hängen vom Ausgangsmaterial, den Interaktionsanforderungen und dem Lieferkontext ab.',
    glanceNote:
      'Eine Zeile wählen, um zur detaillierten Referenzkarte zu scrollen. Zahlen sind Planungsrahmen, keine Katalogpreise.',
    rangeNote:
      'Das untere Ende setzt in der Regel einen klar definierten Scope, gut vorbereitete Assets, einen Standard-Produktionszeitplan und begrenzte technische Unsicherheit voraus. Komplexe Integrationen, Spezialentwicklung, unvollständiges Ausgangsmaterial oder beschleunigte Lieferung können das finale Angebot erhöhen.',
  },
  factorsSimple:
    'Die Schätzung hängt davon ab, was gebaut werden muss, in welchem Zustand Ihr Ausgangsmaterial ist, wie komplex Interaktion und Visuals sein sollen und wie schnell geliefert werden muss.',
  factors: [
    { title: 'Qualität und Zustand des Ausgangsmaterials', text: 'Saubere, produktionsreife Assets gegenüber unvollständigem oder schwierigem CAD/BIM/3D-Quelldaten.' },
    { title: 'Interaktionskomplexität', text: 'Einfache Präsentation gegenüber eigener Echtzeit-Logik, Tools, Konfiguration oder mehrstufigen Verhaltensweisen.' },
    { title: 'Visuelle Komplexität', text: 'Anzahl der Umgebungen, Objekte, Materialien, Lichtanforderungen, Animation und Content-Zustände.' },
    { title: 'Integrationsanforderungen', text: 'Eigenständiges Modul gegenüber Integration in eine bestehende Website, ein Softwareprodukt oder eine Kunden-Pipeline.' },
    { title: 'Performance- und QA-Anforderungen', text: 'Unterstützte Browser, Geräte, Mobile-Ziele, GPU-Grenzen und Optimierungsziele.' },
    { title: 'Zeitplan', text: 'Gestauchte Zeitpläne können mehr parallele Produktionskapazität erfordern.' },
    { title: 'Feedback- und Revisionsstruktur', text: 'Eine Entscheidungsperson und definierte Review-Runden unterscheiden sich von fortlaufenden Änderungen mit vielen Stakeholdern.' },
    { title: 'Drittkosten', text: 'Bezahlte Assets, Lizenzen, spezielles Hosting, externe Dienste, Reise oder Hardware sollten wo relevant separat angeboten werden.' },
    { title: 'Laufende Betreuung', text: 'Wartung, Content-Updates oder Support nach Launch können bei Bedarf separat strukturiert werden.' },
  ],
  starts: {
    title: 'So startet ein Projekt',
    lead: 'Vier klare Schritte vom ersten Gespräch zur scoped Schätzung. Keine Verpflichtung, bis Sie Ansatz und Budget freigeben.',
    steps: [
      { title: 'Idee teilen', text: 'Erzählen Sie uns, was Sie bauen möchten — auch wenn das Briefing noch grob ist.' },
      { title: 'Gemeinsam prüfen', text: 'Wir prüfen Ziel, verfügbares Ausgangsmaterial, Lieferformat und Termin.' },
      { title: 'Kapazität zuordnen', text: 'Wir empfehlen, ob die Arbeit am besten von einer Fachkraft, zusätzlicher Studio-Kapazität oder einem scoped Projektteam übernommen wird.' },
      { title: 'Klare Schätzung erhalten', text: 'Sie erhalten Scope, Produktionsansatz und Schätzung, bevor die Arbeit beginnt.' },
    ],
    footer:
      'Bei größeren Projekten kann sich die Kapazität während der Produktion ändern, sodass Sie nicht für ein größeres Team in Phasen zahlen, die es nicht brauchen.',
    consultationNote:
      'Jedes potenzielle Projekt kann mit einer kostenlosen 30-Minuten-Beratung beginnen. Technische Recherche, Dateiprüfung, Workflow-Tests, Designarbeit und Prototyp-Entwicklung werden bei Bedarf separat angeboten.',
    cta: 'Kostenlose Beratung buchen',
  },
  prototype: [
    {
      title: 'Die Herausforderung definieren',
      text: 'Definiert das zentrale Ziel, die primäre Interaktion und das wichtigste Projektergebnis.',
      stage: 'Research',
      stageLine: 'Versteht Kundin oder Kunde, Publikum, Geschichte und technische Herausforderung, bevor etwas gebaut wird.',
    },
    {
      title: 'Die Lösung formen',
      text: 'Baut und testet eine fokussierte Arbeitsversion mit repräsentativem Content und realistischen technischen Bedingungen.',
      stage: 'Form',
      stageLine: 'Übersetzt die Recherche in eine klare visuelle Sprache, Interaktionsstruktur und technischen Ansatz.',
    },
    {
      title: 'Das Ergebnis liefern',
      text: 'Erweitert die freigegebene Lösung zur vollständigen Erfahrung, zusätzlichem Content und Produktions-Deployment.',
      stage: 'Output',
      stageLine: 'Verfeinert und liefert das fertige Ergebnis als Erfahrung, die Menschen öffnen, verstehen und nutzen können.',
    },
  ],
  howIomWorks: [
    {
      title: 'Kapazität folgt der Arbeit',
      text: 'IOM skaliert die Produktionskapazität nach den Bedürfnissen des Projekts. Manche Phasen übernimmt eine senior Fachkraft, produktionsintensive Phasen können erweitert werden, wenn parallele Arbeit wirklich nützlich ist.',
    },
    {
      title: 'Klares Produktions-Setup',
      text: 'Bei größeren Engagements wird das Produktions-Setup im Voraus vereinbart, damit Verantwortlichkeiten, Kapazität und Kommunikation über das Projekt hinweg klar bleiben.',
    },
    {
      title: 'Klare Stufen',
      text: 'Recherche, Prototyp, Produktion und Lieferung können als getrennte Stufen angeboten werden, sodass der Scope vor jeder größeren Verpflichtung geprüft werden kann.',
    },
  ],
  finalCta: {
    title: 'Erzählen Sie uns, was Sie bauen möchten',
    lead:
      'Sie brauchen kein technisches Briefing. Schicken Sie uns das Ziel, was Sie bereits haben und das Datum, auf das Sie hinarbeiten. Wir helfen, das passende Produktions-Setup zu bestimmen.',
    cta: 'Projekt besprechen',
  },
  contactChecklist: [
    'Hauptziel des Projekts',
    'Zielgruppe',
    'Vorhandene 3D-, 360°- oder Medien-Assets',
    'Gewünschte Auslieferung: Website, Desktop, Mobile, VR oder Installation',
    'Bevorzugtes Fertigstellungsdatum',
    'Ungefähres Budget, sofern bekannt',
  ],
  selectedSupport: {
    title: 'Ausgewählte Projektunterstützung',
    lead:
      'Projekte mit besonders starkem kreativem, technischem, kulturellem, pädagogischem oder sozialem Wert können gelegentlich zusätzliche Unterstützung von IOM erhalten. Wenn das Projekt gut passt und der Produktionsplan es zulässt, kann das eine reduzierte Projektgebühr oder eine klar definierte Zahl kostenloser Produktionsstunden sein.',
    footer: 'Jede solche Unterstützung wird einzeln geprüft und vor Produktionsbeginn schriftlich vereinbart.',
  },
  estimate: {
    productionTime:
      'Die angegebenen Zeitpläne beschreiben ungefähre aktive Produktionszeiträume. Die kalendarische Lieferung kann auch von der Verfügbarkeit von Kundenmaterial, konsolidiertem Feedback, externen Freigaben, Drittdiensten und dem Zeitpunkt von Projektentscheidungen abhängen.',
    blended:
      'Der typische Produktionstarif von IOM liegt zwischen 75 € und 110 € pro Stunde, abhängig von technischer Komplexität, Spezialanforderungen, Asset-Bereitschaft und Lieferzeitraum. Definierte Projekte können als feste Produktionsstufen oder mit einem gemischten Projekttarif angeboten werden. Die Referenzbudgets unten sind daher Planungsrahmen und keine direkte Multiplikation jeder geschätzten Stunde mit dem höchsten Stundensatz.',
    highlights: [
      { label: 'Senior-Spezialisten-Kapazität', value: `€${specialist} / Produktionstag` },
      { label: 'Zusätzliche Studio-Kapazität', value: `ab €${studioFrom} / Produktionstag` },
      { label: 'Größere / komplette Projekte', value: 'Nach Beratung scoped' },
    ],
    exclusions: [
      'Reise',
      'Fotografie vor Ort',
      'Scanning',
      'Bezahlte Assets',
      'Drittanbieter-Softwarelizenzen',
      'Hosting-Kosten',
      'Steuern',
      'Laufende Wartung',
    ],
  },
  references: {
    cursor: {
      category: 'UI · Cursor · Interaktion',
      glanceCategory: 'Individuelle Website-Interaktion',
      title: 'Labelled Custom Cursor',
      description:
        'Ein kontextsensitiver Cursor für eine bestehende Website, inklusive beschrifteter Interaktionszustände, Hover-Verhalten, animierter Pointer-Übergänge und eines Standard-Fallbacks für Mobile.',
      imageAlt: 'Case Study Labelled Custom Cursor',
      learnMoreLabel: 'Mehr zu Scope und Preis',
      tiers: [{ label: 'Typischer vergleichbarer Aufwand', hours: '4–7 Produktionsstunden', delivery: 'Etwa 1 Arbeitstag' }],
      includes: [
        'Visuelles Cursor-Konzept',
        'Individuelles Pointer- und Label-Styling',
        'Hover-Zustände für Links, Buttons und ausgewählte Elemente',
        'Grundlegende Pointer-Animation',
        'Integration in eine bestehende, funktionierende Website',
        'Desktop-Browser-Tests',
        'Standard-Mobile-Fallback',
      ],
      priceDrivers: [
        'Anzahl der Cursor-Zustände',
        'Komplexität der Animation',
        'Bestehendes Website-Framework',
        'Zustand und Struktur des Website-Codes',
        'Zusätzliches seitenbezogenes Verhalten',
        'Konfigurations- oder Bearbeitungssteuerungen',
        'Dringende Lieferanforderungen',
      ],
      assumption:
        'Dieser Rahmen gilt, wenn der Cursor in eine bestehende, funktionierende Website eingefügt wird und die benötigten Interaktionszustände klar definiert sind. Breitere Interface-Neugestaltung, umfangreiche Animationssysteme, komplexe CMS-Integration oder beschleunigte Lieferung werden separat geschätzt.',
    },
    'black-witness': {
      category: '360° · Storytelling · WebGPU',
      glanceCategory: 'Geführte 360°-Erfahrung',
      title: 'The Black Witness',
      description:
        'Eine geführte 360°-Storytelling-Erfahrung mit equirektangularen Szenen, strukturierter Navigation, Hotspots, Interface-Design, visuellen Effektlagen und einer teilbaren browserbasierten Präsentation.',
      imageAlt: 'Case Study The Black Witness 360°',
      learnMoreLabel: 'Mehr zu Scope und Preis',
      tiers: [
        { label: 'Fokussierte Version', hours: '40–80 Produktionsstunden', delivery: '1–2 Wochen' },
        { label: 'Case-Study-Niveau', hours: '80–160 Produktionsstunden', delivery: '2–4 Wochen' },
      ],
      includes: [
        'Eine oder mehrere gelieferte 360°-Szenen',
        'Hotspot- und Annotationssystem',
        'Geführte Kamerabewegung',
        'Interface- und Navigationsdesign',
        'Responsive Browser-Präsentation',
        'Visuelle Effektlagen',
        'Deployment und Tests',
      ],
      priceDrivers: [
        'Anzahl der Panoramen',
        'Anzahl und Komplexität der Hotspots',
        'Ob finales Bildmaterial bereits vorliegt',
        'Eigene Animation oder WebGPU-Effekte',
        'Audio, Narration und Barrierefreiheit',
        'Content-Vorbereitung und Copywriting',
        'Gewünschter Lieferzeitraum',
      ],
      assumption:
        'Der Rahmen setzt voraus, dass finales 360°-Bildmaterial und freigegebener narrativer Content vom Kunden geliefert werden. Fotografie, Scanning, Reise und Content-Produktion werden separat angeboten.',
    },
    miab: {
      category: 'WebGPU · Ozean · Interaktion',
      glanceCategory: 'Echtzeit-Browsererlebnis',
      title: 'Message in a Bottle',
      description:
        'Ein originales Echtzeit-Browsererlebnis mit prozeduralem Wasser und Himmel, animierten Objekten, Interface-Design, Tag- und Nachtzuständen, einem Nachrichtenfluss und teilbarer interaktiver Ausgabe.',
      imageAlt: 'Case Study Message in a Bottle',
      learnMoreLabel: 'Mehr zu Scope und Preis',
      tiers: [
        { label: 'Fokussierter Prototyp', hours: '80–160 Produktionsstunden', delivery: '2–4 Wochen' },
        { label: 'Case-Study-Niveau', hours: '160–320 Produktionsstunden', delivery: '4–7 Wochen' },
      ],
      includes: [
        'Kreatives und technisches Konzept',
        'Echtzeit-Ozean- und Himmelumgebung',
        'Objektanimation und Interaktion',
        'Nachrichten-Interface',
        'Tag-, Nacht- oder Wetterzustände',
        'Responsive Browser-Auslieferung',
        'Performance-Optimierung',
        'Cross-Browser-Tests',
      ],
      priceDrivers: [
        'Gewünschter visueller Realismus',
        'Anzahl der Umgebungszustände',
        'Sharing-, Speicher- oder Backend-Funktionen',
        'Eigene 3D-Asset-Produktion',
        'Mobile-Performance-Anforderungen',
        'Sounddesign und zusätzliche Animation',
        'Beschleunigte Lieferung oder Launch-Termine',
      ],
    },
    viewer: {
      category: 'Three.js · WebGL · Produkt',
      glanceCategory: 'Individuelle 3D-Software',
      title: 'Custom 3D Viewer',
      description:
        'Ein individueller Browser- oder Desktop-3D-Viewer mit Modellladen, Interface-Architektur, Kamera- und Navigationstools, Licht, Umgebung, Optimierung, Tests und Deployment.',
      imageAlt: 'Case Study 3D Viewer',
      learnMoreLabel: 'Mehr zu Scope und Preis',
      tiers: [
        { label: 'Fokussierte Anpassung', hours: '120–240 Produktionsstunden', delivery: '3–6 Wochen' },
        { label: 'Neue produktnahe Plattform', hours: '320–640 Produktionsstunden', delivery: '8–16 Wochen' },
      ],
      includes: [
        'Projektspezifisches Viewer-Interface',
        'Modellimport und Vorbereitungs-Workflow',
        'Kamera- und Navigationssteuerung',
        'Objektauswahl und Information',
        'Licht- und Umgebungssetup',
        'Performance-Optimierung',
        'Responsives Interface',
        'Deployment und technische Tests',
      ],
      productAdditions: [
        'Mehrere Modellformate',
        'Gespeicherte Blickpunkte',
        'Messungen',
        'Annotationen und Hotspots',
        'Schnittebenen',
        'Objekt-Sichtbarkeitssteuerung',
        'Projektspeicherung',
        'Benutzerkonten',
        'Kundenspezifisches Branding',
        'Desktop-Electron-Auslieferung',
        'Backend- oder Datenbankintegration',
      ],
      explainer:
        'Ein projektspezifischer Viewer auf Basis eines bestehenden IOM-Frameworks kann deutlich schneller geliefert werden als eine neue Softwareplattform. Der höhere Rahmen gilt, wenn der Viewer neue Interface-Architektur, eigene Tools, Datenhandling, Integrationen, beschleunigte Lieferung und Tests auf Produktniveau braucht.',
    },
  },
  inquiry: {
    requestType: 'Anfrageart',
    consultation: 'Kostenlose Beratung',
    estimate: 'Projektschätzung',
    name: 'Name',
    email: 'E-Mail',
    company: 'Firma oder Organisation',
    timeframe: 'Bevorzugter Lieferzeitraum',
    budget: 'Ungefähres Budget',
    message: 'Bitte eine kurze Projektbeschreibung angeben.',
    optional: '(optional)',
    timeframePh: 'z. B. innerhalb von 6 Wochen, Q4, flexibel',
    budgetPh: 'z. B. €5.000–€15.000',
    messagePh:
      'Beschreiben Sie die Hauptidee, die Zielgruppe, vorhandenes Material und was die Erfahrung erreichen soll.',
    sending: 'Wird gesendet…',
    success: 'Nachricht an projects@iobjectm.com gesendet — wir antworten innerhalb von zwei Werktagen.',
    error: 'Nachricht konnte nicht gesendet werden. Bitte schreiben Sie direkt an projects@iobjectm.com.',
    required: 'Bitte dieses Feld ausfüllen.',
    invalidEmail: 'Bitte eine gültige E-Mail-Adresse eingeben.',
    messageShort: 'Bitte eine kurze Projektbeschreibung angeben.',
    emailDirect: 'direkt an projects@iobjectm.com schreiben',
  },
}
