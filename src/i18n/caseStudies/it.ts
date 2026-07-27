import type { CaseStudiesLocalePack } from './types'

export const itCaseStudies: CaseStudiesLocalePack = {
  studies: {
    '3d-viewer': {
      eyebrow: 'Case study · Software',
      title: '3D Viewer — dal brief al WebGL',
      lead: 'Come IOM trasforma un problema di review in un prodotto spedibile: cablare il chrome, irrigidire la pipeline, poi consegnare ai clienti un link da aprire in call.',
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
  },
}
