import {
  LEGAL_CONTACT,
  LEGAL_LAST_UPDATED,
  type LegalLocalePack,
} from '../legalPages'

const disclosure =
  'IOM (Interactive Object Media) ist eine unabhängige Studio-Marke. Vertrags- und Rechnungsstellung werden für jedes Engagement transparent bestätigt.'

export const deLegal: LegalLocalePack = {
  privacy: {
    slug: 'privacy',
    title: 'Datenschutzerklärung',
    description:
      'Wie Interactive Object Media Informationen erhebt, nutzt und schützt, wenn Sie iobjectm.com verwenden.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'who',
        heading: 'Wer wir sind',
        paragraphs: [
          disclosure,
          `Diese Website wird unter der Studio-Marke Interactive Object Media (IOM) betrieben. Bei Datenschutzfragen schreiben Sie an ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'confidentiality',
        heading: 'Kundenvertraulichkeit',
        paragraphs: [
          'Kundenprojektarbeit ist vertraulich. Wir nutzen NDAs, wenn es sinnvoll ist, und veröffentlichen ohne Freigabe keine Kundennamen, proprietären Assets oder Projektdetails auf dieser Website.',
          'Öffentliche Case Studies und Demos beschreiben unseren Prozess und unser Handwerk allgemein — oder mit Materialien, die der Kunde freigegeben hat.',
        ],
      },
      {
        id: 'collect',
        heading: 'Welche Informationen wir erheben',
        paragraphs: [
          'Wir erheben nur, was wir brauchen, um Ihnen zu antworten und zu verstehen, wie die öffentliche Website genutzt wird.',
        ],
        bullets: [
          'Kontaktformular: Name, E-Mail-Adresse und Nachrichteninhalt, den Sie absenden.',
          'Optionale technische Metadaten vom Formularanbieter (z. B. ungefährer Absendezeitpunkt).',
          'Datenschutzfreundliche Website-Analytics: Seitenpfad, Referrer, Geräteklasse und eine kurzlebige Session-ID in sessionStorage — kein dauerhaftes Werbe-Cookie.',
          'Kundenportal (/client-login): Konto- und Projektdaten nur für authentifizierte Mitarbeitende und aktive Kunden; dieser Bereich ist vom öffentlichen Marketing getrennt.',
        ],
      },
      {
        id: 'use',
        heading: 'Wie wir Informationen nutzen',
        paragraphs: [
          'Kontaktanfragen dienen der Beantwortung und, wo sinnvoll, der Vorbereitung eines Angebots oder Projektgesprächs.',
          'Analytics-Ereignisse helfen uns, Navigation, Inhalte und Performance zu verbessern. Sie werden nicht an Dritte für Werbung verkauft.',
        ],
      },
      {
        id: 'processors',
        heading: 'Dienstleister',
        paragraphs: [
          'Öffentliche Kontaktnachrichten werden über Web3Forms (web3forms.com) zugestellt, das die von Ihnen eingegebenen Formularfelder verarbeitet, damit wir sie per E-Mail erhalten.',
          'Hosting und Auslieferung laufen über Vercel. Authentifizierte CRM-Daten (falls genutzt) liegen bei Supabase in unserer Projektkonfiguration.',
          'Diese Anbieter verarbeiten Daten nur, soweit es für ihre Dienste für uns nötig ist.',
        ],
      },
      {
        id: 'retention',
        heading: 'Speicherdauer',
        paragraphs: [
          'Kontakt-E-Mails werden so lange aufbewahrt, wie es zur Bearbeitung Ihrer Anfrage und für eine angemessene geschäftliche Korrespondenzdokumentation nötig ist.',
          'Analytics-Session-Kennungen liegen in sessionStorage und werden beim Ende der Browser-Sitzung gelöscht.',
          'Kundenportal-Datensätze folgen den Aufbewahrungspraktiken der beauftragenden Partei für dieses Projekt.',
        ],
      },
      {
        id: 'rights',
        heading: 'Ihre Wahlmöglichkeiten',
        paragraphs: [
          `Sie können ${LEGAL_CONTACT} schreiben und fragen, welche Kontaktdaten wir von dieser Website über Sie haben, oder — soweit vernünftig möglich — Korrektur oder Löschung von Anfrageakten verlangen.`,
          'Sie können Website-Daten in Ihrem Browser jederzeit löschen (einschließlich sessionStorage).',
        ],
      },
      {
        id: 'updates',
        heading: 'Aktualisierungen',
        paragraphs: [
          'Wir können diese Erklärung anpassen, wenn sich unsere Praktiken oder Tools ändern. Das Datum „Zuletzt aktualisiert“ oben auf der Seite ändert sich dann entsprechend.',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Nutzungsbedingungen',
    description:
      'Bedingungen für die Nutzung der Website von Interactive Object Media und verwandter öffentlicher Tools.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'brand',
        heading: 'Studio-Marke',
        paragraphs: [
          disclosure,
          'Verweise auf „IOM“, „wir“ oder „uns“ auf dieser Website meinen die Studio-Marke Interactive Object Media, sofern eine unterzeichnete Vereinbarung nichts anderes sagt.',
        ],
      },
      {
        id: 'site',
        heading: 'Nutzung dieser Website',
        paragraphs: [
          'Sie dürfen die öffentliche Website, Demos und veröffentlichte Materialien zur Bewertung und Information nutzen.',
          'Missbrauchen Sie die Website nicht (einschließlich Versuche, Dienste zu stören, private Bereiche auszulesen oder /client-login ohne Berechtigung zu nutzen).',
        ],
      },
      {
        id: 'projects',
        heading: 'Kundenarbeit',
        paragraphs: [
          'Bezahlte Projektarbeit, Liefergegenstände, Zeitpläne, Honorare und IP-Bedingungen unterliegen einer gesonderten schriftlichen Vereinbarung mit der beauftragenden Partei — nicht allein diesen Website-Bedingungen.',
          'Für aktive Projekte kann ein sicheres Kundenportal bereitgestellt werden; der Zugang ist auf eingeladene Nutzer beschränkt und vertraulich.',
        ],
      },
      {
        id: 'demos',
        heading: 'Demos und Experimente',
        paragraphs: [
          'Öffentliche Demos, Experimente und Sandbox-Tools (einschließlich /crm-demo) werden „wie besehen“ zur Veranschaulichung bereitgestellt. Sie können sich ändern, ausfallen oder ohne Vorankündigung entfernt werden und sind keine Produktionssysteme.',
        ],
      },
      {
        id: 'ip',
        heading: 'Inhalte und Marken',
        paragraphs: [
          'Website-Texte, Branding und Originalmedien bleiben Eigentum der jeweiligen Rechteinhaber. Kundenprojekt-Assets unterliegen dem jeweiligen Vertrag.',
          'Drittanbieter-Bibliotheken, Schriften und Demo-Quellen behalten ihre eigenen Lizenzen.',
        ],
      },
      {
        id: 'liability',
        heading: 'Haftungsausschluss',
        paragraphs: [
          'Die öffentliche Website und Demos werden ohne Gewähr für ununterbrochene Verfügbarkeit oder Eignung für einen bestimmten Zweck bereitgestellt.',
          'Soweit gesetzlich zulässig, haftet IOM nicht für indirekte oder Folgeschäden allein aus der Nutzung der öffentlichen Website. Vertragliche Projekthaftung ergibt sich aus der unterzeichneten Vereinbarung mit der beauftragenden Partei.',
        ],
      },
      {
        id: 'contact',
        heading: 'Kontakt',
        paragraphs: [`Fragen zu diesen Bedingungen: ${LEGAL_CONTACT}.`],
      },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Cookie-Richtlinie',
    description:
      'Wie Interactive Object Media Cookies und ähnliche Speichertechnologien auf iobjectm.com nutzt.',
    lastUpdated: LEGAL_LAST_UPDATED,
    disclosure,
    sections: [
      {
        id: 'summary',
        heading: 'Kurzfassung',
        paragraphs: [
          disclosure,
          'Diese Website nutzt keine Drittanbieter-Werbe-Cookies. Wir verwenden begrenzten lokalen und Session-Speicher für Einstellungen und datenschutzfreundliche Analytics.',
        ],
      },
      {
        id: 'what',
        heading: 'Was wir speichern',
        paragraphs: ['Je nachdem, was Sie nutzen, kann der Browser speichern:'],
        bullets: [
          'Session-Analytics-ID (sessionStorage) — verknüpft Seitenaufrufe in einem Besuch; wird beim Ende von Tab/Sitzung gelöscht.',
          'Mute-/Audio-Einstellung — damit Ambient-Sound aus bleibt, wenn Sie ihn stummgeschaltet haben.',
          'Spracheinstellung, soweit zutreffend — damit die Locale-Routing konsistent bleibt.',
          'Authentifizierte Portal-Session-Cookies oder Tokens auf /client-login — nur nach Anmeldung; erforderlich für den privaten Arbeitsbereich.',
        ],
      },
      {
        id: 'why',
        heading: 'Warum',
        paragraphs: [
          'Analytics zeigen, welche öffentlichen Seiten nützlich sind. Einstellungen verhindern, dass die Oberfläche bei jedem Besuch zurückgesetzt wird. Portal-Zugangsdaten schützen Kundenarbeit.',
        ],
      },
      {
        id: 'control',
        heading: 'Ihre Kontrolle',
        paragraphs: [
          'Sie können Cookies und Website-Daten in den Browsereinstellungen löschen. Das Blockieren allen Speichers kann Login am Kundenportal und manche Demos beeinträchtigen.',
          `Fragen: ${LEGAL_CONTACT}.`,
        ],
      },
      {
        id: 'more',
        heading: 'Verwandt',
        paragraphs: [
          'Siehe auch unsere Datenschutzerklärung dazu, wie Kontakt- und Analytics-Daten behandelt werden.',
        ],
      },
    ],
  },
}
