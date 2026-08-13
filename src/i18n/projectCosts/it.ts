import { PROJECT_COSTS_META } from '../../project-costs/data'
import type { ProjectCostsCopy } from './types'

const specialist = PROJECT_COSTS_META.specialistDayRate
const intro = PROJECT_COSTS_META.specialistIntroDayRate
const studioFrom = PROJECT_COSTS_META.studioTeamFromDayRate
const studioIntro = PROJECT_COSTS_META.studioTeamIntroFromDayRate
const deadline = PROJECT_COSTS_META.augustOfferDeadline

export const itProjectCosts: ProjectCostsCopy = {
  page: {
    print: 'Stampa / Salva come PDF',
    engageHeading: 'Come puoi coinvolgere IOM',
    engageLead:
      'Scegliete il livello di capacità produttiva adatto al progetto. Usate la capacità specialista per un compito mirato, aggiungete capacità di studio quando il lavoro in parallelo è utile, oppure definiamo insieme lo scope di un progetto più ampio.',
    refsHeading: 'Progetti di riferimento dettagliati',
    refsLead:
      'Cosa era incluso in ciascun esempio, gli intervalli di produzione tipici e perché il riferimento può — o meno — essere confrontabile con una nuova richiesta. Non prezzi a pacchetto fissi.',
    factorsHeading: 'Cosa influisce su costo e tempi',
    factorsLearnLabel: 'Di più sui fattori di prezzo',
    factorsLearnTitle: 'Fattori tecnici che cambiano lo sforzo di produzione',
    glanceAria: 'Confronto rapido dei progetti',
    glanceProject: 'Progetto',
    glanceEffort: 'Sforzo comparabile tipico',
    glanceDelivery: 'Consegna tipica',
    glanceBudget: 'Budget indicativo',
    glanceReference: 'Riferimento: {title}',
    typicallyIncludes: 'In genere include',
    priceDrivers: 'Il prezzo di solito cambia per',
    productAdditions: 'Possibili aggiunte a livello di prodotto',
    viewCaseStudy: 'Vedi lo studio di caso →',
    protoHeading: 'Partire da un prototipo mirato',
    protoLead:
      'La maggior parte dei progetti non deve iniziare con la build di riferimento completa. Un prototipo più piccolo e chiaramente definito può validare l’interazione centrale, la direzione visiva e il flusso tecnico prima di approvare l’ambito di produzione completo.',
    protoNote:
      'Il lavoro di prototipo è strutturato così che codice, asset e decisioni di design utili possano continuare nella fase di produzione successiva, dove è pratico — attraverso Research (Raven), Form (Fox) e Output (Octopus).',
    protoAria: 'Fasi di prototipo · Research Form Output',
    howHeading: 'Piccolo team nucleo, produzione scalabile',
    howLead:
      'IOM scala la capacità di produzione in base alle esigenze del progetto. Alcune fasi possono essere gestite da uno specialista senior, mentre le fasi intensive di produzione possono ampliarsi quando il lavoro in parallelo è davvero utile.',
    estimateHeading: 'Su queste stime',
    estimateIntro:
      'Tutte le cifre in questa pagina sono intervalli di pianificazione indicativi per lavoro comparabile agli studi di caso. Non sono prezzi a pacchetto fissi, preventivi contrattuali né il costo storico esatto dei progetti originali.',
    estimateQuotes:
      'I preventivi per ambiti più ampi vengono preparati separatamente dopo una consulenza. Salvo inclusione esplicita in un preventivo, le voci elencate a fianco sono di solito stimate a parte.',
    estimateHighlightsAria: 'Tariffe chiave',
    estimateHighlightsEyebrow: 'Intervalli di pianificazione',
    estimateExcludes: 'Di solito quotati a parte',
    checklistLabel: 'Informazioni utili da includere:',
    viewCaseStudies: 'Vedi tutti gli studi di caso',
    bookConsult: 'Prenota una consulenza gratuita',
    requestEstimate: 'Richiedi una stima di progetto',
    compareOptions: 'Confronta le opzioni di coinvolgimento',
    startsPanelEyebrow: 'Consulenza gratuita di 30 minuti',
    startsPanelAria: 'Passi successivi',
    scopedAfterConsultation: 'Definito dopo consulenza',
    productionDay: '€{rate} / giorno di produzione',
    fromProductionDay: 'Da €{rate} / giorno di produzione',
    fixedTitle: 'Lavoro piccolo e chiaramente definito',
    fixedBody:
      'Non ogni collaborazione deve iniziare con un progetto grande o un incarico a tariffa giornaliera. Piccole interazioni, miglioramenti della presentazione prodotto, prototipi e componenti di sito chiaramente definiti possono essere quotati anche come scope a prezzo fisso.',
  },
  hero: {
    eyebrow: 'Ambito · Tempo · Budget',
    title: 'Capacità di produzione flessibile',
    lead:
      'IOM può essere coinvolto per produzione senior mirata, capacità aggiuntiva di studio, o un progetto di ambito più ampio. L’assetto giusto dipende dal lavoro che può davvero avanzare in parallelo.',
    sub:
      'Questa pagina è una guida trasparente, non un catalogo di pacchetti fissi. Le tariffe giornaliere qualificano un punto di partenza; il lavoro più ampio viene definito dopo una breve consulenza.',
    ctaPrimary: 'Parlare di un progetto',
    ctaSecondary: 'Vedi i progetti di riferimento',
  },
  engagement: {
    specialist: {
      title: 'Capacità di specialista senior',
      question: 'Serve uno specialista esperto?',
      summary:
        'Per un compito tecnico, 3D o realtime mirato all’interno di un progetto più ampio.',
      rateLine: `€${specialist} / giorno di produzione`,
      rateNote: 'Produzione senior mirata per un flusso di lavoro definito.',
      learnMoreLabel: 'Di più sulla capacità di specialista senior',
      learnMoreTitle: 'Capacità di specialista senior — dettaglio tecnico',
      learnMoreParagraphs: [
        'Adatto a lavoro chiaramente definito come sviluppo 3D in tempo reale, componenti interattivi nel browser, preparazione e ottimizzazione di asset 3D, produzione Blender o Unreal, flussi CAD/BIM verso il realtime, fotogrammetria, produzione 360, prototipazione, troubleshooting e R&S tecnica.',
        'Uno specialista singolo mantiene più basso il costo giornaliero di produzione, ma offre meno capacità in parallelo. I pacchetti più ampi possono quindi richiedere un periodo di consegna più lungo.',
        'Lo stack tecnico esatto viene scelto in base al progetto e non trattato come il prodotto in sé.',
        'Strumenti e formati tipici quando sono utili: Three.js · WebGL / WebGPU · Blender · Unreal Engine · CAD / BIM · GLB / FBX / OBJ · fotogrammetria · produzione 360°.',
      ],
    },
    'studio-capacity': {
      title: 'Capacità aggiuntiva di studio',
      question: 'Serve più capacità di produzione?',
      summary:
        'Per pacchetti di produzione più ampi o flussi di lavoro paralleli in cui la capacità extra è davvero utile.',
      rateLine: `Da €${studioFrom} / giorno di produzione`,
      rateNote: 'Capacità parallela extra quando il progetto ne beneficia davvero.',
      learnMoreLabel: 'Di più sulla capacità aggiuntiva di studio',
      learnMoreTitle: 'Capacità aggiuntiva di studio — dettaglio tecnico',
      learnMoreParagraphs: [
        'Per lavoro che beneficia della produzione in parallelo, IOM può aggiungere capacità in produzione 3D, sviluppo realtime, preparazione asset, integrazione dei contenuti, ottimizzazione e test.',
        'Più persone non rendono automaticamente ogni compito proporzionalmente più veloce. Alcune fasi sono sequenziali, altre possono avanzare in parallelo. L’assetto di produzione deve quindi seguire le dipendenze reali del progetto.',
        'La capacità può anche cambiare per fase: uno specialista in preparazione, capacità aggiuntiva in produzione, e di nuovo un team più piccolo per integrazione e consegna finali.',
      ],
    },
    'project-scoping': {
      title: 'Progetto completo / più ampio',
      question: 'Dobbiamo portare avanti il progetto?',
      summary:
        'Per un lavoro end-to-end in cui scope, materiali di partenza, tempi e capacità necessaria vanno valutati insieme.',
      rateLine: 'Definito dopo consulenza',
      rateNote: 'Struttura di produzione e prezzo seguono ambito reale, materiale, calendario e dipendenze.',
      learnMoreLabel: 'Di più su progetti completi e più ampi',
      learnMoreTitle: 'Progetto completo / più ampio — dettaglio tecnico',
      learnMoreParagraphs: [
        'Prima di quotare un progetto più ampio, IOM esamina il materiale di partenza disponibile, i requisiti tecnici, i deliverable, la timeline, le responsabilità di integrazione, il processo di review e le dipendenze esterne.',
        'L’obiettivo è raccomandare solo il livello di capacità di studio davvero utile. Ambiti più ampi possono essere strutturati come milestone, fasi o pacchetti di produzione definiti, non come un organico fisso per tutta la durata.',
      ],
    },
  },
  capacity: {
    title: 'Prezzo e tempo si collegano attraverso la capacità di produzione',
    summary:
      'Uno specialista ha un costo giornaliero più basso. Un piccolo team costa di più al giorno ma spesso può far avanzare più parti del lavoro contemporaneamente. I progetti più ampi possono usare una persona in alcune fasi e due o tre solo quando la produzione in parallelo è utile.',
    learnMoreLabel: 'Di più su tempi e capacità',
    learnMoreTitle: 'Tempi, capacità e produzione in parallelo',
    learnMoreParagraphs: [
      'Le tariffe giornaliere descrivono capacità di produzione, non una garanzia che ogni compito finisca proporzionalmente più in fretta con più persone. Parte del lavoro deve essere sequenziale; altri flussi — preparazione asset, sviluppo, integrazione, test — possono correre in parallelo se pianificati con cura.',
      'Uno specialista singolo è spesso il punto di partenza più efficiente per un compito mirato, o quando il tuo team copre già parte della pipeline. La capacità di studio si aggiunge quando il calendario o l’ambito beneficiano davvero della produzione in parallelo.',
      'I preventivi per ambiti più ampi restano separati dalle tariffe giornaliere. La consulenza definisce deliverable, stato del materiale di partenza, approccio tecnico e il piano di capacità più piccolo utile prima di iniziare.',
    ],
  },
  august: {
    eyebrow: 'Agosto 2026 — disponibilità introduttiva',
    title: 'Capacità di produzione specialista limitata per nuove collaborazioni',
    lines: [
      `Per nuove collaborazioni confermate entro il ${deadline}, è disponibile una quantità limitata di capacità di produzione specialista a €${intro} / giorno di produzione invece della tariffa standard di €${specialist} / giorno di produzione.`,
      'La tariffa introduttiva concordata può continuare oltre agosto per l’ambito iniziale confermato.',
    ],
    cta: 'Chiedere disponibilità di agosto',
    cardBadge: 'Intro agosto',
    specialistCompare: `€${intro} / giorno di produzione`,
    studioCompare: `Da €${studioIntro} / giorno di produzione`,
    untilNotice: 'Disponibile fino a fine agosto',
    standardLabel: 'Standard {rate}',
  },
  examples: {
    title: 'Progetti di riferimento',
    lead:
      'Questi esempi mostrano la scala approssimativa di lavori precedenti. Non sono pacchetti fissi; ambito finale, calendario e capacità di produzione dipendono dal materiale di partenza, dai requisiti di interazione e dal contesto di consegna.',
    glanceNote:
      'Seleziona una riga per scorrere alla scheda di riferimento dettagliata. Le cifre sono intervalli di pianificazione, non prezzi da catalogo.',
    rangeNote:
      'L’estremo inferiore assume in genere un ambito chiaramente definito, asset ben preparati, un calendario di produzione standard e poca incertezza tecnica. Integrazioni complesse, sviluppo specialistico, materiale di partenza incompleto o consegna accelerata possono aumentare il preventivo finale.',
  },
  factorsSimple:
    'La stima dipende da cosa va costruito, dallo stato del materiale di partenza, da quanto complesse devono essere interazione e immagini, e da quanto in fretta va consegnato.',
  factors: [
    { title: 'Qualità e stato del materiale di partenza', text: 'Asset puliti e pronti per la produzione rispetto a dati CAD/BIM/3D incompleti o difficili.' },
    { title: 'Complessità dell’interazione', text: 'Presentazione semplice rispetto a logica realtime su misura, strumenti, configurazione o comportamenti in più passi.' },
    { title: 'Complessità visiva', text: 'Numero di ambienti, oggetti, materiali, requisiti di illuminazione, animazione e stati del contenuto.' },
    { title: 'Requisiti di integrazione', text: 'Modulo autonomo rispetto a integrazione in un sito esistente, prodotto software o catena del cliente.' },
    { title: 'Prestazioni e QA', text: 'Browser supportati, dispositivi, obiettivi mobile, limiti GPU e traguardi di ottimizzazione.' },
    { title: 'Calendario', text: 'Le tempistiche compresse possono richiedere più capacità di produzione in parallelo.' },
    { title: 'Struttura di feedback e revisioni', text: 'Un decisore e round di review definiti differiscono da modifiche continue con molti stakeholder.' },
    { title: 'Costi di terze parti', text: 'Asset a pagamento, licenze, hosting speciale, servizi esterni, viaggi o hardware vanno quotati a parte dove rilevante.' },
    { title: 'Supporto continuativo', text: 'Manutenzione, aggiornamenti di contenuto o supporto post-lancio possono essere organizzati a parte se necessario.' },
  ],
  starts: {
    title: 'Come inizia un progetto',
    lead: 'Quattro passi chiari dalla prima conversazione a una stima definita. Nessun impegno finché non approvi approccio e budget.',
    steps: [
      { title: 'Condividi l’idea', text: 'Raccontaci cosa vuoi costruire — anche se il brief è ancora approssimativo.' },
      { title: 'Esaminarlo insieme', text: 'Esaminiamo l’obiettivo, il materiale di partenza disponibile, il formato di consegna e la scadenza.' },
      { title: 'Allineare la capacità', text: 'Consigliamo se il lavoro sta meglio con uno specialista, capacità aggiuntiva di studio, o un team di progetto definito.' },
      { title: 'Ricevi una stima chiara', text: 'Ricevi ambito, approccio di produzione e stima prima che il lavoro inizi.' },
    ],
    footer:
      'Nei progetti più ampi, la capacità può cambiare durante la produzione, così non paghi un team più grande in fasi che non ne hanno bisogno.',
    consultationNote:
      'Qualsiasi progetto potenziale può iniziare con una consulenza gratuita di 30 minuti. Ricerca tecnica, ispezione file, test di workflow, lavoro di design e sviluppo di prototipi vengono quotati a parte quando serve.',
    cta: 'Prenota una consulenza gratuita',
  },
  prototype: [
    { title: 'Definire la sfida', text: 'Definisce l’obiettivo centrale, l’interazione primaria e il risultato più importante del progetto.', stage: 'Research', stageLine: 'Comprende il cliente, il pubblico, la storia e la sfida tecnica prima di costruire qualsiasi cosa.' },
    { title: 'Dare forma alla soluzione', text: 'Costruisce e testa una versione di lavoro mirata con contenuti rappresentativi e condizioni tecniche realistiche.', stage: 'Form', stageLine: 'Trasforma la ricerca in un linguaggio visivo chiaro, una struttura di interazione e un approccio tecnico.' },
    { title: 'Consegnare il risultato', text: 'Estende la soluzione approvata all’esperienza completa, ai contenuti extra e al deployment di produzione.', stage: 'Output', stageLine: 'Raffina e consegna il risultato finale come un’esperienza che le persone possono aprire, comprendere e usare.' },
  ],
  howIomWorks: [
    { title: 'La capacità segue il lavoro', text: 'IOM scala la capacità di produzione in base alle esigenze del progetto. Alcune fasi possono essere gestite da uno specialista senior, mentre le fasi intensive possono ampliarsi quando il lavoro in parallelo è davvero utile.' },
    { title: 'Assetto di produzione chiaro', text: 'Negli incarichi più ampi, l’assetto di produzione viene concordato in anticipo, così responsabilità, capacità e comunicazione restano chiare.' },
    { title: 'Passi chiari', text: 'Ricerca, prototipo, produzione e consegna possono essere quotati come passi separati, così l’ambito può essere rivisto prima di ogni impegno maggiore.' },
  ],
  finalCta: {
    title: 'Dicci cosa stai cercando di costruire',
    lead: 'Non serve un brief tecnico. Invia l’obiettivo, ciò che hai già e la data verso cui lavori. Ti aiutiamo a definire l’assetto di produzione giusto.',
    cta: 'Parlare di un progetto',
  },
  contactChecklist: [
    'Obiettivo principale del progetto',
    'Pubblico previsto',
    'Asset 3D, 360° o media esistenti',
    'Consegna desiderata: sito, desktop, mobile, VR o installazione',
    'Data di completamento preferita',
    'Budget approssimativo disponibile, se noto',
  ],
  selectedSupport: {
    title: 'Supporto selettivo ai progetti',
    lead:
      'I progetti con un valore creativo, tecnico, culturale, educativo o sociale particolarmente forte possono ricevere occasionalmente un supporto extra da IOM. Se il progetto è adatto e il calendario di produzione lo consente, può trattarsi di una tariffa di progetto ridotta o di un numero definito di ore di produzione senza costo.',
    footer: 'Qualsiasi supporto di questo tipo viene valutato individualmente e concordato per iscritto prima che la produzione inizi.',
  },
  estimate: {
    productionTime:
      'I calendari mostrati descrivono periodi di produzione attiva approssimativi. La consegna in calendario può dipendere anche dalla disponibilità del materiale del cliente, dal feedback raggruppato, dalle approvazioni esterne, dai servizi di terze parti e dal momento delle decisioni di progetto.',
    blended:
      'La tariffa di produzione tipica di IOM è tra 75 € e 110 € all’ora, a seconda della complessità tecnica, dei requisiti specialistici, della preparazione degli asset e dei tempi di consegna. I progetti definiti possono essere quotati come passi di produzione fissi o con una tariffa di progetto mista. I budget di riferimento sotto sono quindi intervalli di pianificazione, non una moltiplicazione diretta di ogni ora stimata per la tariffa oraria più alta.',
    highlights: [
      { label: 'Capacità di specialista senior', value: `€${specialist} / giorno di produzione` },
      { label: 'Capacità aggiuntiva di studio', value: `da €${studioFrom} / giorno di produzione` },
      { label: 'Progetti più ampi / completi', value: 'Definito dopo consulenza' },
    ],
    exclusions: ['Viaggi', 'Fotografia in loco', 'Scansione', 'Asset a pagamento', 'Licenze software di terze parti', 'Costi di hosting', 'Tasse', 'Manutenzione continuativa'],
  },
  references: {
    cursor: {
      category: 'UI · Cursor · Interazione',
      glanceCategory: 'Interazione web su misura',
      title: 'Labelled Custom Cursor',
      description:
        'Un cursore contestuale per un sito esistente, con stati di interazione etichettati, comportamento al passaggio, transizioni animate del puntatore e un fallback mobile standard.',
      imageAlt: 'Studio di caso Labelled Custom Cursor',
      learnMoreLabel: 'Di più su ambito e prezzo',
      tiers: [{ label: 'Sforzo comparabile tipico', hours: '4–7 ore di produzione', delivery: 'Circa 1 giorno lavorativo' }],
      includes: ['Concetto visivo del cursore', 'Stile su misura di puntatore ed etichette', 'Stati hover per link, pulsanti ed elementi selezionati', 'Animazione di base del puntatore', 'Integrazione in un sito esistente e funzionante', 'Test sui browser desktop', 'Fallback mobile standard'],
      priceDrivers: ['Numero di stati del cursore', 'Complessità dell’animazione', 'Framework del sito esistente', 'Stato e struttura del codice del sito', 'Comportamento extra specifico di pagina', 'Controlli di configurazione o modifica', 'Consegna urgente'],
      assumption:
        'Questo intervallo vale quando il cursore viene aggiunto a un sito esistente e funzionante e gli stati di interazione richiesti sono chiari. Ridefinizioni di interfaccia più ampie, sistemi di animazione estesi, integrazione CMS complessa o consegna accelerata vengono stimati a parte.',
    },
    'black-witness': {
      category: '360° · Storytelling · WebGPU',
      glanceCategory: 'Esperienza 360° guidata',
      title: 'The Black Witness',
      description:
        'Un’esperienza di storytelling 360° guidata con scene equirettangolari, navigazione strutturata, hotspot, design dell’interfaccia, layer di effetti visivi e una presentazione condivisibile nel browser.',
      imageAlt: 'Studio di caso The Black Witness 360°',
      learnMoreLabel: 'Di più su ambito e prezzo',
      tiers: [
        { label: 'Versione mirata', hours: '40–80 ore di produzione', delivery: '1–2 settimane' },
        { label: 'Livello studio di caso', hours: '80–160 ore di produzione', delivery: '2–4 settimane' },
      ],
      includes: ['Una o più scene 360° fornite', 'Sistema di hotspot e annotazioni', 'Movimento di camera guidato', 'Design di interfaccia e navigazione', 'Presentazione responsive nel browser', 'Layer di effetti visivi', 'Deployment e test'],
      priceDrivers: ['Numero di panorami', 'Numero e complessità degli hotspot', 'Se il materiale visivo finale è già disponibile', 'Animazione proprietaria o effetti WebGPU', 'Audio, narrazione e accessibilità', 'Preparazione dei contenuti e copywriting', 'Tempi di consegna desiderati'],
      assumption:
        'L’intervallo assume che il materiale 360° definitivo e i contenuti narrativi approvati siano forniti dal cliente. Fotografia, scansione, viaggi e produzione di contenuti vengono quotati a parte.',
    },
    miab: {
      category: 'WebGPU · Oceano · Interazione',
      glanceCategory: 'Esperienza realtime nel browser',
      title: 'Message in a Bottle',
      description:
        'Un’esperienza originale realtime nel browser con acqua e cielo procedurali, oggetti animati, design dell’interfaccia, condizioni di giorno e notte, un flusso per scrivere messaggi e un output interattivo condivisibile.',
      imageAlt: 'Studio di caso Message in a Bottle',
      learnMoreLabel: 'Di più su ambito e prezzo',
      tiers: [
        { label: 'Prototipo mirato', hours: '80–160 ore di produzione', delivery: '2–4 settimane' },
        { label: 'Livello studio di caso', hours: '160–320 ore di produzione', delivery: '4–7 settimane' },
      ],
      includes: ['Concetto creativo e tecnico', 'Ambiente oceano e cielo in tempo reale', 'Animazione e interazione degli oggetti', 'Interfaccia per scrivere messaggi', 'Stati giorno, notte o meteo', 'Consegna responsive nel browser', 'Ottimizzazione delle prestazioni', 'Test cross-browser'],
      priceDrivers: ['Realismo visivo desiderato', 'Numero di stati ambientali', 'Condivisione, storage o backend', 'Produzione proprietaria di asset 3D', 'Requisiti di prestazione mobile', 'Sound design e animazione extra', 'Consegna accelerata o scadenze di lancio'],
    },
    viewer: {
      category: 'Three.js · WebGL · Prodotto',
      glanceCategory: 'Software 3D su misura',
      title: 'Custom 3D Viewer',
      description:
        'Un viewer 3D su misura per browser o desktop con caricamento modelli, architettura dell’interfaccia, strumenti di camera e navigazione, illuminazione, contesto ambientale, ottimizzazione, test e deployment.',
      imageAlt: 'Studio di caso 3D Viewer',
      learnMoreLabel: 'Di più su ambito e prezzo',
      tiers: [
        { label: 'Adattamento mirato', hours: '120–240 ore di produzione', delivery: '3–6 settimane' },
        { label: 'Nuova piattaforma di prodotto', hours: '320–640 ore di produzione', delivery: '8–16 settimane' },
      ],
      includes: ['Interfaccia viewer specifica del progetto', 'Flusso di import e preparazione modelli', 'Controlli di camera e navigazione', 'Selezione oggetti e informazioni', 'Setup di illuminazione e ambiente', 'Ottimizzazione delle prestazioni', 'Interfaccia responsive', 'Deployment e test tecnici'],
      productAdditions: ['Più formati di modello', 'Punti di vista salvati', 'Misurazioni', 'Annotazioni e hotspot', 'Piani di taglio', 'Controlli di visibilità', 'Storage di progetto', 'Account utente', 'Branding specifico del cliente', 'Consegna desktop Electron', 'Integrazione backend o database'],
      explainer:
        'Un viewer specifico del progetto basato su un framework IOM esistente può essere consegnato molto più in fretta di una nuova piattaforma software. L’intervallo superiore vale quando il viewer richiede nuova architettura di interfaccia, strumenti proprietari, gestione dati, integrazioni, consegna accelerata e test a livello di prodotto.',
    },
  },
  inquiry: {
    requestType: 'Tipo di richiesta',
    consultation: 'Consulenza gratuita',
    estimate: 'Stima di progetto',
    name: 'Nome',
    email: 'E-mail',
    company: 'Azienda o organizzazione',
    timeframe: 'Tempi di consegna desiderati',
    budget: 'Budget approssimativo',
    message: 'Aggiungi una breve descrizione del progetto.',
    optional: '(opzionale)',
    timeframePh: 'es. entro 6 settimane, Q4, flessibile',
    budgetPh: 'es. 5.000–15.000 €',
    messagePh: 'Descrivi l’idea principale, il pubblico previsto, il materiale disponibile e cosa deve ottenere l’esperienza.',
    sending: 'Invio…',
    success: 'Messaggio inviato a projects@iobjectm.com — risponderemo entro due giorni lavorativi.',
    error: 'Impossibile inviare il messaggio. Scrivi direttamente a projects@iobjectm.com.',
    required: 'Compila questo campo.',
    invalidEmail: 'Inserisci un indirizzo e-mail valido.',
    messageShort: 'Aggiungi una breve descrizione del progetto.',
    emailDirect: 'scrivi direttamente a projects@iobjectm.com',
  },
}
