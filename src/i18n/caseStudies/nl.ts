import type { CaseStudiesLocalePack } from './types'

export const nlCaseStudies: CaseStudiesLocalePack = {
  studies: {
    'gallery-of-light': {
      "eyebrow": "Casestudy · Interactieve 3D",
      "title": "Gallery of Light — sculptuur, licht en geluid",
      "lead": "Deze onafhankelijke IOM-studie brengt dertien sculpturen samen in twee galerievleugels, met een rondleiding, materiaalvergelijkingen en muziek die bezoekers zelf kunnen mixen.",
      "impact": "De browsergalerie is via een link te delen. Bezoekers verkennen de tentoonstelling en vergelijken hoe licht, oppervlakken en geluid de sfeer veranderen, zonder een app te installeren.",
      "primaryCtaLabel": "Ga de galerie binnen",
      "secondaryCtaLabel": "Lees het verhaal",
      "deliverables": [
        "Interactieve browsergalerie met dertien sculpturen in twee vleugels",
        "Rondleiding van ongeveer vijf minuten, met pauze en vrije verkenning",
        "Instelbare belichting, schaduwen en materiaalstudies op sculpturen",
        "Mixer met zes muzieksporen en een scherm dat op geluid reageert",
        "Volledig scherm, aanraakbediening en responsieve panelen",
        "Werkinformatie en bronvermeldingen voor de toegevoegde klassieke afgietsels"
      ],
      "stages": {
        "brief": {
          "title": "Uitdaging — de tentoonstelling",
          "summary": "Sculptuur laten ervaren via veranderend licht en geluid.",
          "detail": "Gallery of Light is een onafhankelijk IOM-concept dat onderzoekt hoe een tentoonstelling in de browser meer kan bieden dan stilstaande beelden. Dertien sculpturen staan verspreid over twee galerievleugels. Hun vorm en omgeving moeten eenvoudig te verkennen zijn, met een duidelijke entree en bediening die het bezoek ondersteunt.",
          "mediaAlt": "Gallery of Light — klassieke sculpturen, rode sokkels en daglicht onder het galeriedak"
        },
        "tour": {
          "title": "Oplossing — de bezoekersroute",
          "summary": "Een rondleiding introduceert de ruimte; bezoekers kunnen op elk moment overnemen.",
          "detail": "De rondleiding daalt vanuit een overzicht af naar de galerie en volgt de doorgangen tussen de zalen. Gedurende ongeveer vijf minuten tonen camerastops de sculpturen en verschijnen hun effecten geleidelijk. Bezoekers kunnen pauzeren, een sculptuur kiezen of de camera vrij ronddraaien. In volledig scherm blijven de toelichting en tourbediening bereikbaar.",
          "mediaAlt": "Bovenaanzicht van de twee galerievleugels en hun centrale verbinding"
        },
        "light": {
          "title": "Oplossing — licht en materialen",
          "summary": "Vergelijk de oorspronkelijke oppervlakken met licht- en materiaalstudies.",
          "detail": "HDR-belichting en een instelbare zon bepalen het galerielicht. Schaduwen, vloerreflecties en lage mist geven de ruimte diepte. Geselecteerde sculpturen tonen lichtbreking, draadmodellen, vervorming en doorschijnende materialen. De effecten lopen tijdens de rondleiding geleidelijk in elkaar over en zijn ook handmatig instelbaar. Het zijn realtime visuele studies; glascaustiek en lichtverstrooiing gebruiken praktische benaderingen.",
          "mediaAlt": "Doorschijnend wandreliëf in warm licht"
        },
        "sound": {
          "title": "Resultaat — een galerie met geluid",
          "summary": "Zes muzieksporen en een reagerend scherm maken het bezoek compleet.",
          "detail": "De muziek begint pas wanneer de bezoeker die start. Zes afzonderlijke sporen zijn te mixen, te dempen of apart te beluisteren. Het galerijscherm reageert op de daadwerkelijke mix en keert bij een pauze terug naar een stilstaand beeld. Het resultaat combineert geluid met de rondleiding, vrije navigatie en responsieve bediening. Lichtere renderinstellingen beperken de belasting op kleinere apparaten.",
          "mediaAlt": "Lichtgevende linten op het scherm in het auditorium"
        }
      }
    },
    '3d-viewer': {
      eyebrow: 'Case study · Software',
      title: '3D Viewer — van brief tot WebGL',
      lead: 'Hoe IOM een reviewprobleem omzet in een verscheepbaar product: de chrome bedraden, de pipeline harden, en klanten een link geven die ze in een call kunnen openen.',
      impact:
        'Stakeholders reviewen complexe modellen in de browser — zonder CAD-licentie — zodat design- en salesbeslissingen in gedeelde calls vooruitgaan in plaats van vast te lopen op bestandsuitwisseling.',
      primaryCtaLabel: 'Live viewer openen',
      secondaryCtaLabel: 'Technische write-up',
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Stakeholders moeten 3D reviewen zonder CAD-licentie.',
          detail:
            'Het kernprobleem: een model delen in een call, geen ZIP. Formaten variëren (GLTF, FBX, OBJ, IFC), en belichting of stadscontext verkoopt de pitch vaak net zo hard als de mesh zelf.',
          mediaAlt: '3D Viewer-productposter — orbit-chrome rond een belicht model',
        },
        wire: {
          title: 'Layout & review-chrome',
          summary: 'Panels, orbit en een pad van openen → begrijpen → beslissen.',
          detail:
            'We vormgeven de interface rond review, niet authorship: frame het asset, wissel omgevingen, houd hotspots en exportpaden vanzelfsprekend. Desktop en web delen hetzelfde mentale model.',
          mediaAlt: 'Productwalkthrough — orbit, HDR-belichting en viewer-chrome',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Three.js-pipeline, HDR-grondprojectie, Streets GL-brug.',
          detail:
            'Echte klantpipelines vragen formaatdekking, betrouwbare stadscontext-sync en texture-restore bij het verlaten van Product ↔ City. Het engineeringverhaal is betrouwbaarheid bij rommelige assets — geen demoleegte.',
          mediaAlt: 'OSM 3D- / Streets GL-stadscontext in de viewer',
        },
        final: {
          title: 'Finale WebGL',
          summary: 'Deelbare browserreview en Windows-desktopbuilds.',
          detail:
            'Live op 3dbviewer.com — orbit onder 360°-HDR met grondprojectie, of Streets GL wanneer de locatie het verhaal is. Dezelfde craft-taal als onze experimenten, verpakt voor beslissingen.',
          mediaAlt: '360°-HDR met grondprojectie — product belicht door de environment plate',
        },
      },
    },
    'black-witness': {
      eyebrow: 'Case study · 360°',
      title: 'The Black Witness — van brief tot 360°',
      lead: 'Hoe een fotografiereeks een geleide WebGPU-panoramatour wordt — hotspots, effectlagen en een visitor-preview die klanten kunnen delen.',
      impact:
        'Klanten delen een geleide 360°-walkthrough via URL — zonder installatie — zodat stakeholders het verhaal op elk apparaat ervaren en feedback geven vóór de volgende shoot of launch.',
      primaryCtaLabel: 'Visitor-tour openen',
      secondaryCtaLabel: 'Technische write-up',
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Een ravenverhaal dat gasten kunnen bewandelen, niet alleen bekijken.',
          detail:
            'The Black Witness begon als fotografiereeks. Het klantgerichte probleem: die sfeer omzetten in een geleide 360°-ervaring — rondkijken, klikken om te leren, een link delen zonder app te installeren.',
          mediaAlt: 'The Black Witness — dakraaf-still die het 360°-narratief zaait',
        },
        wire: {
          title: 'Tourstructuur',
          summary: 'Hotspots, geleide stops en een visitor-previewpad.',
          detail:
            'We ontwerpen camerabeats en hotspottypes (info, scènelinks, popups) zodat de tour als storyboard leest. Editor en visitor-preview delen één projectbestand — één keer bouwen, een schone preview-URL delen.',
          mediaAlt: 'Geleide tour stap 1 — ravenhotspot en popup op The Black Witness',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Equirectangular bol, WebGPU-effectlagen, projectopslagformaat.',
          detail:
            'Panorama’s liggen op een bolcamera; geleide stappen stapelen particles, spout/water en compute-vogels getimed op hotspots. `.360project` houdt scènes, stops en effecten portable tussen sessies.',
          mediaAlt: 'Stap 2 — particle-/vuurhotspot-beat in de panoramatour',
        },
        final: {
          title: 'Finale 360°',
          summary: 'Deelbare visitor-preview — zonder editor-chrome.',
          detail:
            'Klanten openen een deep-linked preview (yaw / pitch vergrendeld voor een gedeeld eerste frame), spelen de geleide tour of verkennen hotspots vrij. Dezelfde engine als de editor — verpakt voor gasten.',
          mediaAlt: 'Stap 4 — vogellaag en stormhemel-beat op The Black Witness',
        },
      },
    },
    'message-in-a-bottle': {
      eyebrow: 'Case study · WebGPU',
      title: 'Message in a Bottle — van brief tot open zee',
      lead: 'Hoe IOM een browser-keepsake op levend water bouwt: fles en perkament ensceneren, WebGPU-oceaan en hemel harden, dan een demo leveren die gasten zonder installatie openen.',
      impact:
        'Klanten en gasten beleven een interactief keepsake in de browser — dag/nacht-zee, verzegelde notities en apparaatbewuste kwaliteit — zodat narratieve demo’s echt genoeg zijn om te presenteren, niet alleen te beschrijven.',
      primaryCtaLabel: 'Live demo openen',
      secondaryCtaLabel: 'Experimenten bekijken',
      deliverables: [
        'Deelbare WebGPU open-zee-demo (geen installatie)',
        'Fles- + perkamentcomposer met verzegelde / versleutelde notities',
        'TSL Gerstner-oceaan met schuim, drijfvermogen en zeeleven',
        'Dag/nacht-hemel met kwaliteitsbewuste volumetrische wolken',
        'Low- / Medium- / High-presets voor echte apparaten',
      ],
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Een keepsake dat als open water moet voelen — geen platte skybox.',
          detail:
            'Message in a Bottle vroeg om een browserervaring waarin schrijven en verzegelen van een notitie in een geloofwaardige zee zit: dag/nacht-licht, weer en een fles om te vinden en te openen — zonder installatie.',
          mediaAlt: 'Open-zee-horizontsfeer — de atmosferische brief voor Message in a Bottle',
        },
        wire: {
          title: 'Ervaringslayout',
          summary: 'Fles, perkament en hemelbediening in één kalme compositie.',
          detail:
            'We ensceneren het eerste viewport rond fles en horizon, en leggen daarna composer-UI, kwaliteitsniveaus en tijdsturingen zo dat het verhaal primair blijft.',
          mediaAlt: 'Berichtlayout — perkamentbrief boven de open zee met zee- en hemelbediening naast',
        },
        engineering: {
          title: 'Engineering',
          summary: 'WebGPU-TSL-oceaan, hemelradiatie en kwaliteitsbewuste wolken.',
          detail:
            'Gerstner-swell, domain-warped chop en een TSL-hemel met volumetrische cloud-lods die op Medium/Low terugschalen. Drijfvermogen, zeeleven en versleutelde berichten blijven in hetzelfde framebudget als het water.',
          mediaAlt: 'WebGPU open-zee-render — Gerstner-water, nevel en wolkendichtheid',
        },
        final: {
          title: 'Finale open zee',
          summary: 'Een deelbare WebGPU-demo die gasten in de browser openen.',
          detail:
            'Live onder /demos/message-in-a-bottle/ — schrijf of ontvang een verzegelde notitie op open zee, met dag/nacht-hemel, kwaliteitspresets voor echte apparaten, en de craft-taal van onze experimenten als keepsake.',
          mediaAlt: 'Message in a Bottle — finale open-zee-scène met schuim, nevel en hemel',
        },
      },
    },
    'labelled-custom-cursor': {
      eyebrow: 'Case study · Interactie',
      title: 'Labelled custom cursor — van brief tot lab',
      lead: 'Hoe IOM een contextbewuste pointer ontwerpt: intent declareren in markup, tip en ring animeren met een lichte rAF-loop, dan een labelled lab parkeren terwijl de live site rustig blijft.',
      impact:
        'Bezoekers krijgen duidelijke hover-affordances op interactieve media — VIEW, PLAY, LOOK, ENTER 3D — zodat demo’s en CTA’s communiceren vóór de klik, zonder native tekstvelden of touch te storen.',
      primaryCtaLabel: 'Live lab openen',
      secondaryCtaLabel: 'Experimenten bekijken',
      deliverables: [
        'Deelbaar labelled cursor-lab (playground + live usage-panel)',
        'data-cursor / data-cursor-label markup-vocabulaire',
        'Precisie-tip + inertiële ring (rAF-lerp, zonder GSAP)',
        'Native fallback voor touch, formulieren en grove pointers',
        'Rustige focus-orb op homepagekaarten; labelled modi voor CTA’s & media',
      ],
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Interactieve media heeft een pointer nodig die intent uitspreekt — geen generieke pijl.',
          detail:
            'Op een portfolio van 3D, video en 360° moet hover hinten wat volgt: VIEW een project, PLAY media, LOOK een panorama, ENTER 3D. De systeemcursor draagt dat vocabulaire niet zonder labels en motion die bij het merk horen.',
          mediaAlt: 'Labelled cursor-lab — playground-targets en idle usage-panel',
        },
        wire: {
          title: 'Interactieontwerp',
          summary: 'Markup-gestuurde modi: data-cursor plus optionele labels.',
          detail:
            'Targets declareren intent in HTML — explore, view, play, look, drag, start, external, link, native. Custom labels (ENTER 3D) overschrijven defaults. Het lab spiegelt productiemarkup: hover werkt een live usage-panel bij met het passende snippet.',
          mediaAlt: 'ENTER 3D-hover — usage-panel toont data-cursor explore-markup',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Precisie-tip, inertiële ring, rAF-lerp — zonder GSAP.',
          detail:
            'Een lichte requestAnimationFrame-loop volgt de pointer met een snelle tip (~0.55) en een zachtere ring (~0.16). Target-resolutie loopt de DOM af voor data-cursor / anchors / inputs; touch en formuliervelden vallen terug op de native cursor.',
          mediaAlt: 'LOOK-modus actief — codepanel sync’t naar panorama data-cursor-markup',
        },
        final: {
          title: 'Deliverables',
          summary: 'Een deelbaar labelled lab — en een rustigere focus-orb op de live site.',
          detail:
            'Live onder /demos/custom-cursor-labelled/ met een geparkeerde source-snapshot. Homepagekaarten gebruiken een kalme cyan focus-orb; de labelled set blijft beschikbaar voor demo’s, CTA’s, transport en externe links.',
          mediaAlt: 'Labelled custom cursor-demo — playground en live usage-codepanel',
        },
      },
    },
  },
}
