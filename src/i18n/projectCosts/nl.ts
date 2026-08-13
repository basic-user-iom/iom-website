import { PROJECT_COSTS_META } from '../../project-costs/data'
import type { ProjectCostsCopy } from './types'

const specialist = PROJECT_COSTS_META.specialistDayRate
const intro = PROJECT_COSTS_META.specialistIntroDayRate
const studioFrom = PROJECT_COSTS_META.studioTeamFromDayRate
const deadline = PROJECT_COSTS_META.augustOfferDeadline

export const nlProjectCosts: ProjectCostsCopy = {
  page: {
    print: 'Printen / opslaan als PDF',
    engageHeading: 'Zo kun je IOM inschakelen',
    engageLead:
      'Kies het niveau van productieondersteuning dat bij het project past. Begin met één specialist, voeg studiocapaciteit toe wanneer parallel werk zinvol is, of scope een groter project met ons.',
    refsHeading: 'Gedetailleerde referentieprojecten',
    refsLead:
      'Wat in elk voorbeeld was inbegrepen, typische productiebereiken en waarom de referentie wel of niet vergelijkbaar kan zijn met een nieuw verzoek. Geen vaste pakketprijzen.',
    factorsHeading: 'Wat kosten en planning beïnvloedt',
    factorsLearnLabel: 'Meer over prijsfactoren',
    factorsLearnTitle: 'Technische factoren die de productie-inspanning veranderen',
    glanceAria: 'Snelle projectvergelijking',
    glanceProject: 'Project',
    glanceEffort: 'Typische vergelijkbare inzet',
    glanceDelivery: 'Typische levering',
    glanceBudget: 'Indicatief budget',
    glanceReference: 'Referentie: {title}',
    typicallyIncludes: 'Omvat doorgaans',
    priceDrivers: 'De prijs verandert meestal door',
    productAdditions: 'Mogelijke productaanvullingen',
    viewCaseStudy: 'Case study bekijken →',
    protoHeading: 'Begin met een gerichte prototype',
    protoLead:
      'De meeste projecten hoeven niet te starten met de volledige referentie-build. Een kleiner, duidelijk afgebakend prototype kan de centrale interactie, visuele richting en technische workflow valideren voordat de volledige productiescope wordt goedgekeurd.',
    protoNote:
      'Prototypewerk is zo opgezet dat nuttige code, assets en ontwerpbeslissingen waar praktisch doorgaan naar de volgende productiefase — via Research (Raven), Form (Fox) en Output (Octopus).',
    protoAria: 'Prototypefasen · Research Form Output',
    howHeading: 'Klein kernteam, schaalbare productie',
    howLead:
      'IOM schaalt productiecapaciteit naar de behoeften van het project. Sommige fasen kan één senior specialist doen, terwijl productieve fasen groeien wanneer parallel werk echt nuttig is.',
    estimateHeading: 'Over deze schattingen',
    estimateIntro:
      'Alle cijfers op deze pagina zijn indicatieve planningsbereiken voor werk dat vergelijkbaar is met de case studies. Het zijn geen vaste pakketprijzen, contractoffertes of de exacte historische kosten van de oorspronkelijke projecten.',
    estimateQuotes:
      'Offertes voor grotere scopes worden na overleg apart opgesteld. Tenzij specifiek in een offerte opgenomen, worden de naastgelegen posten meestal apart geschat.',
    estimateHighlightsAria: 'Belangrijke tarieven',
    estimateHighlightsEyebrow: 'Planningsbereiken',
    estimateExcludes: 'Meestal apart geoffreerd',
    checklistLabel: 'Nuttige informatie om mee te sturen:',
    viewCaseStudies: 'Alle case studies bekijken',
    bookConsult: 'Gratis consult boeken',
    requestEstimate: 'Projectschatting aanvragen',
    compareOptions: 'Inschakelopties vergelijken',
    startsPanelEyebrow: 'Gratis consult van 30 minuten',
    startsPanelAria: 'Volgende stappen',
    scopedAfterConsultation: 'Gescooped na overleg',
    productionDay: '€{rate} / productiedag',
    fromProductionDay: 'Vanaf €{rate} / productiedag',
  },
  hero: {
    eyebrow: 'Scope · Tijd · Budget',
    title: 'Flexibele productiecapaciteit',
    lead:
      'IOM kan worden ingeschakeld voor gerichte senior productie, extra studiocapaciteit, of een groter gescooped project. De juiste opzet hangt af van welk werk écht parallel kan lopen.',
    sub:
      'Deze pagina is transparante begeleiding, geen catalogus van vaste pakketten. Dagtarieven kwalificeren een startpunt; groter werk wordt na een kort gesprek gescooped.',
    ctaPrimary: 'Een project bespreken',
    ctaSecondary: 'Referentieprojecten bekijken',
  },
  engagement: {
    specialist: {
      title: 'Senior specialistcapaciteit',
      question: 'Eén ervaren specialist nodig?',
      summary:
        'Haal senior productiecapaciteit binnen voor een duidelijk afgebakende technische of 3D-werkstroom in je bestaande project.',
      rateLine: `€${specialist} / productiedag`,
      rateNote: 'Gerichte senior productie voor een gedefinieerde werkstroom.',
      learnMoreLabel: 'Meer over senior specialistcapaciteit',
      learnMoreTitle: 'Senior specialistcapaciteit — technische details',
      learnMoreParagraphs: [
        'Geschikt voor duidelijk afgebakend werk zoals realtime 3D-ontwikkeling, interactieve browsercomponenten, 3D-assetvoorbereiding en -optimalisatie, Blender- of Unreal-productie, CAD/BIM-naar-realtime workflows, fotogrammetrie, 360-productie, prototyping, troubleshooting en technische R&D.',
        'Eén specialist houdt de dagelijkse productiekosten lager, maar biedt minder parallelle capaciteit. Grotere pakketten kunnen daardoor een langere levertijd vragen.',
        'De exacte technische stack wordt gekozen naar het project en niet als het product zelf behandeld.',
        'Typische tools en formaten wanneer ze nuttig zijn: Three.js · WebGL / WebGPU · Blender · Unreal Engine · CAD / BIM · GLB / FBX / OBJ · fotogrammetrie · 360°-productie.',
      ],
    },
    'studio-capacity': {
      title: 'Extra studiocapaciteit',
      question: 'Meer productiecapaciteit nodig?',
      summary:
        'IOM kan een gedefinieerd deel van het project overnemen en parallelle productie toevoegen waar dat de planning écht helpt.',
      rateLine: `Vanaf €${studioFrom} / productiedag`,
      rateNote: 'Extra parallelle capaciteit wanneer het project daar écht baat bij heeft.',
      learnMoreLabel: 'Meer over extra studiocapaciteit',
      learnMoreTitle: 'Extra studiocapaciteit — technische details',
      learnMoreParagraphs: [
        'Voor werk dat baat heeft bij parallelle productie kan IOM capaciteit toevoegen in 3D-productie, realtime ontwikkeling, assetvoorbereiding, contentintegratie, optimalisatie en testing.',
        'Meer mensen maken niet automatisch elke taak evenredig sneller. Sommige fasen zijn sequentieel, andere kunnen parallel lopen. De productie-opzet moet de echte afhankelijkheden van het project volgen.',
        'Capaciteit kan per fase wisselen: één specialist tijdens de voorbereiding, extra capaciteit tijdens productie, en weer een kleiner team voor finale integratie en oplevering.',
      ],
    },
    'project-scoping': {
      title: 'Compleet / groter project',
      question: 'Moeten we het project verder brengen?',
      summary:
        'Voor grotere interactieve, 3D- of ruimtelijke projecten bekijken we eerst de doelen, het bronmateriaal, de leveringsvereisten en de planning, en raden daarna de juiste productie-opzet aan.',
      rateLine: 'Gescooped na overleg',
      rateNote: 'Productiestructuur en prijs volgen de echte scope, het materiaal, de planning en de afhankelijkheden.',
      learnMoreLabel: 'Meer over complete en grotere projecten',
      learnMoreTitle: 'Compleet / groter project — technische details',
      learnMoreParagraphs: [
        'Voordat IOM een groter project offerteert, bekijkt het studio beschikbaar bronmateriaal, technische eisen, deliverables, tijdlijn, integratieverantwoordelijkheden, reviewproces en externe afhankelijkheden.',
        'Het doel is alleen het niveau van studiocapaciteit aan te raden dat écht nuttig is. Grotere scopes kunnen als mijlpalen, fasen of gedefinieerde productiepakketten worden opgezet, niet als een vaste bezetting voor de hele duur.',
      ],
    },
  },
  capacity: {
    title: 'Prijs en tijd hangen samen via productiecapaciteit',
    summary:
      'Eén specialist heeft lagere dagkosten. Een klein team kost meer per dag maar kan vaak meerdere onderdelen tegelijk vooruitbrengen. Grotere projecten kunnen in sommige fasen één persoon inzetten en twee of drie alleen wanneer parallelle productie nuttig is.',
    learnMoreLabel: 'Meer over planning en capaciteit',
    learnMoreTitle: 'Planning, capaciteit en parallelle productie',
    learnMoreParagraphs: [
      'Dagtarieven beschrijven productiecapaciteit, geen garantie dat elke taak evenredig sneller klaar is met meer mensen. Sommig werk moet sequentieel; andere stromen — assetvoorbereiding, ontwikkeling, integratie, testing — kunnen parallel lopen als ze zorgvuldig zijn gepland.',
      'Eén specialist is vaak het efficiëntste startpunt voor een gerichte taak, of wanneer je eigen team al een deel van de pipeline heeft. Studiocapaciteit komt erbij wanneer planning of scope écht baat heeft bij parallelle productie.',
      'Offertes voor grotere scopes blijven los van dagtarieven. Het gesprek stelt deliverables, staat van het bronmateriaal, technische aanpak en het kleinste nuttige capaciteitsplan vast voordat het werk begint.',
    ],
  },
  august: {
    eyebrow: 'Augustus 2026 — introductiebeschikbaarheid',
    title: 'Beperkte senior specialistcapaciteit voor nieuwe samenwerkingen',
    lines: [
      `Voor nieuwe samenwerkingen die uiterlijk ${deadline} zijn bevestigd, is een beperkte hoeveelheid senior specialistcapaciteit beschikbaar voor €${intro} / productiedag in plaats van het standaardtarief van €${specialist} / productiedag.`,
      'Het afgesproken introductietarief kan na augustus doorlopen voor de eerst bevestigde scope.',
    ],
    cta: 'Vragen naar beschikbaarheid in augustus',
  },
  examples: {
    title: 'Referentieprojecten',
    lead:
      'Deze voorbeelden tonen de ruwe schaal van eerder werk. Het zijn geen vaste pakketten; uiteindelijke scope, planning en productiecapaciteit hangen af van bronmateriaal, interactie-eisen en leveringscontext.',
    glanceNote:
      'Selecteer een rij om naar de gedetailleerde referentiekaart te scrollen. Cijfers zijn planningsbereiken, geen catalogusprijzen.',
    rangeNote:
      'De onderkant van het bereik gaat meestal uit van een duidelijk afgebakende scope, goed voorbereide assets, een standaard productieplanning en beperkte technische onzekerheid. Complexe integraties, specialistische ontwikkeling, onvolledig bronmateriaal of versnelde levering kunnen de uiteindelijke offerte verhogen.',
  },
  factorsSimple:
    'De schatting hangt af van wat er gebouwd moet worden, de staat van je bronmateriaal, hoe complex interactie en beeld moeten zijn, en hoe snel het geleverd moet worden.',
  factors: [
    { title: 'Kwaliteit en staat van bronmateriaal', text: 'Schone, productieklaire assets versus onvolledige of lastige CAD/BIM/3D-brondata.' },
    { title: 'Interactiecomplexiteit', text: 'Eenvoudige presentatie versus eigen realtime logica, tools, configuratie of meerstapsgedrag.' },
    { title: 'Visuele complexiteit', text: 'Aantal omgevingen, objecten, materialen, lichtvereisten, animatie en contentstaten.' },
    { title: 'Integratievereisten', text: 'Op zichzelf staande module versus integratie in een bestaande site, softwareproduct of keten van de klant.' },
    { title: 'Performance en QA', text: 'Ondersteunde browsers, apparaten, mobiele doelen, GPU-beperkingen en optimalisatiedoelen.' },
    { title: 'Planning', text: 'Samengedrukte tijdlijnen kunnen meer parallelle productiecapaciteit vragen.' },
    { title: 'Feedback- en revisiestructuur', text: 'Eén beslisser en gedefinieerde reviewrondes verschillen van doorlopende wijzigingen met veel stakeholders.' },
    { title: 'Derde-partijkosten', text: 'Betaalde assets, licenties, speciaal hosting, externe diensten, reizen of hardware moeten waar relevant apart worden geoffreerd.' },
    { title: 'Doorlopende support', text: 'Onderhoud, contentupdates of support na launch kunnen indien nodig apart worden ingericht.' },
  ],
  starts: {
    title: 'Hoe een project start',
    lead: 'Vier duidelijke stappen van het eerste gesprek naar een gescoopte schatting. Geen verplichting tot je aanpak en budget goedkeurt.',
    steps: [
      { title: 'Deel het idee', text: 'Vertel wat je wilt bouwen — ook als de brief nog grof is.' },
      { title: 'Samen bekijken', text: 'We bekijken het doel, beschikbaar bronmateriaal, leveringsformaat en deadline.' },
      { title: 'Capaciteit matchen', text: 'We adviseren of het werk het beste past bij één specialist, extra studiocapaciteit, of een gescoopt projectteam.' },
      { title: 'Ontvang een heldere schatting', text: 'Je ontvangt scope, productieaanpak en schatting voordat het werk begint.' },
    ],
    footer:
      'Bij grotere projecten kan de capaciteit tijdens de productie wijzigen, zodat je niet betaalt voor een groter team in fasen die dat niet nodig hebben.',
    consultationNote:
      'Elk potentieel project kan beginnen met een gratis consult van 30 minuten. Technisch onderzoek, bestandsinspectie, workflowtests, ontwerpwerk en prototype-ontwikkeling worden apart geoffreerd wanneer dat nodig is.',
    cta: 'Gratis consult boeken',
  },
  prototype: [
    { title: 'De uitdaging definiëren', text: 'Definieert het centrale doel, de primaire interactie en het belangrijkste projectresultaat.', stage: 'Research', stageLine: 'Begrijpt de klant, het publiek, het verhaal en de technische uitdaging voordat er iets wordt gebouwd.' },
    { title: 'De oplossing vormen', text: 'Bouwt en test een gerichte werkversie met representatieve content en realistische technische omstandigheden.', stage: 'Form', stageLine: 'Zet het onderzoek om in een heldere visuele taal, interactiestructuur en technische aanpak.' },
    { title: 'Het resultaat opleveren', text: 'Breidt de goedgekeurde oplossing uit tot de complete ervaring, extra content en productiedeployment.', stage: 'Output', stageLine: 'Verfijnt en levert het eindresultaat als een ervaring die mensen kunnen openen, begrijpen en gebruiken.' },
  ],
  howIomWorks: [
    { title: 'Capaciteit volgt het werk', text: 'IOM schaalt productiecapaciteit naar de behoeften van het project. Sommige fasen kan één senior specialist doen, terwijl productieve fasen groeien wanneer parallel werk écht nuttig is.' },
    { title: 'Duidelijke productie-opzet', text: 'Bij grotere opdrachten wordt de productie-opzet vooraf afgesproken, zodat verantwoordelijkheden, capaciteit en communicatie helder blijven.' },
    { title: 'Duidelijke stappen', text: 'Onderzoek, prototype, productie en oplevering kunnen als aparte stappen worden geoffreerd, zodat de scope vóór elke grotere commitment kan worden herzien.' },
  ],
  finalCta: {
    title: 'Vertel wat je wilt bouwen',
    lead: 'Je hebt geen technische brief nodig. Stuur het doel, wat je al hebt, en de datum waarnaartoe je werkt. Wij helpen de juiste productie-opzet te bepalen.',
    cta: 'Een project bespreken',
  },
  contactChecklist: [
    'Hoofddoel van het project',
    'Beoogd publiek',
    'Bestaande 3D-, 360°- of media-assets',
    'Gewenste oplevering: website, desktop, mobiel, VR of installatie',
    'Voorkeursdatum van afronding',
    'Ongeveer beschikbaar budget, indien bekend',
  ],
  selectedSupport: {
    title: 'Geselecteerde projectondersteuning',
    lead:
      'Projecten met bijzonder sterke creatieve, technische, culturele, educatieve of sociale waarde kunnen incidenteel extra steun van IOM krijgen. Als het project goed past en de productieplanning het toelaat, kan dat een verlaagd projecttarief zijn of een duidelijk aantal kosteloze productie-uren.',
    footer: 'Elke dergelijke steun wordt individueel beoordeeld en schriftelijk overeengekomen voordat de productie begint.',
  },
  estimate: {
    productionTime:
      'De getoonde schema’s beschrijven ongeveer actieve productieperiodes. De kalenderlevering kan ook afhangen van beschikbaarheid van klantmateriaal, gebundelde feedback, externe goedkeuringen, derden-diensten en het moment van projectbeslissingen.',
    blended:
      'Het typische productietarief van IOM ligt tussen €75 en €110 per uur, afhankelijk van technische complexiteit, specialistische eisen, assetgereedheid en levertijd. Gedefinieerde projecten kunnen als vaste productiestappen of met een gemengd projecttarief worden geoffreerd. De referentiebudgetten hieronder zijn daarom planningsbereiken, geen directe vermenigvuldiging van elk geschat uur met het hoogste uurtarief.',
    highlights: [
      { label: 'Senior specialistcapaciteit', value: `€${specialist} / productiedag` },
      { label: 'Extra studiocapaciteit', value: `vanaf €${studioFrom} / productiedag` },
      { label: 'Grotere / complete projecten', value: 'Gescooped na overleg' },
    ],
    exclusions: ['Reizen', 'Fotografie op locatie', 'Scanning', 'Betaalde assets', 'Softwarelicenties van derden', 'Hostingkosten', 'Belastingen', 'Doorlopend onderhoud'],
  },
  references: {
    cursor: {
      category: 'UI · Cursor · Interactie',
      glanceCategory: 'Aangepaste website-interactie',
      title: 'Labelled Custom Cursor',
      description:
        'Een contextbewuste cursor voor een bestaande website, inclusief gelabelde interactiestaten, hovergedrag, geanimeerde pointerovergangen en een standaard mobiele fallback.',
      imageAlt: 'Case study Labelled Custom Cursor',
      learnMoreLabel: 'Meer over scope en prijs',
      tiers: [{ label: 'Typische vergelijkbare inzet', hours: '4–7 productie-uren', delivery: 'Ongeveer 1 werkdag' }],
      includes: ['Visueel cursorconcept', 'Aangepaste pointer- en labelstyling', 'Hoverstaten voor links, knoppen en geselecteerde elementen', 'Basis pointeranimatie', 'Integratie in een bestaande, werkende website', 'Desktop-browsertests', 'Standaard mobiele fallback'],
      priceDrivers: ['Aantal cursorstaten', 'Complexiteit van de animatie', 'Bestaand websiteframework', 'Staat en structuur van de sitecode', 'Extra paginaspecifiek gedrag', 'Configuratie- of bewerkingsbediening', 'Spoedlevering'],
      assumption:
        'Dit bereik geldt wanneer de cursor aan een bestaande, functionele website wordt toegevoegd en de vereiste interactiestaten duidelijk zijn. Bredere interface-herontwerpen, uitgebreide animatiesystemen, complexe CMS-integratie of versnelde levering worden apart geschat.',
    },
    'black-witness': {
      category: '360° · Storytelling · WebGPU',
      glanceCategory: 'Begeleide 360°-ervaring',
      title: 'The Black Witness',
      description:
        'Een begeleide 360°-storytellingervaring met equirectangulaire scènes, gestructureerde navigatie, hotspots, interfacedesign, visuele effectlagen en een deelbare browserpresentatie.',
      imageAlt: 'Case study The Black Witness 360°',
      learnMoreLabel: 'Meer over scope en prijs',
      tiers: [
        { label: 'Gerichte versie', hours: '40–80 productie-uren', delivery: '1–2 weken' },
        { label: 'Case-study-niveau', hours: '80–160 productie-uren', delivery: '2–4 weken' },
      ],
      includes: ['Een of meer aangeleverde 360°-scènes', 'Hotspot- en annotatiesysteem', 'Begeleide camerabeweging', 'Interface- en navigatieontwerp', 'Responsive browserpresentatie', 'Visuele effectlagen', 'Deployment en tests'],
      priceDrivers: ['Aantal panorama’s', 'Aantal en complexiteit van hotspots', 'Of eindbeeldmateriaal al beschikbaar is', 'Eigen animatie of WebGPU-effecten', 'Audio, narratie en toegankelijkheid', 'Contentvoorbereiding en copywriting', 'Gewenste levertijd'],
      assumption:
        'Het bereik gaat ervan uit dat definitief 360°-beeldmateriaal en goedgekeurde narratieve content door de klant worden aangeleverd. Fotografie, scanning, reizen en contentproductie worden apart geoffreerd.',
    },
    miab: {
      category: 'WebGPU · Oceaan · Interactie',
      glanceCategory: 'Realtime browserervaring',
      title: 'Message in a Bottle',
      description:
        'Een originele realtime browserervaring met procedureel water en lucht, geanimeerde objecten, interfacedesign, dag- en nachtomstandigheden, een berichtenschrijfstroom en deelbare interactieve output.',
      imageAlt: 'Case study Message in a Bottle',
      learnMoreLabel: 'Meer over scope en prijs',
      tiers: [
        { label: 'Gericht prototype', hours: '80–160 productie-uren', delivery: '2–4 weken' },
        { label: 'Case-study-niveau', hours: '160–320 productie-uren', delivery: '4–7 weken' },
      ],
      includes: ['Creatief en technisch concept', 'Realtime oceaan- en luchtomgeving', 'Objectanimatie en interactie', 'Interface voor berichten schrijven', 'Dag-, nacht- of weerstaten', 'Responsive browseroplevering', 'Performance-optimalisatie', 'Cross-browsertests'],
      priceDrivers: ['Gewenst visueel realisme', 'Aantal omgevingsstaten', 'Delen, opslag of backend', 'Eigen 3D-assetproductie', 'Mobiele performance-eisen', 'Geluidsonwerp en extra animatie', 'Versnelde levering of lanceringstermijnen'],
    },
    viewer: {
      category: 'Three.js · WebGL · Product',
      glanceCategory: 'Aangepaste 3D-software',
      title: 'Custom 3D Viewer',
      description:
        'Een aangepaste browser- of desktop-3D-viewer met modelladen, interface-architectuur, camera- en navigatietools, licht, omgevingscontext, optimalisatie, tests en deployment.',
      imageAlt: 'Case study 3D Viewer',
      learnMoreLabel: 'Meer over scope en prijs',
      tiers: [
        { label: 'Gerichte aanpassing', hours: '120–240 productie-uren', delivery: '3–6 weken' },
        { label: 'Nieuw productplatform', hours: '320–640 productie-uren', delivery: '8–16 weken' },
      ],
      includes: ['Projectspecifieke viewerinterface', 'Workflow voor modelimport en voorbereiding', 'Camera- en navigatiebediening', 'Objectselectie en informatie', 'Licht- en omgevingssetup', 'Performance-optimalisatie', 'Responsive interface', 'Deployment en technische tests'],
      productAdditions: ['Meerdere modelformaten', 'Opgeslagen standpunten', 'Metingen', 'Annotaties en hotspots', 'Kniplvlakken', 'Zichtbaarheidsbediening', 'Projectopslag', 'Gebruikersaccounts', 'Klantspecifieke branding', 'Desktop Electron-oplevering', 'Backend- of database-integratie'],
      explainer:
        'Een projectspecifieke viewer op basis van een bestaand IOM-framework kan aanzienlijk sneller worden geleverd dan een nieuw softwareplatform. Het hogere bereik geldt wanneer de viewer nieuwe interface-architectuur, eigen tools, data-afhandeling, integraties, versnelde levering en tests op productniveau vereist.',
    },
  },
  inquiry: {
    requestType: 'Type verzoek',
    consultation: 'Gratis consult',
    estimate: 'Projectschatting',
    name: 'Naam',
    email: 'E-mail',
    company: 'Bedrijf of organisatie',
    timeframe: 'Gewenste levertijd',
    budget: 'Ongeveer budget',
    message: 'Voeg een korte projectbeschrijving toe.',
    optional: '(optioneel)',
    timeframePh: 'bijv. binnen 6 weken, Q4, flexibel',
    budgetPh: 'bijv. €5.000–€15.000',
    messagePh: 'Beschrijf het hoofdidee, het beoogde publiek, beschikbaar materiaal en wat de ervaring moet bereiken.',
    sending: 'Verzenden…',
    success: 'Bericht verzonden naar projects@iobjectm.com — we reageren binnen twee werkdagen.',
    error: 'Bericht kon niet worden verzonden. Mail direct naar projects@iobjectm.com.',
    required: 'Vul dit veld in.',
    invalidEmail: 'Voer een geldig e-mailadres in.',
    messageShort: 'Voeg een korte projectbeschrijving toe.',
    emailDirect: 'direct mailen naar projects@iobjectm.com',
  },
}
