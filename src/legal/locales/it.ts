import {
  LEGAL_CONTACT,
  LEGAL_LAST_UPDATED,
  type LegalLocalePack,
} from '../legalPages'

const disclosure =
  'IOM (Interactive Object Media) è un brand di studio indipendente. I contratti per il lavoro con i clienti sono emessi dalla parte contraente.'

export const itLegal: LegalLocalePack = {
  privacy: {
    slug: 'privacy',
    title: 'Informativa sulla privacy',
    description:
      'Come Interactive Object Media raccoglie, usa e protegge le informazioni quando usi iobjectm.com.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'who',
        heading: 'Chi siamo',
        paragraphs: [
          disclosure,
          `Questo sito è gestito con il brand di studio Interactive Object Media (IOM). Per domande sulla privacy, scrivi a ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'collect',
        heading: 'Informazioni che raccogliamo',
        paragraphs: [
          'Raccogliamo solo ciò che serve per risponderti e capire come viene usato il sito pubblico.',
        ],
        bullets: [
          'Modulo di contatto: nome, indirizzo email e contenuto del messaggio che invii.',
          'Metadati tecnici opzionali del provider del modulo (es. orario approssimativo di invio).',
          'Analytics rispettose della privacy: percorso pagina, referrer, classe dispositivo e un id di sessione a breve durata in sessionStorage — non un cookie pubblicitario persistente.',
          'Portale clienti (/client-login): dati di account e progetto solo per staff autenticato e clienti attivi; quello spazio è separato dal sito marketing pubblico.',
        ],
      },
      {
        id: 'use',
        heading: 'Come usiamo le informazioni',
        paragraphs: [
          'I messaggi di contatto servono a rispondere alle richieste e, dove rilevante, a preparare una proposta o una discussione di progetto.',
          'Gli eventi analytics ci aiutano a migliorare navigazione, contenuti e performance. Non sono venduti a terzi per pubblicità.',
        ],
      },
      {
        id: 'processors',
        heading: 'Fornitori di servizi',
        paragraphs: [
          'I messaggi di contatto pubblici sono recapitati tramite Web3Forms (web3forms.com), che elabora i campi del modulo affinché li riceviamo via email.',
          'Hosting e delivery passano da Vercel. I dati CRM autenticati (se usati) sono memorizzati con Supabase nella nostra configurazione di progetto.',
          'Quei fornitori trattano i dati solo quanto necessario per erogare i loro servizi per noi.',
        ],
      },
      {
        id: 'retention',
        heading: 'Conservazione',
        paragraphs: [
          'Le email di contatto sono conservate quanto necessario per gestire la richiesta e mantenere un ragionevole archivio di corrispondenza commerciale.',
          'Gli identificatori di sessione analytics vivono in sessionStorage e si cancellano al termine della sessione del browser.',
          'I record del portale clienti seguono le pratiche di conservazione della parte contraente per quel progetto.',
        ],
      },
      {
        id: 'rights',
        heading: 'Le tue scelte',
        paragraphs: [
          `Puoi scrivere a ${LEGAL_CONTACT} per chiedere quali dati di contatto deteniamo su di te da questo sito, o per richiedere correzione o cancellazione dei dossier di richiesta quando ragionevolmente possibile.`,
          'Puoi cancellare i dati del sito nel browser (incluso sessionStorage) in qualsiasi momento.',
        ],
      },
      {
        id: 'updates',
        heading: 'Aggiornamenti',
        paragraphs: [
          'Possiamo aggiornare questa informativa quando cambiano pratiche o strumenti. La data “Ultimo aggiornamento” in cima alla pagina cambierà di conseguenza.',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Termini di servizio',
    description:
      'Termini per l’uso del sito Interactive Object Media e degli strumenti pubblici correlati.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'brand',
        heading: 'Brand di studio',
        paragraphs: [
          disclosure,
          'I riferimenti a “IOM”, “noi” o “ci” su questo sito indicano il brand di studio Interactive Object Media, salvo diverso accordo firmato.',
        ],
      },
      {
        id: 'site',
        heading: 'Uso di questo sito',
        paragraphs: [
          'Puoi consultare il sito pubblico, le demo e i materiali pubblicati a scopo di valutazione e informazione.',
          'Non usare il sito in modo improprio (inclusi tentativi di interrompere i servizi, fare scraping di aree private o accedere a /client-login senza autorizzazione).',
        ],
      },
      {
        id: 'projects',
        heading: 'Lavoro con i clienti',
        paragraphs: [
          'Il lavoro di progetto a pagamento, i deliverable, le tempistiche, gli onorari e la proprietà intellettuale sono regolati da un accordo scritto separato con la parte contraente — non solo da questi termini del sito.',
          'Per i progetti attivi può essere fornito un portale clienti sicuro; l’accesso è limitato agli utenti invitati e resta confidenziale.',
        ],
      },
      {
        id: 'demos',
        heading: 'Demo ed esperimenti',
        paragraphs: [
          'Demo pubbliche, esperimenti e strumenti sandbox (incluso /crm-demo) sono forniti così come sono a scopo illustrativo. Possono cambiare, interrompersi o essere rimossi senza preavviso e non vanno usati come sistemi di produzione.',
        ],
      },
      {
        id: 'ip',
        heading: 'Contenuti e marchi',
        paragraphs: [
          'Testi del sito, branding e media originali restano di proprietà dei rispettivi titolari. Gli asset di progetto cliente restano soggetti al contratto pertinente.',
          'Librerie di terze parti, font e sorgenti demo mantengono le proprie licenze.',
        ],
      },
      {
        id: 'liability',
        heading: 'Esclusione di responsabilità',
        paragraphs: [
          'Il sito pubblico e le demo sono forniti senza garanzie di disponibilità ininterrotta o idoneità a uno scopo particolare.',
          'Nella misura consentita dalla legge, IOM non è responsabile di perdite indirette o consequenziali derivanti dal solo uso del sito pubblico. La responsabilità contrattuale di progetto è definita nell’accordo firmato con la parte contraente.',
        ],
      },
      {
        id: 'contact',
        heading: 'Contatto',
        paragraphs: [`Domande su questi termini: ${LEGAL_CONTACT}.`],
      },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Politica sui cookie',
    description:
      'Come Interactive Object Media usa cookie e archiviazione simile su iobjectm.com.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'summary',
        heading: 'Sintesi',
        paragraphs: [
          disclosure,
          'Questo sito non usa cookie pubblicitari di terze parti. Usiamo archiviazione locale e di sessione limitata per preferenze e analytics rispettose della privacy.',
        ],
      },
      {
        id: 'what',
        heading: 'Cosa memorizziamo',
        paragraphs: ['A seconda di ciò che usi, il browser può conservare:'],
        bullets: [
          'Id analytics di sessione (sessionStorage) — collega le pageview in una visita; si cancella a fine scheda/sessione.',
          'Preferenza mute / audio — così il suono ambientale resta spento se lo hai silenziato.',
          'Preferenza lingua dove applicabile — così il routing della locale resta coerente.',
          'Cookie o token di sessione del portale autenticato su /client-login — solo dopo l’accesso; necessari per lo spazio di lavoro privato.',
        ],
      },
      {
        id: 'why',
        heading: 'Perché',
        paragraphs: [
          'Le analytics mostrano quali pagine pubbliche sono utili. Le preferenze evitano di resettare l’interfaccia a ogni visita. Le credenziali del portale proteggono il lavoro cliente.',
        ],
      },
      {
        id: 'control',
        heading: 'Il tuo controllo',
        paragraphs: [
          'Puoi cancellare cookie e dati del sito nelle impostazioni del browser. Bloccare tutta l’archiviazione può impedire il login al portale clienti e alcune demo.',
          `Per domande: ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'more',
        heading: 'Correlati',
        paragraphs: [
          'Vedi anche l’Informativa sulla privacy per come sono gestiti i dati di contatto e analytics.',
        ],
      },
    ],
  },
}
