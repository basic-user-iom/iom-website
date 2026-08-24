import type { Locale } from './locale'

export type SystemMessage = {
  definition: string
  applications: string
  materials: string
  incision: string
  dimensions: string
  imageAlt: string
  notes?: string
}

export type Messages = {
  meta: {
    homeTitle: string
    projectsTitle: string
  }
  brand: {
    tagline: string
  }
  a11y: {
    language: string
    type: string
    primaryNav: string
    mobileNav: string
    introduction: string
    materialTransform: string
    filterProjects: string
    brandHome: string
    volumePercent: string
    heroFilm: string
    heroFilmHint: string
    heroIframe: string
  }
  nav: {
    material: string
    systems: string
    applications: string
    projects: string
    resources: string
    about: string
    contact: string
  }
  actions: {
    configureLinar: string
    unmute: string
    mute: string
    volume: string
    menu: string
    close: string
    skipToContent: string
    allProjects: string
    home: string
    unmuteFilm: string
    muteFilm: string
  }
  hero: {
    kicker: string
    title: string
    lead: string
    scroll: string
  }
  principle: {
    title: string
    body: string
    steps: [string, string, string, string, string]
    alts: [string, string, string, string, string]
  }
  transform: {
    kicker: string
    flat: string
    cut: string
    open: string
    bend: string
    form: string
    body: string
  }
  systems: {
    kicker: string
    title: string
    intro: string
    materials: string
    incision: string
    minRadius: string
    openArea: string
    dimensions: string
    configure: string
    items: Record<'sonar' | 'linar' | 'foli' | 'janus' | 'janus-tex' | 'duna', SystemMessage>
  }
  linar: {
    kicker: string
    title: string
    body: string
    opening: string
    bend: string
    openConfigurator: string
    note: string
  }
  applications: {
    kicker: string
    title: string
    items: Record<
      'walls' | 'ceilings' | 'acoustics' | 'partitions' | 'furniture' | 'lighting',
      { title: string; copy: string; alt: string }
    >
  }
  projects: {
    kicker: string
    title: string
    archiveTitle: string
    archiveIntro: string
    filters: {
      all: string
      walls: string
      ceilings: string
      acoustics: string
      partitions: string
      furniture: string
      lighting: string
      allSystems: string
    }
    empty: string
    material: string
    architect: string
    design: string
    partner: string
    photos: string
  }
  acoustics: {
    kicker: string
    title: string
    body: string
    note: string
    flat: string
    formed: string
    flatAlt: string
    formedAlt: string
  }
  press: {
    kicker: string
    quotes: [
      { text: string; attribution: string },
      { text: string; attribution: string },
      { text: string; attribution: string },
    ]
  }
  origin: {
    kicker: string
    title: string
    p1: string
    p2: string
    p3: string
    imageAlt: string
  }
  resources: {
    kicker: string
    title: string
    intro: string
    allSystems: string
    categories: {
      technical: string
      acoustic: string
      application: string
      samples: string
    }
    types: {
      page: string
      form: string
    }
    items: Record<
      'semiFinished' | 'linar' | 'acoustic' | 'partitions' | 'furniture' | 'samples',
      { title: string; note?: string }
    >
  }
  contact: {
    title: string
    body: string
    samples: string
    configure: string
    questions: string
    studio: string
  }
  footer: {
    studio: string
    conceptBy: string
  }
  loader: string
}

const EN_INCISION = 'Standard incision: 4 mm cut / 4 mm bar'
const DE_INCISION = 'Standard Schnitt: 4 mm Nut / 4 mm Steg'
const EN_MATERIALS = 'MDF, plywood, 3-layer board'
const DE_MATERIALS = 'MDF, Furniersperrholz, Tischlerplatten'

export const en: Messages = {
  meta: {
    homeTitle: 'dukta – flexible wood',
    projectsTitle: 'Projects · dukta – flexible wood',
  },
  brand: {
    tagline: 'flexible wood',
  },
  a11y: {
    language: 'Language',
    type: 'Type',
    primaryNav: 'Primary',
    mobileNav: 'Mobile',
    introduction: 'Introduction',
    materialTransform: 'Material transformation',
    filterProjects: 'Filter projects',
    brandHome: 'dukta home',
    volumePercent: '{n} percent',
    heroFilm: 'Background film of dukta flexible wood. Starts muted at {n}% volume.',
    heroFilmHint: ' Use the header sound controls to unmute and adjust level.',
    heroIframe: 'dukta flexible wood',
  },
  nav: {
    material: 'Material',
    systems: 'Systems',
    applications: 'Applications',
    projects: 'Projects',
    resources: 'Resources',
    about: 'About',
    contact: 'Contact',
  },
  actions: {
    configureLinar: 'Configure LINAR',
    unmute: 'Unmute',
    mute: 'Mute',
    volume: 'Film volume',
    menu: 'Menu',
    close: 'Close',
    skipToContent: 'Skip to content',
    allProjects: 'All projects →',
    home: '← Home',
    unmuteFilm: 'Unmute film',
    muteFilm: 'Mute film',
  },
  hero: {
    kicker: 'dukta · Zürich',
    title: 'Flexible Wood',
    lead: 'Rigid material, transformed through incision.',
    scroll: 'Scroll',
  },
  principle: {
    title: 'One cut changes how wood behaves.',
    body: 'dukta – flexible wood is a unique incision process to make wood and engineered wood flexible. The incision patterns give the material almost textile properties and its qualities and areas of application are considerably expanded.',
    steps: ['Panel', 'Incision', 'Opening', 'Bending', 'Surface'],
    alts: [
      'Flat dukta board sample',
      'Continuous LINAR incision pattern',
      'Close-up of perforating incision, bridge and slat',
      'LINAR panel bent into a curve',
      'Formed spruce dukta wall surface',
    ],
  },
  transform: {
    kicker: 'Material transform',
    flat: 'Flat panel',
    cut: 'Incisions appear',
    open: 'Light through the cuts',
    bend: 'The board begins to flex',
    form: 'Architecture takes form',
    body: 'The internationally patented dukta process works with commercially available wood materials such as plywood, MDF and three-layer boards.',
  },
  systems: {
    kicker: 'Incision systems',
    title: 'Different geometries. Different behaviour.',
    intro:
      'Nearly all commercial wood-based boards can be made flexible using the dukta process. The various incision types differ in appearance, open area and flexibility.',
    materials: 'Materials',
    incision: 'Incision',
    minRadius: 'Min. bending radius',
    openArea: 'Open area',
    dimensions: 'Standard dimensions',
    configure: 'Configure LINAR →',
    items: {
      sonar: {
        definition:
          'dukta SONAR’s regular incisions in the longitudinal direction are discontinuous on the surface. This arrangement creates, besides the vertical lines, also horizontal lines as a visual effect. Therefore, front and reverse side look clearly different.',
        applications: 'Ceiling and wall panels.',
        materials: EN_MATERIALS,
        incision: EN_INCISION,
        dimensions: '2800 × 1200 × 6–12 mm',
        imageAlt: 'SONAR wall cladding following a room’s curve',
      },
      linar: {
        definition:
          'The incisions of dukta LINAR are regular and continuous on the surface. As a visual effect, this arrangement creates a calm and homogenous surface. Front and reverse side look clearly different.',
        applications: 'Ceiling and wall panels.',
        materials: EN_MATERIALS,
        incision: EN_INCISION,
        dimensions: '2800 × 1200 × 6–12 mm',
        imageAlt: 'LINAR panel bent to demonstrate continuous incision flexibility',
      },
      foli: {
        definition:
          'FOLI1’s lenticular incisions are regular and in the longitudinal direction discontinuous. The incisions of FOLI2 are continuous on the surface. The lenticular incisions create a playful and vivid visual pattern.',
        applications: 'Ceiling and wall panels.',
        materials: EN_MATERIALS,
        incision: EN_INCISION,
        dimensions: '2800 × 1200 × 6–12 mm',
        imageAlt: 'FOLI applied as waved wall covering in a boutique interior',
      },
      janus: {
        definition:
          'The incisions of dukta JANUS are made on the front and the back of the board. Thereby even thick boards can bend around a small radius. JANUS has the same visual appearance on both sides and is therefore suitable to be used freestanding as partitions.',
        applications: 'Freestanding partitions, two-sided elements.',
        materials: EN_MATERIALS,
        incision: EN_INCISION,
        dimensions: '2800 × 1200 × 12–42 mm',
        imageAlt: 'JANUS maple partition elements in a hall',
      },
      'janus-tex': {
        definition:
          'These boards contain an intermediate layer of textile. This layer can either be of coloured fabric or of an acoustically active felt. Therefore, the visual effect is different from other boards and it offers additional acoustic absorption.',
        applications: 'Partitions and rooms where additional absorption is required.',
        materials: 'MDF, plywood, 3-layer board, with fabric or felt interlayer',
        incision: EN_INCISION,
        dimensions: '2800 × 1200 × 12–42 mm',
        imageAlt: 'JANUS-TEX board with textile interlayer visible through the incisions',
      },
      duna: {
        definition:
          'DUNA is an exception within the dukta incision types, as it is only stable in solid wood. Due to the double-sided incision grid it can be bent and twisted three-dimensionally. The manufacture and application of DUNA panels is very delicate.',
        applications: 'Sculptural and three-dimensional forming.',
        materials: 'Solid wood (lime wood, poplar, etc.)',
        incision: EN_INCISION,
        dimensions: 'None specified',
        imageAlt: 'DUNA solid-wood panel with a crossing incision grid',
        notes: 'No samples available at the time of the source listing.',
      },
    },
  },
  linar: {
    kicker: 'LINAR',
    title: 'Experience the cut before you engineer it.',
    body: 'A calm, continuous incision. Front and reverse look different. Application areas are mainly ceiling and wall panels.',
    opening: 'Incision opening',
    bend: 'Bend',
    openConfigurator: 'Open LINAR Configurator →',
    note: 'The full configurator keeps validated sample data and calculation logic. This teaser is visual only.',
  },
  applications: {
    kicker: 'Applications',
    title: 'How architects and designers use it.',
    items: {
      walls: {
        title: 'Walls',
        copy: 'Incised panels follow the room. Installed flat they remain comparable to good traditional absorbers; formed, they take on spatial and acoustic work at once.',
        alt: 'Curved spruce dukta wall with visible incision rhythm',
      },
      ceilings: {
        title: 'Ceilings',
        copy: 'Ceiling applications use the same boards as walls. Wave geometry and back filling let absorption and diffusion be tuned to the room.',
        alt: 'Toni-Areal concert foyer with undulating dukta wall and ceiling baffles',
      },
      acoustics: {
        title: 'Acoustic surfaces',
        copy: 'The sound absorption properties of corrugated dukta acoustic walls and ceilings are unique. Across all frequencies, they achieve NRC values as high as other products only in specific frequency ranges.',
        alt: 'Formed dukta acoustic wall with corrugated geometry',
      },
      partitions: {
        title: 'Partitions',
        copy: 'dukta partition walls are used in large, open-plan offices, foyers, libraries, restaurant and festival spaces. The individual elements can be shaped and added to without limitations. Rollers can be applied to add mobility.',
        alt: 'Freestanding incised partition on castors in an open interior',
      },
      furniture: {
        title: 'Furniture',
        copy: 'The pliability and durability of dukta boards open up new horizons for wood in the field of furniture construction.',
        alt: 'Sculptural knotted furniture form in dukta flexible wood',
      },
      lighting: {
        title: 'Lighting',
        copy: 'The partial transparency of the dukta boards lends itself to being used in conjunction with lighting, leaving an atmospheric cascade of shadows.',
        alt: 'Pendant light with incised wood shade',
      },
    },
  },
  projects: {
    kicker: 'Projects',
    title: 'Architecture as material archive.',
    archiveTitle: 'Architectural archive',
    archiveIntro:
      'Verified projects from dukta.com. Filters only use metadata present in the source material.',
    filters: {
      all: 'All',
      walls: 'Walls',
      ceilings: 'Ceilings',
      acoustics: 'Acoustics',
      partitions: 'Partitions',
      furniture: 'Furniture',
      lighting: 'Lighting',
      allSystems: 'All systems',
    },
    empty: 'No projects match these filters.',
    material: 'Material',
    architect: 'Architect',
    design: 'Design',
    partner: 'Partner',
    photos: 'Photos',
  },
  acoustics: {
    kicker: 'Acoustics',
    title: 'Flat or formed — the surface works with sound.',
    body: 'Measurements made by EMPA Schweiz (Swiss Federal Laboratories for Materials Science and Technology) confirmed the high absorption properties. Sound absorption and diffusion can be controlled by the wave form and the back filling of the elements.',
    note: 'Exact NRC tables are available on the official acoustic systems pages. They are not invented or approximated here.',
    flat: 'Flat',
    formed: 'Formed',
    flatAlt: 'Flat dukta panel with open incision pattern',
    formedAlt: 'Corrugated dukta acoustic wall',
  },
  press: {
    kicker: 'Press',
    quotes: [
      {
        text: 'From a formal perspective, dukta is convincing because the interplay of width, shape, and depth of the cuts, as well as the choice of material (…), results in a wide range of possible end products. At the same time, the individual workpieces develop an aesthetic all of their own.',
        attribution: 'NZZ Domizil',
      },
      {
        text: 'dukta possesses properties that lend a pleasant liveliness to room acoustics, which is particularly useful in acoustically demanding spaces.',
        attribution: 'Martin Lachmann, applied acoustics',
      },
      {
        text: 'dukta remarkably combines traditional wood with the latest production technologies and a simple, brilliant idea that opens the natural material to innovative design concepts.',
        attribution: 'md, Interior | Design | Architecture',
      },
    ],
  },
  origin: {
    kicker: 'Origin',
    title: 'From wood-bending experiments to a patented process.',
    p1: 'dukta gmbh is a development & design office located in Zürich, Switzerland. Based on the internationally patented dukta incision process we create new applications, interiors and products.',
    p2: 'This complex, versatile and patented process has its roots in wood bending experiments in 2007. Thanks to a CTI research project and various exhibitions and awards, dukta has become synonymous with flexible wood products throughout the world. Since 2015, products based on dukta processes have been manufactured and marketed throughout Europe by licensed partners.',
    p3: 'Serge and Pablo Lunin have been jointly leading dukta gmbh since 2015.',
    imageAlt: 'Demonstration of a deeply flexed dukta panel in the workshop',
  },
  resources: {
    kicker: 'Resources',
    title: 'Technical information for specification.',
    intro:
      'Architects can access product and acoustic information through dukta and licensed manufacturers. Only verified links are listed here.',
    allSystems: 'All',
    categories: {
      technical: 'Technical',
      acoustic: 'Acoustic',
      application: 'Application',
      samples: 'Samples',
    },
    types: {
      page: 'Page',
      form: 'Form',
    },
    items: {
      semiFinished: {
        title: 'Semi-finished boards',
        note: 'SONAR, LINAR, FOLI, JANUS, JANUS-TEX, DUNA',
      },
      linar: {
        title: 'LINAR',
      },
      acoustic: {
        title: 'Acoustic systems',
        note: 'Measurements by EMPA Switzerland. NRC figures are not reproduced here without the source tables.',
      },
      partitions: {
        title: 'Partition walls',
      },
      furniture: {
        title: 'Furniture & lights',
      },
      samples: {
        title: 'Order samples',
        note: 'A4 sample boards. JANUS-TEX optional. DUNA samples not available at the time of the source listing.',
      },
    },
  },
  contact: {
    title: 'What could wood become?',
    body: 'Together with selected and licensed manufacturers, dukta advises and supports architects, engineers and building owners through technical and design matters.',
    samples: 'Request samples →',
    configure: 'Configure LINAR →',
    questions: 'Technical questions →',
    studio: 'Studio',
  },
  footer: {
    studio: 'Studio',
    conceptBy: 'Concept by IOM',
  },
  loader: 'Loading dukta',
}

export const de: Messages = {
  meta: {
    homeTitle: 'dukta – flexible wood',
    projectsTitle: 'Projekte · dukta – flexible wood',
  },
  brand: {
    tagline: 'flexible wood',
  },
  a11y: {
    language: 'Sprache',
    type: 'Schrift',
    primaryNav: 'Hauptnavigation',
    mobileNav: 'Mobile Navigation',
    introduction: 'Einführung',
    materialTransform: 'Materialverwandlung',
    filterProjects: 'Projekte filtern',
    brandHome: 'dukta Startseite',
    volumePercent: '{n} Prozent',
    heroFilm: 'Hintergrundfilm zu dukta flexible wood. Startet stumm bei {n}% Lautstärke.',
    heroFilmHint: ' Über die Sound-Steuerung im Header Ton aktivieren und Lautstärke anpassen.',
    heroIframe: 'dukta flexible wood',
  },
  nav: {
    material: 'Material',
    systems: 'Systeme',
    applications: 'Anwendungen',
    projects: 'Projekte',
    resources: 'Ressourcen',
    about: 'Über uns',
    contact: 'Kontakt',
  },
  actions: {
    configureLinar: 'LINAR konfigurieren',
    unmute: 'Ton an',
    mute: 'Stumm',
    volume: 'Film-Lautstärke',
    menu: 'Menü',
    close: 'Schliessen',
    skipToContent: 'Zum Inhalt springen',
    allProjects: 'Alle Projekte →',
    home: '← Start',
    unmuteFilm: 'Film-Ton an',
    muteFilm: 'Film stumm',
  },
  hero: {
    kicker: 'dukta · Zürich',
    title: 'Flexible Wood',
    lead: 'Starres Material, verwandelt durch Einschnitte.',
    scroll: 'Scrollen',
  },
  principle: {
    title: 'Ein Schnitt verändert, wie Holz sich verhält.',
    body: 'dukta ist ein einzigartiges Einschneideverfahren, das Holz und Holzwerkstoffe flexibel macht. Durch die Einschnitte erhält das Material nahezu textile Eigenschaften und seine Einsatzbereiche und Qualitäten werden erheblich erweitert.',
    steps: ['Platte', 'Einschnitt', 'Öffnung', 'Biegen', 'Fläche'],
    alts: [
      'Flache dukta-Plattenmuster',
      'Durchgehendes LINAR-Schnittbild',
      'Nahaufnahme von Einschnitt, Steg und Lamelle',
      'Zu einer Kurve gebogene LINAR-Platte',
      'Geformte dukta-Wandfläche aus Fichte',
    ],
  },
  transform: {
    kicker: 'Materialverwandlung',
    flat: 'Flache Platte',
    cut: 'Einschnitte erscheinen',
    open: 'Licht durch die Schnitte',
    bend: 'Die Platte beginnt zu federn',
    form: 'Architektur nimmt Gestalt an',
    body: 'Das international patentierte dukta-Verfahren funktioniert mit handelsüblichen Holzwerkstoffen wie Sperrholz, MDF und Dreischichtplatten.',
  },
  systems: {
    kicker: 'Schnitt-Systeme',
    title: 'Andere Geometrien. Anderes Verhalten.',
    intro:
      'Nahezu alle handelsüblichen Holzwerkstoffplatten können durch das dukta-Verfahren biegbar gemacht werden. Die verschiedenen Schnitt-Typen unterscheiden sich im Schnittbild, im Anteil an offener Fläche und in ihrer Flexibilität.',
    materials: 'Werkstoffe',
    incision: 'Einschnitt',
    minRadius: 'Min. Biegeradius',
    openArea: 'Offene Fläche',
    dimensions: 'Standardmasse',
    configure: 'LINAR konfigurieren →',
    items: {
      sonar: {
        definition:
          'Beim Schnitt-Typ SONAR sind die regelmässig angeordneten Einschnitte in Längsrichtung an der Plattenoberfläche sichtbar abgesetzt. Dadurch entstehen optisch neben den vertikalen auch horizontale Linien. Vorder- und Rückseite unterscheiden sich deutlich.',
        applications: 'Decken- und Wandapplikationen.',
        materials: DE_MATERIALS,
        incision: DE_INCISION,
        dimensions: '2800 × 1200 × 6–12 mm',
        imageAlt: 'SONAR-Wandverkleidung dem Raumverlauf folgend',
      },
      linar: {
        definition:
          'Die regelmässigen Einschnitte sind beim Schnitt-Typ LINAR oberflächlich durchgehend. Dadurch entsteht ein ruhiges und homogenes Schnittbild. Vorder- und Rückseite unterscheiden sich deutlich.',
        applications: 'Decken- und Wandapplikationen.',
        materials: DE_MATERIALS,
        incision: DE_INCISION,
        dimensions: '2800 × 1200 × 6–12 mm',
        imageAlt: 'Gebogene LINAR-Platte mit durchgehendem Schnittbild',
      },
      foli: {
        definition:
          'Die linsenförmigen Einschnitte von FOLI1 verlaufen in Längsrichtung regelmässig und unterbrochen. Bei FOLI2 sind die Einschnitte an der Oberfläche durchgehend. Das linsenförmige Schnittbild wirkt verspielt und lebendig.',
        applications: 'Decken- und Wandapplikationen.',
        materials: DE_MATERIALS,
        incision: DE_INCISION,
        dimensions: '2800 × 1200 × 6–12 mm',
        imageAlt: 'FOLI als gewellte Wandverkleidung in einer Boutique',
      },
      janus: {
        definition:
          'Beim Schnitt-Typ JANUS werden die Einschnitte auf Vorder- und Rückseite der Platte ausgeführt. Dadurch lassen sich auch dicke Platten um kleine Radien biegen. JANUS sieht auf beiden Seiten gleich aus und eignet sich deshalb für freistehende Trennwände.',
        applications: 'Freistehende Trennwände, zweiseitige Elemente.',
        materials: DE_MATERIALS,
        incision: DE_INCISION,
        dimensions: '2800 × 1200 × 12–42 mm',
        imageAlt: 'JANUS-Raumtrenner aus Ahorn in einem Saal',
      },
      'janus-tex': {
        definition:
          'Diese Platten enthalten eine textile Zwischenschicht aus farbigem Gewebe oder akustisch wirksamem Filz. Dadurch unterscheidet sich die Optik von anderen Platten und bietet zusätzliche Schallabsorption.',
        applications: 'Trennwände und Räume mit zusätzlichem Absorptionsbedarf.',
        materials: 'MDF, Furniersperrholz, Tischlerplatten, mit Gewebe- oder Filzzwischenlage',
        incision: DE_INCISION,
        dimensions: '2800 × 1200 × 12–42 mm',
        imageAlt: 'JANUS-TEX-Platte mit textiler Zwischenschicht durch die Einschnitte',
      },
      duna: {
        definition:
          'DUNA bildet eine Ausnahme unter den dukta-Schnitttypen und ist nur in Massivholz stabil. Durch das beidseitige Schnittgitter lässt sich die Platte dreidimensional biegen und verdrehen. Herstellung und Anwendung sind besonders anspruchsvoll.',
        applications: 'Skulpturale und dreidimensionale Formungen.',
        materials: 'Massivholz (Lindenholz, Pappel u. a.)',
        incision: DE_INCISION,
        dimensions: 'Keine Angabe',
        imageAlt: 'DUNA-Massivholzplatte mit kreuzendem Schnittgitter',
        notes: 'Zur Zeit keine Muster verfügbar.',
      },
    },
  },
  linar: {
    kicker: 'LINAR',
    title: 'Den Schnitt erleben, bevor man ihn spezifiziert.',
    body: 'Ein ruhiger, durchgehender Einschnitt. Vorder- und Rückseite unterscheiden sich. Einsatz vorwiegend bei Decken- und Wandpaneelen.',
    opening: 'Schnittöffnung',
    bend: 'Biegung',
    openConfigurator: 'LINAR-Konfigurator öffnen →',
    note: 'Der vollständige Konfigurator behält validierte Musterdaten und Berechnungslogik. Dieser Teaser ist rein visuell.',
  },
  applications: {
    kicker: 'Anwendungen',
    title: 'So denken Architektinnen und Designer damit.',
    items: {
      walls: {
        title: 'Wände',
        copy: 'Eingeschrittene Paneele folgen dem Raum. Flach eingebaut bleiben sie mit guten traditionellen Absorbern vergleichbar; geformt übernehmen sie räumliche und akustische Aufgaben zugleich.',
        alt: 'Geschwungene dukta-Wand aus Fichte mit sichtbarem Schnittrhythmus',
      },
      ceilings: {
        title: 'Decken',
        copy: 'Deckenanwendungen nutzen dieselben Platten wie Wände. Wellengeometrie und Hinterfüllung lassen Absorption und Diffusion auf den Raum abstimmen.',
        alt: 'Toni-Areal Konzertfoyer mit gewellter dukta-Wand und Deckenbaffeln',
      },
      acoustics: {
        title: 'Akustikflächen',
        copy: 'Die Absorptionseigenschaften von gewellten dukta-Akustikwänden und -decken sind einmalig. Quer durch alle Frequenzen erreichen sie so hohe Werte wie andere Produkte nur in spezifischen Frequenzbereichen.',
        alt: 'Geformte dukta-Akustikwand mit Wellengeometrie',
      },
      partitions: {
        title: 'Trennwände',
        copy: 'dukta-Trennwände kommen in Grossraumbüros, Foyers, Bibliotheken, Restaurants oder Festsälen zum Einsatz. Die einzelnen Elemente können geformt und endlos addiert werden. Mit Rollen werden sie fahrbar.',
        alt: 'Freistehende eingeschnittene Trennwand auf Rollen in einem offenen Innenraum',
      },
      furniture: {
        title: 'Möbel',
        copy: 'Die Biegsamkeit und dauerhafte Beweglichkeit der dukta-Platten eröffnen für Holzwerkstoffe neue Anwendungsgebiete im Möbelbau.',
        alt: 'Skulpturale geknotete Möbelform aus dukta flexible wood',
      },
      lighting: {
        title: 'Leuchten',
        copy: 'Die partielle Transparenz der perforierten Holzwerkstoffplatten lädt ein, das Material mit Leuchtquellen zu kombinieren – für stimmungsvolle Schattenwürfe.',
        alt: 'Pendelleuchte mit eingeschnittenem Holzschirm',
      },
    },
  },
  projects: {
    kicker: 'Projekte',
    title: 'Architektur als Materialarchiv.',
    archiveTitle: 'Architektur-Archiv',
    archiveIntro:
      'Verifizierte Projekte von dukta.com. Filter nutzen nur vorhandene Metadaten aus den Quellen.',
    filters: {
      all: 'Alle',
      walls: 'Wände',
      ceilings: 'Decken',
      acoustics: 'Akustik',
      partitions: 'Trennwände',
      furniture: 'Möbel',
      lighting: 'Leuchten',
      allSystems: 'Alle Systeme',
    },
    empty: 'Keine Projekte entsprechen diesen Filtern.',
    material: 'Material',
    architect: 'Architektur',
    design: 'Gestaltung',
    partner: 'Partner',
    photos: 'Fotos',
  },
  acoustics: {
    kicker: 'Akustik',
    title: 'Flach oder geformt — die Fläche arbeitet mit dem Klang.',
    body: 'Messungen der EMPA Schweiz (Eidgenössische Materialprüfungs- und Forschungsanstalt) bestätigten die hohen Absorptionseigenschaften. Schallabsorption und Diffusion lassen sich über Wellenform und Hinterfüllung steuern.',
    note: 'Exakte NRC-Tabellen finden sich auf den offiziellen Akustikseiten. Hier werden keine Werte erfunden oder geschätzt.',
    flat: 'Flach',
    formed: 'Geformt',
    flatAlt: 'Flache dukta-Platte mit offenem Schnittbild',
    formedAlt: 'Gewellte dukta-Akustikwand',
  },
  press: {
    kicker: 'Presse',
    quotes: [
      {
        text: 'In formaler Hinsicht überzeugt dukta, weil sich durch das Zusammenspiel von Breite, Form und Tiefe der Schnitte sowie durch die Wahl des Materials (…) eine breite Palette von möglichen Endprodukten ergibt. Gleichzeitig entfalten die einzelnen Werkstücke eine ganz eigene Ästhetik.',
        attribution: 'NZZ Domizil',
      },
      {
        text: 'dukta besitzt Eigenschaften, die zu einer angenehmen Lebendigkeit des Raumklangs führen, welche insbesondere in akustisch anspruchsvollen Räumen sinnvoll ist.',
        attribution: 'Martin Lachmann, applied acoustics',
      },
      {
        text: 'dukta verbindet auf erstaunliche Weise das traditionelle Material Holz mit neuesten Fertigungstechnologien und einer einfachen, zündenden Idee, die den Naturwerkstoff für innovative Gestaltungskonzepte erschliesst.',
        attribution: 'md, Interior | Design | Architecture',
      },
    ],
  },
  origin: {
    kicker: 'Entstehung',
    title: 'Von Holzbiege-Experimenten zum patentierten Verfahren.',
    p1: 'Die dukta gmbh entwickelt auf der Basis des international patentierten dukta-Einschnittverfahrens neue Anwendungen, Interieurs und Produkte.',
    p2: 'Aus den Holzbiege-Experimenten von 2007 hat sich bis heute ein komplexes, vielseitig einsetzbares und patentiertes Verfahren entwickelt. Dank eines KTI-Forschungsprojekts, Ausstellungen und Auszeichnungen wurde dukta weltweit zum Begriff für flexibles Holz. Seit 2015 werden auf dukta basierende Produkte von lizenzierten Partnern europaweit hergestellt und vertrieben.',
    p3: 'Serge und Pablo Lunin leiten die dukta gmbh seit 2015 gemeinsam.',
    imageAlt: 'Demonstration einer tief gebogenen dukta-Platte in der Werkstatt',
  },
  resources: {
    kicker: 'Ressourcen',
    title: 'Technische Informationen für die Spezifikation.',
    intro:
      'Architektinnen und Architekten erhalten Produkt- und Akustikinformationen über dukta und lizenzierte Hersteller. Hier sind nur verifizierte Links aufgeführt.',
    allSystems: 'Alle',
    categories: {
      technical: 'Technisch',
      acoustic: 'Akustik',
      application: 'Anwendung',
      samples: 'Muster',
    },
    types: {
      page: 'Seite',
      form: 'Formular',
    },
    items: {
      semiFinished: {
        title: 'Halbfabrikate',
        note: 'SONAR, LINAR, FOLI, JANUS, JANUS-TEX, DUNA',
      },
      linar: {
        title: 'LINAR',
      },
      acoustic: {
        title: 'Akustik-Systeme',
        note: 'Messungen der EMPA Schweiz. NRC-Werte werden hier ohne Quellentabellen nicht wiedergegeben.',
      },
      partitions: {
        title: 'Trennwände',
      },
      furniture: {
        title: 'Möbel & Leuchten',
      },
      samples: {
        title: 'Muster bestellen',
        note: 'A4-Musterplatten. JANUS-TEX optional. DUNA-Muster zum Zeitpunkt der Quellenangabe nicht verfügbar.',
      },
    },
  },
  contact: {
    title: 'Was könnte Holz werden?',
    body: 'Zusammen mit ausgewählten und lizenzierten Herstellern berät und unterstützt dukta Verarbeiter, Architektinnen und Bauherrschaften in technischen und gestalterischen Fragen.',
    samples: 'Muster anfordern →',
    configure: 'LINAR konfigurieren →',
    questions: 'Technische Fragen →',
    studio: 'Studio',
  },
  footer: {
    studio: 'Studio',
    conceptBy: 'Konzept von IOM',
  },
  loader: 'dukta wird geladen',
}

export const MESSAGES: Record<Locale, Messages> = { en, de }

export function formatMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}
