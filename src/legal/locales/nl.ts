import {
  LEGAL_CONTACT,
  LEGAL_LAST_UPDATED,
  type LegalLocalePack,
} from '../legalPages'

const disclosure =
  'IOM (Interactive Object Media) is een onafhankelijk studiolabel. Contracten voor klantwerk worden uitgegeven door de opdrachtgevende partij.'

export const nlLegal: LegalLocalePack = {
  privacy: {
    slug: 'privacy',
    title: 'Privacybeleid',
    description:
      'Hoe Interactive Object Media informatie verzamelt, gebruikt en beschermt wanneer u iobjectm.com gebruikt.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'who',
        heading: 'Wie wij zijn',
        paragraphs: [
          disclosure,
          `Deze site wordt geëxploiteerd onder het studiolabel Interactive Object Media (IOM). Voor privacyvragen mail ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'confidentiality',
        heading: 'Klantvertrouwelijkheid',
        paragraphs: [
          'Klantprojectwerk is vertrouwelijk. We gebruiken NDA’s waar dat past en publiceren zonder toestemming geen klantnamen, proprietary assets of projectdetails op deze site.',
          'Publieke case studies en demo’s beschrijven ons proces en craft in algemene termen — of met materiaal dat de klant heeft vrijgegeven.',
        ],
      },
      {
        id: 'collect',
        heading: 'Welke informatie we verzamelen',
        paragraphs: [
          'We verzamelen alleen wat nodig is om u te beantwoorden en te begrijpen hoe de openbare site wordt gebruikt.',
        ],
        bullets: [
          'Contactformulier: naam, e-mailadres en berichtinhoud die u indient.',
          'Optionele technische metadata van de formulieraanbieder (bijv. bij benadering het moment van verzenden).',
          'Privacyvriendelijke site-analytics: paginapad, referrer, apparaatklasse en een kortlevende sessie-id in sessionStorage — geen persistent advertentiecookie.',
          'Klantenportaal (/client-login): account- en projectgegevens alleen voor geauthenticeerd personeel en actieve klanten; die werkruimte is gescheiden van de openbare marketingsite.',
        ],
      },
      {
        id: 'use',
        heading: 'Hoe we informatie gebruiken',
        paragraphs: [
          'Contactberichten worden gebruikt om te antwoorden en, waar relevant, een voorstel of projectgesprek voor te bereiden.',
          'Analytics-events helpen ons navigatie, content en prestaties te verbeteren. Ze worden niet aan derden verkocht voor reclame.',
        ],
      },
      {
        id: 'processors',
        heading: 'Dienstverleners',
        paragraphs: [
          'Openbare contactberichten worden via Web3Forms (web3forms.com) bezorgd, dat de formuliervelden verwerkt zodat wij ze per e-mail ontvangen.',
          'Hosting en levering lopen via Vercel. Geauthenticeerde CRM-data (indien gebruikt) worden opgeslagen bij Supabase onder onze projectconfiguratie.',
          'Die aanbieders verwerken gegevens alleen voor zover nodig om hun diensten voor ons te leveren.',
        ],
      },
      {
        id: 'retention',
        heading: 'Bewaartermijn',
        paragraphs: [
          'Contactmails worden bewaard zolang nodig om uw verzoek te behandelen en een redelijk zakelijk correspondentiedossier bij te houden.',
          'Analytics-sessie-identifiers staan in sessionStorage en verdwijnen wanneer de browsersessie eindigt.',
          'Klantenportaalrecords volgen de bewaarpraktijken van de opdrachtgevende partij voor dat project.',
        ],
      },
      {
        id: 'rights',
        heading: 'Uw keuzes',
        paragraphs: [
          `U mag ${LEGAL_CONTACT} mailen om te vragen welke contactgegevens we via deze site over u hebben, of om correctie of verwijdering van aanvraagdossiers te verzoeken waar dat redelijkerwijs mogelijk is.`,
          'U kunt sitedata in uw browser (inclusief sessionStorage) op elk moment wissen.',
        ],
      },
      {
        id: 'updates',
        heading: 'Updates',
        paragraphs: [
          'We kunnen dit beleid bijwerken wanneer onze praktijken of tools veranderen. De datum “Laatst bijgewerkt” bovenaan deze pagina verandert dan.',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Gebruiksvoorwaarden',
    description:
      'Voorwaarden voor het gebruik van de website van Interactive Object Media en gerelateerde openbare tools.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'brand',
        heading: 'Studiolabel',
        paragraphs: [
          disclosure,
          'Verwijzingen naar “IOM”, “wij” of “ons” op deze site betekenen het studiolabel Interactive Object Media, tenzij een ondertekende overeenkomst anders bepaalt.',
        ],
      },
      {
        id: 'site',
        heading: 'Gebruik van deze website',
        paragraphs: [
          'U mag de openbare site, demo’s en gepubliceerde materialen raadplegen ter evaluatie en informatie.',
          'Misbruik de site niet (inclusief pogingen diensten te verstoren, privégebieden te scrapen, of /client-login zonder autorisatie te openen).',
        ],
      },
      {
        id: 'projects',
        heading: 'Klantwerk',
        paragraphs: [
          'Betaald projectwerk, deliverables, planning, honoraria en intellectuele-eigendomsvoorwaarden vallen onder een aparte schriftelijke overeenkomst met de opdrachtgevende partij — niet alleen onder deze websitevoorwaarden.',
          'Voor actieve projecten kan een beveiligd klantenportaal worden geboden; toegang is beperkt tot genodigde gebruikers en blijft vertrouwelijk.',
        ],
      },
      {
        id: 'demos',
        heading: 'Demo’s en experimenten',
        paragraphs: [
          'Openbare demo’s, experimenten en sandbox-tools (inclusief /crm-demo) worden “as-is” ter illustratie aangeboden. Ze kunnen wijzigen, stukgaan of zonder kennisgeving verdwijnen, en zijn geen productiesystemen.',
        ],
      },
      {
        id: 'ip',
        heading: 'Content en merken',
        paragraphs: [
          'Sitetekst, branding en originele media blijven eigendom van de betreffende rechthebbenden. Klantprojectassets blijven onderworpen aan het relevante contract.',
          'Bibliotheken van derden, lettertypen en demobronnen behouden hun eigen licenties.',
        ],
      },
      {
        id: 'liability',
        heading: 'Disclaimer',
        paragraphs: [
          'De openbare website en demo’s worden geleverd zonder garanties van ononderbroken beschikbaarheid of geschiktheid voor een bepaald doel.',
          'Voor zover de wet dat toelaat, is IOM niet aansprakelijk voor indirecte of gevolgschade die alleen voortkomt uit gebruik van de openbare site. Contractuele projectaansprakelijkheid staat in de ondertekende overeenkomst met de opdrachtgevende partij.',
        ],
      },
      {
        id: 'contact',
        heading: 'Contact',
        paragraphs: [`Vragen over deze voorwaarden: ${LEGAL_CONTACT}.`],
      },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookiebeleid',
    description:
      'Hoe Interactive Object Media cookies en vergelijkbare opslag op iobjectm.com gebruikt.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'summary',
        heading: 'Samenvatting',
        paragraphs: [
          disclosure,
          'Deze site gebruikt geen advertentiecookies van derden. We gebruiken beperkte lokale en sessieopslag voor voorkeuren en privacyvriendelijke analytics.',
        ],
      },
      {
        id: 'what',
        heading: 'Wat we opslaan',
        paragraphs: ['Afhankelijk van wat u gebruikt, kan de browser bewaren:'],
        bullets: [
          'Sessie-analytics-id (sessionStorage) — koppelt pageviews in één bezoek; verdwijnt wanneer tab/sessie eindigt.',
          'Mute-/audiovoorkeur — zodat ambient geluid uit blijft als u het dempte.',
          'Taalvoorkeur waar van toepassing — zodat locale-routing consistent blijft.',
          'Geauthenticeerde portalsessie-cookies of tokens op /client-login — alleen na inloggen; vereist voor de privéwerkruimte.',
        ],
      },
      {
        id: 'why',
        heading: 'Waarom',
        paragraphs: [
          'Analytics laten zien welke openbare pagina’s nuttig zijn. Voorkeuren voorkomen dat de interface bij elk bezoek reset. Portaalgegevens houden klantwerk veilig.',
        ],
      },
      {
        id: 'control',
        heading: 'Uw controle',
        paragraphs: [
          'U kunt cookies en sitedata wissen in de browserinstellingen. Alle opslag blokkeren kan login op het klantenportaal en sommige demo’s breken.',
          `Voor vragen: ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'more',
        heading: 'Gerelateerd',
        paragraphs: [
          'Zie ook ons Privacybeleid voor hoe contact- en analyticsgegevens worden behandeld.',
        ],
      },
    ],
  },
}
