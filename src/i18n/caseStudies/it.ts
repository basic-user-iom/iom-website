import type { CaseStudiesLocalePack } from './types'

export const itCaseStudies: CaseStudiesLocalePack = {
  studies: {
    '3d-viewer': {
      eyebrow: 'Case study · Software',
      title: '3D Viewer — dal brief al WebGL',
      lead: 'Come IOM trasforma un problema di review in un prodotto spedibile: cablare il chrome, irrigidire la pipeline, poi consegnare ai clienti un link da aprire in call.',
      impact:
        'Gli stakeholder revisionano modelli complessi nel browser — senza licenza CAD — così le decisioni di design e sales avanzano in call condivise invece di bloccarsi sugli scambi di file.',
      primaryCtaLabel: 'Apri il viewer live',
      secondaryCtaLabel: 'Articolo tecnico',
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Gli stakeholder devono revisionare il 3D senza una licenza CAD.',
          detail:
            'Il problema centrale: condividere un modello in call, non uno ZIP. I formati variano (GLTF, FBX, OBJ, IFC), e illuminazione o contesto urbano vendono il pitch quanto la mesh stessa.',
          mediaAlt: 'Poster prodotto 3D Viewer — chrome di orbit attorno a un modello illuminato',
        },
        wire: {
          title: 'Layout e chrome di review',
          summary: 'Pannelli, orbit e un percorso da aprire → capire → decidere.',
          detail:
            'Plasmiamo l’interfaccia intorno alla review, non all’authoring: inquadrare l’asset, cambiare ambienti, tenere hotspots e percorsi di export evidenti. Desktop e web condividono lo stesso modello mentale.',
          mediaAlt: 'Walkthrough prodotto — orbit, illuminazione HDR e chrome del viewer',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Pipeline Three.js, proiezione a terra HDR, ponte Streets GL.',
          detail:
            'Le pipeline clienti reali richiedono copertura dei formati, sync affidabile del contesto urbano e ripristino texture uscendo da Product ↔ City. La storia di engineering è affidabilità con asset disordinati — non un vuoto da demo.',
          mediaAlt: 'Contesto urbano OSM 3D / Streets GL nel viewer',
        },
        final: {
          title: 'WebGL finale',
          summary: 'Review browser condividibile e build desktop Windows.',
          detail:
            'Live su 3dbviewer.com — orbit sotto HDR 360° con proiezione a terra, oppure Streets GL quando la location è la storia. Lo stesso linguaggio craft dei nostri esperimenti, confezionato per decidere.',
          mediaAlt: 'HDR 360° con proiezione a terra — prodotto illuminato dalla environment plate',
        },
      },
    },
    'black-witness': {
      eyebrow: 'Case study · 360°',
      title: 'The Black Witness — dal brief al 360°',
      lead: 'Come una serie fotografica diventa un tour panorama WebGPU guidato — hotspot, layer di effetti e una preview visitatore che i clienti possono condividere.',
      impact:
        'I clienti condividono un walkthrough 360° guidato via URL — senza installazione — così gli stakeholder vivono la narrativa su qualsiasi dispositivo e danno feedback prima del prossimo shoot o lancio.',
      primaryCtaLabel: 'Apri il tour visitatore',
      secondaryCtaLabel: 'Articolo tecnico',
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Una storia di corvo che gli ospiti possono percorrere, non solo guardare.',
          detail:
            'The Black Witness è nato come serie fotografica. Il problema lato cliente: trasformare quell’atmosfera in un’esperienza 360° guidata — guardarsi intorno, cliccare per imparare, condividere un link senza installare un’app.',
          mediaAlt: 'The Black Witness — still del corvo sul tetto che avvia la narrazione 360°',
        },
        wire: {
          title: 'Struttura del tour',
          summary: 'Hotspot, tappe guidate e percorso di preview visitatore.',
          detail:
            'Progettiamo beat di camera e tipi di hotspot (info, link di scena, popup) così il tour si legge come uno storyboard. Editor e preview visitatore condividono un unico file di progetto — costruire una volta, condividere un URL di preview pulito.',
          mediaAlt: 'Tour guidato passo 1 — hotspot corvo e popup su The Black Witness',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Sfera equirettangolare, layer di effetti WebGPU, formato di salvataggio progetto.',
          detail:
            'I panorami si mappano su una camera a sfera; i passi guidati sovrappongono particelle, spout/acqua e uccelli compute sincronizzati agli hotspot. `.360project` mantiene scene, tappe ed effetti portabili tra sessioni.',
          mediaAlt: 'Passo 2 — beat hotspot particelle / fuoco nel tour panorama',
        },
        final: {
          title: '360° finale',
          summary: 'Preview visitatore condividibile — senza chrome dell’editor.',
          detail:
            'I clienti aprono una preview deep-linked (yaw / pitch bloccati per un primo frame condiviso), riproducono il tour guidato o esplorano liberamente gli hotspot. Lo stesso motore dell’editor — confezionato per gli ospiti.',
          mediaAlt: 'Passo 4 — layer uccelli e beat cielo di tempesta su The Black Witness',
        },
      },
    },
    'message-in-a-bottle': {
      eyebrow: 'Case study · WebGPU',
      title: 'Message in a Bottle — dal brief al mare aperto',
      lead: 'Come IOM costruisce un keepsake browser su acqua viva: mettere in scena bottiglia e pergamena, indurire oceano e cielo WebGPU, poi consegnare una demo che gli ospiti aprono senza installazione.',
      impact:
        'Clienti e ospiti vivono un keepsake interattivo nel browser — mare giorno/notte, note sigillate e qualità consapevole del dispositivo — così le demo narrative sono abbastanza reali da presentare, non solo da descrivere.',
      primaryCtaLabel: 'Apri demo live',
      secondaryCtaLabel: 'Sfoglia gli esperimenti',
      deliverables: [
        'Demo WebGPU mare aperto condividibile (senza installazione)',
        'Composer bottiglia + pergamena con note sigillate / crittografate',
        'Oceano Gerstner TSL con schiuma, galleggiamento e vita marina',
        'Cielo giorno/notte con nubi volumetriche consapevoli della qualità',
        'Preset Low / Medium / High per dispositivi reali',
      ],
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Un keepsake che deve sembrare mare aperto — non uno skybox piatto.',
          detail:
            'Message in a Bottle richiedeva un’esperienza browser in cui scrivere e sigillare una nota resta dentro un mare credibile: luce giorno/notte, meteo e una bottiglia da trovare e aprire — senza installazione.',
          mediaAlt: 'Atmosfera di orizzonte in mare aperto — il brief atmosferico di Message in a Bottle',
        },
        wire: {
          title: 'Layout dell’esperienza',
          summary: 'Bottiglia, pergamena e controlli del cielo in una composizione calma.',
          detail:
            'Inquadriamo il primo viewport intorno a bottiglia e orizzonte, poi disponiamo UI del composer, livelli di qualità e controlli dell’ora così che la narrazione resti primaria.',
          mediaAlt: 'Layout del messaggio — lettera su pergamena sul mare aperto con controlli mare e cielo a lato',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Oceano WebGPU TSL, radiance del cielo e nubi consapevoli della qualità.',
          detail:
            'Swell Gerstner, chop domain-warped e cielo TSL con lod di nubi volumetriche che si riducono su Medium/Low. Galleggiamento, vita marina e messaggi crittografati restano nello stesso budget di frame dell’acqua.',
          mediaAlt: 'Render WebGPU mare aperto — acqua Gerstner, foschia e controlli densità nubi',
        },
        final: {
          title: 'Mare aperto finale',
          summary: 'Una demo WebGPU condividibile che gli ospiti aprono nel browser.',
          detail:
            'Live su /demos/message-in-a-bottle/ — scrivere o ricevere una nota sigillata in mare aperto, con cielo giorno/notte, preset di qualità per dispositivi reali e il linguaggio craft dei nostri esperimenti come keepsake.',
          mediaAlt: 'Message in a Bottle — scena finale mare aperto con schiuma, foschia e cielo',
        },
      },
    },
    'labelled-custom-cursor': {
      eyebrow: 'Case study · Interazione',
      title: 'Cursore personalizzato etichettato — dal brief al lab',
      lead: 'Come IOM progetta un puntatore contestuale: dichiarare l’intento nel markup, animare tip e anello con un loop rAF leggero, poi parcheggiare un lab etichettato mentre il sito live resta quieto.',
      impact:
        'I visitatori ricevono affordance hover chiare sui media interattivi — VIEW, PLAY, LOOK, ENTER 3D — così demo e CTA comunicano prima del click, senza interferire con input di testo nativi o touch.',
      primaryCtaLabel: 'Apri il lab live',
      secondaryCtaLabel: 'Sfoglia gli esperimenti',
      deliverables: [
        'Lab cursore etichettato condividibile (playground + pannello usage live)',
        'Vocabolario markup data-cursor / data-cursor-label',
        'Tip di precisione + anello inerziale (lerp rAF, senza GSAP)',
        'Fallback nativo per touch, form e puntatori grossolani',
        'Orbe focus quieta sulle card homepage; modalità etichettate per CTA e media',
      ],
      stages: {
        brief: {
          title: 'Brief',
          summary: 'I media interattivi servono un puntatore che parla intento — non una freccia generica.',
          detail:
            'Su un portfolio di 3D, video e 360°, l’hover deve suggerire cosa succede dopo: VIEW un progetto, PLAY un media, LOOK un panorama, ENTER 3D. Il cursore di sistema non porta quel vocabolario senza label e motion allineati al brand.',
          mediaAlt: 'Lab cursore etichettato — target playground e pannello usage idle',
        },
        wire: {
          title: 'Design di interazione',
          summary: 'Modalità guidate dal markup: data-cursor più label opzionali.',
          detail:
            'I target dichiarano l’intento in HTML — explore, view, play, look, drag, start, external, link, native. Label custom (ENTER 3D) sovrascrivono i default. Il lab rispecchia il markup di produzione: l’hover aggiorna un pannello usage live con lo snippet corrispondente.',
          mediaAlt: 'Hover ENTER 3D — il pannello usage mostra il markup data-cursor explore',
        },
        engineering: {
          title: 'Engineering',
          summary: 'Tip di precisione, anello inerziale, lerp rAF — senza GSAP.',
          detail:
            'Un loop requestAnimationFrame leggero segue il puntatore con tip veloce (~0.55) e anello più morbido (~0.16). La risoluzione del target attraversa il DOM per data-cursor / anchor / input; touch e form tornano al cursore nativo.',
          mediaAlt: 'Modalità LOOK attiva — il pannello codice si sincronizza al markup panorama',
        },
        final: {
          title: 'Deliverables',
          summary: 'Un lab etichettato condividibile — e un’orbe focus più quieta sul sito live.',
          detail:
            'Live su /demos/custom-cursor-labelled/ con snapshot sorgente parcheggiato. Le card homepage usano un’orbe focus cyan quieta; il set etichettato resta per demo, CTA, transport e link esterni.',
          mediaAlt: 'Demo cursore etichettato — playground e pannello codice usage live',
        },
      },
    },
  },
}
