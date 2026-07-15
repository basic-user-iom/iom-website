import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ActivityType, LeadStatus, LeadTemperature } from './types'
import {
  DEMO_LANG_KEY,
  DEMO_LANGS,
  DEMO_LOCALE_TAGS,
  demoDictionaries,
  type DemoLang,
} from './demoLocales'

/** Staff CRM: EN ↔ SR. Public demo also uses DE / NL / FR / IT (never SR). */
export type CrmLang = 'en' | 'sr' | DemoLang

export const CRM_LANG_KEY = 'iom-crm-lang'

export type { DemoLang }
export { DEMO_LANGS }

type Dict = Record<string, string>

const en: Dict = {
  'boot.loading': 'Loading…',
  'topbar.kicker': 'Client Login',
  'topbar.title': 'Lead CRM',
  'topbar.online': 'Online',
  'topbar.local': 'Local',
  'topbar.demo': 'Demo',
  'topbar.help': 'Help',
  'topbar.helpAria': 'Open CRM help guide',
  'topbar.helpTitle': 'How to use IOM CRM',
  'topbar.signOut': 'Sign out',
  'topbar.langEn': 'English',
  'topbar.langSr': 'Serbian',
  'topbar.langDe': 'German',
  'topbar.langNl': 'Dutch',
  'topbar.langFr': 'French',
  'topbar.langIt': 'Italian',
  'topbar.langToggle': 'Switch language',
  'topbar.langAria': 'Switch language',
  'topbar.langToSr': 'Switch to Serbian',
  'topbar.langToEn': 'Switch to English',
  'topbar.site': '← IOM site',
  'topbar.backSite': '← IOM site',

  'stats.visible': 'Visible leads',
  'stats.open': 'Open pipeline',
  'stats.hot': 'Hot leads',

  'calendar.title': 'Follow-up calendar',
  'calendar.expand': 'Expand follow-up calendar',
  'calendar.collapse': 'Collapse follow-up calendar',
  'calendar.prev': 'Previous month',
  'calendar.next': 'Next month',
  'calendar.day': 'Day {day}',
  'calendar.dayWithFollowUps': 'Day {day}, {count} follow-up(s)',
  'calendar.clearFilter': 'Clear date filter',

  'toolbar.search': 'Search company, contact, email…',
  'toolbar.allStages': 'All stages',
  'toolbar.allTemps': 'All temperatures',
  'toolbar.allOwners': 'All added by',
  'toolbar.stageFilter': 'Filter by pipeline stage',
  'toolbar.tempFilter': 'Filter by temperature',
  'toolbar.ownerFilter': 'Filter by who added',
  'toolbar.sort': 'Sort leads',
  'toolbar.sortUpdated': 'Sort: last updated',
  'toolbar.sortOwner': 'Sort: who added',
  'toolbar.sortStatus': 'Sort: pipeline stage',
  'toolbar.addLead': '+ Add lead',
  'toolbar.backList': 'Back to list',
  'toolbar.backToList': 'Back to list',

  'create.title': 'Add potential client',

  'chatgpt.title': 'ChatGPT lead assist',
  'chatgpt.blurb':
    'Copy a research prompt into ChatGPT, paste the JSON response back, and load the form in one click.',
  'chatgpt.copyPrompt': 'Copy ChatGPT prompt',
  'chatgpt.step1': 'Copy the prompt and paste it into ChatGPT (add the company name or URL in your message).',
  'chatgpt.step2': 'Ask ChatGPT to return the JSON object only.',
  'chatgpt.step3': 'Paste the JSON below and click Load into form — review, then save.',
  'chatgpt.pasteLabel': 'Paste ChatGPT JSON',
  'chatgpt.pastePlaceholder': 'Paste JSON from ChatGPT here (with or without ```json fences)…',
  'chatgpt.loadIntoForm': 'Load into form',
  'chatgpt.loadSuccess': 'Lead fields loaded — review and save when ready.',
  'chatgpt.copyFailed': 'Could not copy prompt to clipboard.',
  'chatgpt.pasteEmpty': 'Paste ChatGPT JSON first.',
  'chatgpt.missingIdentity': 'JSON must include company_name or contact_name.',
  'chatgpt.parseFailed': 'Could not parse JSON — ask ChatGPT for a single JSON object only.',
  'chatgpt.importFailed': 'Could not load lead data.',

  'empty.select': 'Select a lead or add a new one.',
  'empty.selectLead': 'Select a lead or add a new one.',
  'empty.loading': 'Loading leads…',
  'empty.none': 'No leads yet. Add a potential client to start the pipeline.',
  'error.loadLeads': 'Failed to load leads.',
  'error.ownerSchemaMissing':
    'Shared “Added by” is not fully set up yet. In Supabase → SQL Editor, paste and Run the owner-snapshot migration SQL, then hard-refresh this page. Until then only the person who added a lead can see their own name.',
  'error.clientLocaleSchemaMissing':
    'Client local time & weather columns are missing in the database. In Supabase → SQL Editor, paste and Run crm_lead_client_locale_migration.sql, then hard-refresh. City/timezone edits will not persist until that migration runs.',
  'error.linksSchemaMissing':
    'Extra named links will not save until you run crm_lead_links_migration.sql in Supabase → SQL Editor, then hard-refresh.',
  'error.valueEmojiSchemaMissing':
    'Value emoticons will not save until you run crm_lead_value_emoji_migration.sql in Supabase → SQL Editor, then hard-refresh.',
  'error.emailsSchemaMissing':
    'Department emails will not save until you run crm_lead_emails_migration.sql in Supabase → SQL Editor, then hard-refresh.',
  'error.atlasEvalSchemaMissing':
    'Atlas Evaluation will not save until you run crm_lead_atlas_eval_migration.sql in Supabase → SQL Editor, then hard-refresh.',
  'error.outreachSchemaMissing':
    'Initial email columns are missing in Supabase — outreach drafts from imports will not appear until migration is applied.',
  'detail.healFailed':
    'Could not save your name on this lead for the team. Ask an admin to run the CRM owner snapshot SQL migration in Supabase.',

  'login.kicker': 'Client Login',
  'login.title': 'IOM CRM',
  'login.blurb': 'Sign in to manage leads, pipeline stages, and communication history.',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.signingIn': 'Signing in…',
  'login.failed': 'Sign-in failed.',
  'login.modeOnline':
    'Online storage via Supabase — all signed-in staff share the same leads.',
  'login.modeLocal':
    'Local mode — data stays in this browser until Supabase env vars are set.',
  'login.tryDemo': 'Try CRM demo (no login)',
  'login.tryDemoHint': 'Sample data only — nothing saves to the live CRM.',

  'demo.badge': 'DEMO',
  'demo.kicker': 'CRM Demo',
  'demo.banner':
    'Interactive sample workspace with fictional companies. Edits stay in this browser tab and never touch live client data.',
  'demo.reset': 'Reset sample data',
  'demo.exit': 'Exit demo',

  'status.new': 'New',
  'status.contacted': 'Contacted',
  'status.qualified': 'Qualified',
  'status.proposal': 'Proposal',
  'status.negotiation': 'Negotiation',
  'status.closed_won': 'Closed Won',
  'status.closed_lost': 'Closed Lost',

  'temp.hot': 'Hot',
  'temp.warm': 'Warm',
  'temp.cold': 'Cold',

  'activity.call': 'Call',
  'activity.email': 'Email',
  'activity.meeting': 'Meeting',
  'activity.note': 'Note',
  'activity.task': 'Task',

  'list.untitled': 'Untitled',
  'list.followUp': 'Follow-up',
  'list.addedBy': 'Added by',
  'list.valueFromHeart': 'From the heart',
  'list.valueNoCharge': 'No charge',
  'list.unknownOwner': 'Unknown',
  'list.noOwner': 'No attribution',

  'detail.kicker': 'Lead',
  'detail.untitled': 'Untitled company',
  'detail.edit': 'Edit',
  'detail.delete': 'Delete',
  'detail.editTitle': 'Edit lead',
  'detail.addedBy': 'Added by',
  'detail.claimOwner': 'I added this',
  'detail.claiming': 'Saving…',
  'detail.claimHint':
    'Who added this lead is missing. If you added it, claim attribution so the team can see your name.',
  'detail.claimConfirm':
    'Set yourself as the person who added this lead?',
  'detail.claimFailed': 'Could not claim this lead.',
  'detail.contact': 'Contact',
  'detail.email': 'Email',
  'detail.emails': 'Department emails',
  'detail.phone': 'Phone',
  'detail.website': 'Website',
  'detail.links': 'Links',
  'detail.followUp': 'Next follow-up',
  'detail.value': 'Estimated value',
  'detail.valueFromHeart': 'From the heart',
  'detail.valueNoCharge': 'No charge',
  'detail.created': 'Created',
  'detail.updated': 'Last updated',
  'detail.offer': 'What to offer',
  'detail.offerEmpty': 'No offer notes yet.',
  'detail.notes': 'Internal notes',
  'detail.projects': 'Projects',
  'detail.projectsBlurb':
    'Send a won or ready lead into project management to track delivery on a shared board.',
  'detail.sendToProjects': 'Send to project management',
  'detail.sendFailed': 'Could not create project from this lead.',
  'detail.openIdeas': 'Open ideas board',
  'detail.deleteConfirm': 'Delete lead “{name}”?',
  'detail.deleteFailed': 'Delete failed.',
  'detail.copyAsText': 'Copy as text',
  'detail.copying': 'Copying…',
  'detail.copied': 'Copied!',
  'detail.copyFailed': 'Could not copy to clipboard.',
  'detail.collapse': 'Collapse',
  'detail.expand': 'Expand',
  'detail.collapseAria': 'Collapse lead detail',
  'detail.expandAria': 'Expand lead detail',

  'locale.title': 'Client local time & weather',
  'locale.blurb': 'Live clock and conditions where this client is.',
  'locale.empty': 'Add a city and timezone when editing this lead.',
  'locale.schemaMissing':
    'Database columns for city/timezone are missing. Paste and run crm_lead_client_locale_migration.sql in Supabase SQL Editor, then refresh.',
  'locale.localTime': 'Client local time',
  'locale.noTimezone': 'No timezone set',
  'locale.weather': 'Weather',
  'locale.weatherLoading': 'Loading weather…',
  'locale.weatherError': 'Weather unavailable',
  'locale.weatherNeedPlace': 'Add a city to load weather',
  'locale.sunrise': 'Sunrise',
  'locale.sunset': 'Sunset',
  'locale.moonPhase': 'Moon',
  'locale.moon.new': 'New',
  'locale.moon.waxingCrescent': 'Waxing Crescent',
  'locale.moon.firstQuarter': 'First Quarter',
  'locale.moon.waxingGibbous': 'Waxing Gibbous',
  'locale.moon.full': 'Full',
  'locale.moon.waningGibbous': 'Waning Gibbous',
  'locale.moon.lastQuarter': 'Last Quarter',
  'locale.moon.waningCrescent': 'Waning Crescent',
  'locale.clockShort': 'Local',
  'locale.wx.clear': 'Clear',
  'locale.wx.mainlyClear': 'Mostly clear',
  'locale.wx.partlyCloudy': 'Partly cloudy',
  'locale.wx.overcast': 'Overcast',
  'locale.wx.fog': 'Fog',
  'locale.wx.drizzle': 'Drizzle',
  'locale.wx.rain': 'Rain',
  'locale.wx.snow': 'Snow',
  'locale.wx.showers': 'Showers',
  'locale.wx.snowShowers': 'Snow showers',
  'locale.wx.thunderstorm': 'Thunderstorm',
  'locale.wx.unknown': '—',

  'nav.aria': 'CRM sections',
  'nav.leads': 'Leads',
  'nav.projects': 'Projects',
  'nav.time': 'Time',
  'nav.ideas': 'Ideas',

  'music.aria': 'Music player',
  'music.play': 'Play',
  'music.pause': 'Pause',
  'music.prev': 'Previous track',
  'music.next': 'Next track',
  'music.nowPlaying': 'Now playing',
  'music.idle': 'Soundscapes',
  'music.volume': 'Volume',
  'music.vol': 'Vol',

  'proj.kicker': 'Project board',
  'proj.create': '+ New project',
  'proj.newPlaceholder': 'Project name…',
  'proj.loading': 'Loading projects…',
  'proj.empty': 'No projects yet. Create one or send a lead here.',
  'proj.select': 'Select a project or create a new one.',
  'proj.loadFailed': 'Failed to load projects.',
  'proj.createFailed': 'Could not create project.',
  'proj.deleteFailed': 'Could not delete project.',
  'proj.deleteConfirm': 'Delete project “{name}” and its tasks?',
  'proj.fromLead': 'from lead',
  'proj.standalone': 'Standalone',
  'proj.status': 'Project status',
  'proj.openTime': 'Time',
  'proj.openIdeas': 'Ideas',
  'proj.addColumn': '+ Column',
  'proj.columnPrompt': 'Column name',
  'proj.taskPlaceholder': 'New task…',
  'proj.taskFailed': 'Task update failed.',
  'proj.move': 'Move to column',
  'proj.editTask': 'Edit task',
  'proj.taskTitle': 'Title',
  'proj.priority': 'Priority',
  'proj.due': 'Due date',
  'proj.assignee': 'Assignee',
  'proj.unassigned': 'Unassigned',
  'proj.column': 'Column',
  'proj.deleteTaskConfirm': 'Delete this task?',
  'proj.collapse': 'Collapse',
  'proj.expand': 'Expand',
  'proj.collapseAria': 'Collapse project board',
  'proj.expandAria': 'Expand project board',
  'proj.taskCount': '{count} tasks',
  'proj.columnCount': '{count} columns',

  'projStatus.planned': 'Planned',
  'projStatus.active': 'Active',
  'projStatus.on_hold': 'On hold',
  'projStatus.completed': 'Completed',
  'projStatus.cancelled': 'Cancelled',

  'prio.low': 'Low',
  'prio.medium': 'Medium',
  'prio.high': 'High',
  'prio.urgent': 'Urgent',

  'time.timerTitle': 'Timer',
  'time.timerBlurb': 'Start a timer on a project, or use task timers on the Projects board.',
  'time.start': 'Start',
  'time.stop': 'Stop',
  'time.noProject': 'No project',
  'time.notesPlaceholder': 'What are you working on?',
  'time.manualTitle': 'Manual entry',
  'time.hours': 'Hours',
  'time.addManual': 'Add time',
  'time.reports': 'Reports',
  'time.byProject': 'By project',
  'time.byUser': 'By user',
  'time.byDay': 'By day',
  'time.noReport': 'No completed time yet.',
  'time.entries': 'Recent entries',
  'time.loading': 'Loading time…',
  'time.empty': 'No time logged yet.',
  'time.loadFailed': 'Failed to load time entries.',
  'time.timerFailed': 'Timer action failed.',
  'time.manualFailed': 'Could not add manual entry.',
  'time.invalidHours': 'Enter a positive number of hours.',
  'time.deleteConfirm': 'Delete this time entry?',

  'ideas.kicker': 'Idea board',
  'ideas.create': '+ New map',
  'ideas.newPlaceholder': 'Mind map title…',
  'ideas.linkLead': 'Link to lead',
  'ideas.linkProject': 'Link to project',
  'ideas.noLead': 'No lead link',
  'ideas.noProject': 'No project link',
  'ideas.loading': 'Loading ideas…',
  'ideas.empty': 'No mind maps yet. Create a standalone board or link one to a lead/project.',
  'ideas.select': 'Select a mind map or create one.',
  'ideas.loadFailed': 'Failed to load mind maps.',
  'ideas.createFailed': 'Could not create mind map.',
  'ideas.untitled': 'Untitled ideas',
  'ideas.linkedLead': 'Linked to lead',
  'ideas.linkedProject': 'Linked to project',
  'ideas.standalone': 'Standalone',
  'ideas.addChild': 'Add child',
  'ideas.addSibling': 'Add sibling',
  'ideas.newNode': 'New idea',
  'ideas.deleteConfirm': 'Delete mind map “{name}”?',
  'ideas.deleteNodeConfirm': 'Delete this idea and its children?',
  'ideas.deleteNode': 'Delete idea',
  'ideas.shortcutsHint': 'Tab = child · Enter = sibling · click to select · double-click to edit',
  'ideas.toolbar': 'Topic tools',
  'ideas.styleColor': 'Color',
  'ideas.colorDefault': 'Default',
  'ideas.bold': 'Bold',
  'ideas.italic': 'Italic',
  'ideas.link': 'Link',
  'ideas.linkPlaceholder': 'https://…',
  'ideas.note': 'Note',
  'ideas.notePlaceholder': 'Note or comment…',
  'ideas.save': 'Save',
  'ideas.saveFailed': 'Could not save topic.',
  'ideas.styleSchemaMissing':
    'Color, link, and emphasis need a database update. In Supabase → SQL Editor, paste and Run crm_mind_node_style_migration.sql, then hard-refresh.',

  'form.company': 'Company / account',
  'form.website': 'Website',
  'form.linksSection': 'Additional links',
  'form.linksHint':
    'Optional named links (composer site, portfolio, social…). Empty rows are ignored on save.',
  'form.linksEmpty': 'No extra links yet.',
  'form.linkLabel': 'Name',
  'form.linkLabelPlaceholder': 'e.g. Music composer',
  'form.linkUrl': 'URL',
  'form.linkUrlPlaceholder': 'https://',
  'form.linkAdd': '+ Add link',
  'form.linkRemove': 'Remove',
  'form.linkUrlRequired': 'Each link needs a URL (or clear the row).',
  'form.linkUrlInvalid': 'Enter a valid http(s) URL for each link.',
  'form.contact': 'Contact name',
  'form.contactRole': 'Contact role',
  'form.contactRolePlaceholder': 'e.g. Creative Director',
  'form.email': 'Email (primary)',
  'form.emailsSection': 'Department emails',
  'form.emailsHint':
    'Optional labeled emails (Sales, New Business, General…). Empty rows are ignored on save. Primary email stays above.',
  'form.emailsEmpty': 'No department emails yet.',
  'form.emailLabel': 'Department / label',
  'form.emailLabelPlaceholder': 'e.g. Sales',
  'form.emailAddress': 'Email',
  'form.emailAddressPlaceholder': 'name@company.com',
  'form.emailAdd': '+ Add email',
  'form.emailRemove': 'Remove',
  'form.emailInvalid': 'Enter a valid email for each department row.',
  'form.phone': 'Phone',

  'atlas.title': 'Atlas Evaluation',
  'atlas.principle':
    'Don’t only ask “Can they hire us?” — also “Are these our people?”',
  'atlas.principleNote':
    'Long-term creative and philosophical alignment often matters more than a short-term budget fit.',
  'atlas.criteria': 'Criteria',
  'atlas.priority': 'Priority hint:',
  'atlas.can_hire_us': 'Can Hire Us',
  'atlas.can_hire_us.hint': 'Commercial hire / collaboration likelihood',
  'atlas.thinks_like_us': 'Thinks Like Us',
  'atlas.thinks_like_us.hint': 'Creative / philosophical alignment',
  'atlas.commercial_potential': 'Commercial Potential',
  'atlas.creative_compatibility': 'Creative Compatibility',
  'atlas.technical_compatibility': 'Technical Compatibility',
  'atlas.relationship_potential': 'Relationship Potential',
  'atlas.strategic_value': 'Strategic Value',
  'atlas.priority5': 'High-priority relationship — invest early and stay close.',
  'atlas.priority4': 'Very good match — prioritize thoughtful outreach.',
  'atlas.priority3': 'Interesting connection — worth exploring carefully.',
  'atlas.priority2': 'Research / inspiration — learn from them without forcing a deal.',
  'atlas.priority1': 'Low priority — keep on the map, don’t overinvest.',
  'form.value': 'Estimated value',
  'form.valueOptionalHint': 'Optional — leave empty for pro-bono',
  'form.valueEmoji': 'Value tag',
  'form.valueEmojiNone': 'None',
  'form.valueEmojiHeart': 'From the heart',
  'form.valueEmojiGift': 'Gift / free',
  'form.valueEmojiPartner': 'Partnership',
  'form.valueEmojiStar': 'Priority',
  'form.valueEmojiHeartHint':
    'Value may be empty or €0 — the heart shows this is from the heart / no charge.',
  'form.temperature': 'Temperature',
  'form.stage': 'Pipeline stage',
  'form.followUp': 'Next follow-up',
  'form.offer': 'What to offer',
  'form.offerPlaceholder': 'Product, package, or pitch for this lead',
  'form.outreachSection': 'Initial outreach email',
  'form.outreachHint':
    'Draft the first email you plan to send. Saved with the lead so you can copy it, open in your mail app, or mark as sent later.',
  'form.companyFocus': 'What the company does',
  'form.companyFocusPlaceholder': 'Brief context — their product, audience, or why you reached out',
  'form.initialEmailSubjectPlaceholder': 'e.g. Interactive 360° tour for your trade booth',
  'form.initialEmailBodyPlaceholder':
    'Write the full email here — greeting, pitch, and sign-off. You can refine it on the lead detail page later.',
  'form.notes': 'Internal notes',
  'form.localeSection': 'Client location & timezone',
  'form.localeHint':
    'Search and pick a city to auto-fill country, timezone, and coordinates for the live clock and weather.',
  'form.city': 'City',
  'form.cityPlaceholder': 'e.g. Belgrade',
  'form.citySearchPlaceholder': 'Type to search cities…',
  'form.citySearching': 'Searching cities…',
  'form.cityNoResults': 'No cities found. Try another spelling.',
  'form.cityClear': 'Clear city and location fields',
  'form.citySuggestions': 'City suggestions',
  'form.country': 'Country',
  'form.countryPlaceholder': 'e.g. Serbia',
  'form.timezone': 'Timezone (IANA)',
  'form.timezonePlaceholder': 'Europe/Belgrade',
  'form.timezoneInvalid': 'Pick a valid IANA timezone (e.g. Europe/Belgrade).',
  'form.cancel': 'Cancel',
  'form.save': 'Save lead',
  'form.add': 'Add lead',
  'form.saving': 'Saving…',
  'form.saveFailed': 'Save failed.',

  'act.title': 'Communication log',
  'act.blurb':
    'Log calls, emails, meetings, and notes — Salesforce-style relationship history.',
  'act.type': 'Type',
  'act.subject': 'Subject',
  'act.subjectPlaceholder': 'e.g. Intro call — discussed 360 tour package',
  'act.details': 'Details',
  'act.log': 'Log activity',
  'act.logging': 'Logging…',
  'act.loading': 'Loading history…',
  'act.empty': 'No activities yet. Log the first touchpoint above.',
  'act.delete': 'Delete',
  'act.deleteConfirm': 'Delete this activity?',
  'act.loadFailed': 'Failed to load activities.',
  'act.logFailed': 'Failed to log activity.',
  'act.deleteFailed': 'Delete failed.',
  'act.edit': 'Edit',
  'act.save': 'Save changes',
  'act.saving': 'Saving…',
  'act.cancel': 'Cancel',
  'act.when': 'When',
  'act.editFailed': 'Could not update activity.',

  'outreach.title': 'Initial outreach email',
  'outreach.subject': 'Subject',
  'outreach.body': 'Body',
  'outreach.contactRole': 'Contact role',
  'outreach.companyFocus': 'Company focus',
  'outreach.pendingAlert': 'Initial email drafted but not marked as sent yet.',
  'outreach.badgePending': 'Email pending',
  'outreach.badgeSent': 'Email sent',
  'outreach.badgeSentAt': 'Initial outreach marked sent · {date}',
  'outreach.statusNone': 'No draft',
  'outreach.statusPending': 'Ready to send',
  'outreach.statusDrafted': 'Marked drafted',
  'outreach.statusSent': 'Sent',
  'outreach.copyEmail': 'Copy email',
  'outreach.openMail': 'Open in mail app',
  'outreach.markDrafted': 'Mark drafted',
  'outreach.markSent': 'Mark as sent',
  'outreach.sentConfirm': 'Mark initial outreach as sent? This logs an email activity and moves New leads to Contacted.',
  'outreach.draftedAt': 'Marked drafted',
  'outreach.sentAt': 'Marked sent',
  'outreach.addDraft': 'Add email draft',
  'outreach.saveDraft': 'Save draft',
  'outreach.saveFailed': 'Could not save email draft.',
  'outreach.markFailed': 'Could not update outreach status.',
  'outreach.defaultActivitySubject': 'Initial outreach email sent',
  'outreach.sentActivityBody': 'Marked initial outreach email as sent from CRM.',

  'profile.title': 'Your profile photo',
  'profile.photo': 'Your photo',
  'profile.yourPhoto': 'Your photo',
  'profile.menuAria': 'Profile photo',
  'profile.upload': 'Upload photo',
  'profile.change': 'Change photo',
  'profile.remove': 'Remove',
  'profile.hint': 'JPG, PNG, WebP or GIF · crop & compress before upload (max 12 MB source)',
  'profile.uploadFailed': 'Upload failed.',
  'profile.removeFailed': 'Could not remove photo.',
  'profile.invalidImage': 'Please choose an image file.',
  'profile.tooLarge': 'Image must be under 12 MB before crop.',

  'crop.title': 'Crop profile photo',
  'crop.hint': 'Drag to position · zoom to frame · saved as a compressed circle',
  'crop.zoom': 'Zoom',
  'crop.cancel': 'Cancel',
  'crop.save': 'Save photo',
  'crop.saving': 'Saving…',
  'crop.failed': 'Could not process image.',

  'guide.kicker': 'Welcome',
  'guide.title': 'IOM Client CRM',
  'guide.close': 'Close guide',
  'guide.gotIt': 'Got it',
  'guide.whatHeading': 'What this tool is',
  'guide.whatText':
    'Your private IOM workspace — leads and pipeline, Monday-style project boards, Clockify-style time tracking, and MindMeister-style idea maps. In online mode, signed-in staff share the same data.',
  'guide.what1': 'Leads — companies to pitch, Hot / Warm / Cold, pipeline stages, activity log',
  'guide.what2': 'Projects — kanban boards with columns and tasks for delivery',
  'guide.what3': 'Time — start/stop timers, manual entries, and reports',
  'guide.what4': 'Ideas — mind maps standalone or linked to a lead / project',
  'guide.navHeading': 'Navigation',
  'guide.navText': 'Tabs under the header switch tools: Leads | Projects | Time | Ideas.',
  'guide.nav1': 'Leads — Salesforce-style CRM for potential clients',
  'guide.nav2': 'Projects — Monday-style boards for delivery work',
  'guide.nav3': 'Time — Clockify-style timers, logs, and reports',
  'guide.nav4': 'Ideas — MindMeister-style maps for brainstorming',
  'guide.leadHeading': 'Leads — what is a lead?',
  'guide.leadText':
    'A lead is a potential client or contact you are trying to win — not a closed deal yet.',
  'guide.lead1': 'One record per company or opportunity you want to pursue',
  'guide.lead2': 'Holds contact details, what you plan to offer, stage, and temperature',
  'guide.lead3': 'Open leads stay in your pipeline until Closed Won or Closed Lost',
  'guide.pipelineHeading': 'What is a pipeline?',
  'guide.pipelineText':
    'The pipeline is the path a lead takes through sales stages, from first entry to a closed outcome.',
  'guide.pipeline1':
    'Stages: New → Contacted → Qualified → Proposal → Negotiation → Closed Won / Lost',
  'guide.pipeline2': 'Update the stage as the deal moves so the list matches reality',
  'guide.pipeline3':
    'Stage = how far the deal has progressed (separate from Hot / Warm / Cold)',
  'guide.tempHeading': 'Hot / Warm / Cold',
  'guide.tempText':
    'Temperature is your priority signal — how interested or urgent a lead feels right now.',
  'guide.temp1': 'Hot — high interest or urgency; follow up soon',
  'guide.temp2': 'Warm — active opportunity; keep nurturing',
  'guide.temp3': 'Cold — low interest or on hold; revisit later',
  'guide.temp4':
    'Temperature is not the same as stage: a lead can be Hot at New, or Cold in Negotiation',
  'guide.fieldsHeading': 'Lead fields',
  'guide.fields1':
    'Contact: company name, website, contact person, email, and phone',
  'guide.fields2':
    'What to offer — product, package, or pitch for this lead',
  'guide.fields3':
    'Optional: next follow-up date and estimated deal value for planning',
  'guide.startHeading': 'Getting started with leads',
  'guide.start1': 'Click + Add lead to create a potential client',
  'guide.start2': 'Fill the contact fields and what you plan to offer',
  'guide.start3': 'Set temperature (Hot / Warm / Cold) and starting pipeline stage',
  'guide.start4': 'Optional: next follow-up date and estimated value',
  'guide.pipeHeading': 'Working the pipeline',
  'guide.pipe1': 'Select a lead in the left list to open its detail panel',
  'guide.pipe2':
    'Update stage as you progress: New → Contacted → Qualified → Proposal → Negotiation → Closed Won / Lost',
  'guide.pipe3': 'Change Hot / Warm / Cold anytime as interest shifts',
  'guide.pipe4': 'Edit details, offer text, and notes as conversations evolve',
  'guide.commHeading': 'Activity log',
  'guide.comm1':
    'On a lead, log a Call, Email, Meeting, Note, or Task in the activity panel',
  'guide.comm2': 'Add a short subject and optional body so the timeline stays useful',
  'guide.comm3': 'Review past activity on the same lead before your next outreach',
  'guide.findHeading': 'Search & filters',
  'guide.find1': 'Search by company, contact, or email in the top bar',
  'guide.find2':
    'Filter by pipeline stage, temperature (Hot / Warm / Cold), and who added the lead',
  'guide.find3':
    'Sort by last updated, who added, or pipeline stage; stats show counts for the current filters',
  'guide.projectsHeading': 'Projects',
  'guide.projectsText':
    'Monday-style boards for delivery — columns, tasks, and project status.',
  'guide.projects1':
    'Create a standalone project with + New project on the Projects tab',
  'guide.projects2':
    'From a lead, use Send to project management to open a linked board for delivery',
  'guide.projects3':
    'Add columns (+ Column), create tasks under each column, and move tasks between columns as work progresses',
  'guide.projects4':
    'Set status in the board header: Planned / Active / On hold / Completed / Cancelled',
  'guide.projects5':
    'From the board toolbar, jump to Time or Ideas for that project',
  'guide.timeHeading': 'Time',
  'guide.timeText':
    'Clockify-style time tracking for projects and tasks.',
  'guide.time1':
    'On the Time tab, start/stop a timer on a project with optional notes',
  'guide.time2': 'Add a manual entry when you forgot to run the timer',
  'guide.time3': 'Reports break down completed time by project, user, and day',
  'guide.time4':
    'On a Projects board, start/stop a timer directly from a task card',
  'guide.ideasHeading': 'Ideas',
  'guide.ideasText':
    'MindMeister-style mind maps — standalone or linked to a lead or project.',
  'guide.ideas1':
    'Create a map on the Ideas tab; optionally link it to a lead and/or project',
  'guide.ideas2':
    'From a lead, Open ideas board jumps to Ideas and focuses that lead’s map',
  'guide.ideas3':
    'Build a tree: add child ideas, edit titles inline, nest as deep as you need',
  'guide.ideas4':
    'In online mode, maps are shared with all signed-in staff — the team sees the same boards',
  'guide.photoHeading': 'Profile photo',
  'guide.photo1': 'Click your avatar or email in the top bar to open your photo menu',
  'guide.photo2':
    'Crop to a circle, compress, then upload, change, or remove your staff profile picture',
  'guide.photo3':
    'Your photo appears next to leads you add; updating it refreshes your existing leads',
  'guide.uiHeading': 'Help & language',
  'guide.ui1':
    'Help (header, next to Sign out) reopens this guide anytime',
  'guide.ui2': 'Flag button switches the whole CRM between English and Serbian',
  'guide.hint':
    'Tabs: Leads · Projects · Time · Ideas. Reopen this guide with Help. Flag = English ↔ Serbian.',
}

const sr: Dict = {
  'boot.loading': 'Učitavanje…',
  'topbar.kicker': 'Klijentska prijava',
  'topbar.title': 'CRM potencijalnih klijenata',
  'topbar.online': 'Online',
  'topbar.local': 'Lokalno',
  'topbar.demo': 'Demo',
  'topbar.help': 'Pomoć',
  'topbar.helpAria': 'Otvori CRM vodič',
  'topbar.helpTitle': 'Kako koristiti IOM CRM',
  'topbar.signOut': 'Odjava',
  'topbar.langEn': 'Engleski',
  'topbar.langSr': 'Srpski',
  'topbar.langDe': 'Nemački',
  'topbar.langNl': 'Holandski',
  'topbar.langFr': 'Francuski',
  'topbar.langIt': 'Italijanski',
  'topbar.langToggle': 'Promeni jezik',
  'topbar.langAria': 'Promeni jezik',
  'topbar.langToSr': 'Prebaci na srpski',
  'topbar.langToEn': 'Prebaci na engleski',
  'topbar.site': '← IOM sajt',
  'topbar.backSite': '← IOM sajt',

  'stats.visible': 'Vidljivi leadovi',
  'stats.open': 'Otvoreni pipeline',
  'stats.hot': 'Vrući leadovi',

  'calendar.title': 'Kalendar follow-up-a',
  'calendar.expand': 'Proširi kalendar follow-up-a',
  'calendar.collapse': 'Smanji kalendar follow-up-a',
  'calendar.prev': 'Prethodni mesec',
  'calendar.next': 'Sledeći mesec',
  'calendar.day': 'Dan {day}',
  'calendar.dayWithFollowUps': 'Dan {day}, {count} follow-up(a)',
  'calendar.clearFilter': 'Ukloni filter datuma',

  'toolbar.search': 'Pretraga firme, kontakta, emaila…',
  'toolbar.allStages': 'Sve faze',
  'toolbar.allTemps': 'Sve temperature',
  'toolbar.allOwners': 'Svi koji su dodali',
  'toolbar.stageFilter': 'Filter po fazi pipeline-a',
  'toolbar.tempFilter': 'Filter po temperaturi',
  'toolbar.ownerFilter': 'Filter po tome ko je dodao',
  'toolbar.sort': 'Sortiranje leadova',
  'toolbar.sortUpdated': 'Sort: poslednja izmena',
  'toolbar.sortOwner': 'Sort: ko je dodao',
  'toolbar.sortStatus': 'Sort: faza pipeline-a',
  'toolbar.addLead': '+ Dodaj lead',
  'toolbar.backList': 'Nazad na listu',
  'toolbar.backToList': 'Nazad na listu',

  'create.title': 'Dodaj potencijalnog klijenta',

  'chatgpt.title': 'ChatGPT pomoć za lead',
  'chatgpt.blurb':
    'Kopirajte prompt u ChatGPT, nalepite JSON odgovor nazad i učitajte formu jednim klikom.',
  'chatgpt.copyPrompt': 'Kopiraj ChatGPT prompt',
  'chatgpt.step1': 'Kopirajte prompt u ChatGPT (u poruci dodajte naziv firme ili URL).',
  'chatgpt.step2': 'Zatražite od ChatGPT-a da vrati samo JSON objekat.',
  'chatgpt.step3': 'Nalepite JSON ispod i kliknite Učitaj u formu — proverite, pa sačuvajte.',
  'chatgpt.pasteLabel': 'Nalepi ChatGPT JSON',
  'chatgpt.pastePlaceholder': 'Nalepite JSON od ChatGPT-a ovde (sa ili bez ```json)…',
  'chatgpt.loadIntoForm': 'Učitaj u formu',
  'chatgpt.loadSuccess': 'Polja leada učitana — proverite i sačuvajte.',
  'chatgpt.copyFailed': 'Kopiranje prompta nije uspelo.',
  'chatgpt.pasteEmpty': 'Prvo nalepite ChatGPT JSON.',
  'chatgpt.missingIdentity': 'JSON mora sadržati company_name ili contact_name.',
  'chatgpt.parseFailed': 'JSON nije moguće parsirati — tražite od ChatGPT-a samo JSON objekat.',
  'chatgpt.importFailed': 'Učitavanje podataka leada nije uspelo.',

  'empty.select': 'Izaberite lead ili dodajte novi.',
  'empty.selectLead': 'Izaberite lead ili dodajte novi.',
  'empty.loading': 'Učitavanje leadova…',
  'empty.none': 'Još nema leadova. Dodajte potencijalnog klijenta da počnete.',
  'error.loadLeads': 'Učitavanje leadova nije uspelo.',
  'error.ownerSchemaMissing':
    'Deljeno „Dodao/la“ još nije potpuno podešeno. U Supabase → SQL Editor nalepite i pokrenite owner-snapshot migracioni SQL, pa hard-refresh stranice. Do tada samo osoba koja je dodala lead vidi svoje ime.',
  'error.clientLocaleSchemaMissing':
    'Kolone za lokalno vreme i prognozu klijenta nedostaju u bazi. U Supabase → SQL Editor nalepite i pokrenite crm_lead_client_locale_migration.sql, pa hard-refresh. Grad/vremenska zona se neće sačuvati dok migracija ne bude pokrenuta.',
  'error.linksSchemaMissing':
    'Dodatni linkovi se neće sačuvati dok ne pokrenete crm_lead_links_migration.sql u Supabase → SQL Editor, pa hard-refresh.',
  'error.valueEmojiSchemaMissing':
    'Emotikoni za vrednost se neće sačuvati dok ne pokrenete crm_lead_value_emoji_migration.sql u Supabase → SQL Editor, pa hard-refresh.',
  'error.emailsSchemaMissing':
    'Emailovi po odeljenju se neće sačuvati dok ne pokrenete crm_lead_emails_migration.sql u Supabase → SQL Editor, pa hard-refresh.',
  'error.atlasEvalSchemaMissing':
    'Atlas Evaluation se neće sačuvati dok ne pokrenete crm_lead_atlas_eval_migration.sql u Supabase → SQL Editor, pa hard-refresh.',
  'error.outreachSchemaMissing':
    'Kolone za inicijalni email nedostaju u Supabase — draftovi iz importa neće biti vidljivi dok se migracija ne primeni.',
  'detail.healFailed':
    'Nije moguće sačuvati vaše ime na ovom leadu za tim. Tražite od admina da pokrene CRM owner snapshot SQL migraciju u Supabase-u.',

  'login.kicker': 'Klijentska prijava',
  'login.title': 'IOM CRM',
  'login.blurb':
    'Prijavite se da upravljate leadovima, fazama pipeline-a i istorijom komunikacije.',
  'login.email': 'Email',
  'login.password': 'Lozinka',
  'login.submit': 'Prijava',
  'login.signingIn': 'Prijava…',
  'login.failed': 'Prijava nije uspela.',
  'login.modeOnline':
    'Online skladište preko Supabase — svi prijavljeni članovi tima dele iste leadove.',
  'login.modeLocal':
    'Lokalni režim — podaci ostaju u ovom pregledaču dok se ne podese Supabase env varijable.',
  'login.tryDemo': 'Isprobaj CRM demo (bez prijave)',
  'login.tryDemoHint': 'Samo uzorci — ništa se ne čuva u živom CRM-u.',

  'demo.badge': 'DEMO',
  'demo.kicker': 'CRM demo',
  'demo.banner':
    'Interaktivni uzorak sa izmišljenim firmama. Izmene ostaju u ovom tabu i nikad ne diraju žive klijentske podatke.',
  'demo.reset': 'Resetuj uzorke',
  'demo.exit': 'Izađi iz dema',

  'status.new': 'Novi',
  'status.contacted': 'Kontaktiran',
  'status.qualified': 'Kvalifikovan',
  'status.proposal': 'Ponuda',
  'status.negotiation': 'Pregovori',
  'status.closed_won': 'Dobijen',
  'status.closed_lost': 'Izgubljen',

  'temp.hot': 'Vruć',
  'temp.warm': 'Topao',
  'temp.cold': 'Hladan',

  'activity.call': 'Poziv',
  'activity.email': 'Email',
  'activity.meeting': 'Sastanak',
  'activity.note': 'Beleška',
  'activity.task': 'Zadatak',

  'list.untitled': 'Bez naziva',
  'list.followUp': 'Follow-up',
  'list.addedBy': 'Dodao/la',
  'list.valueFromHeart': 'Od srca',
  'list.valueNoCharge': 'Bez naplate',
  'list.unknownOwner': 'Nepoznato',
  'list.noOwner': 'Bez atribucije',

  'detail.kicker': 'Lead',
  'detail.untitled': 'Firma bez naziva',
  'detail.edit': 'Izmeni',
  'detail.delete': 'Obriši',
  'detail.editTitle': 'Izmeni lead',
  'detail.addedBy': 'Dodao/la',
  'detail.claimOwner': 'Ja sam dodao/la',
  'detail.claiming': 'Čuvam…',
  'detail.claimHint':
    'Nedostaje ko je dodao ovaj lead. Ako si ti, preuzmi atribuciju da tim vidi tvoje ime.',
  'detail.claimConfirm':
    'Postaviti tebe kao osobu koja je dodala ovaj lead?',
  'detail.claimFailed': 'Preuzimanje leada nije uspelo.',
  'detail.contact': 'Kontakt',
  'detail.email': 'Email',
  'detail.emails': 'Emailovi po odeljenju',
  'detail.phone': 'Telefon',
  'detail.website': 'Sajt',
  'detail.links': 'Linkovi',
  'detail.followUp': 'Sledeći follow-up',
  'detail.value': 'Procenjena vrednost',
  'detail.valueFromHeart': 'Od srca',
  'detail.valueNoCharge': 'Bez naplate',
  'detail.created': 'Kreirano',
  'detail.updated': 'Poslednja izmena',
  'detail.offer': 'Šta ponuditi',
  'detail.offerEmpty': 'Još nema beleški o ponudi.',
  'detail.notes': 'Interne beleške',
  'detail.projects': 'Projekti',
  'detail.projectsBlurb':
    'Pošaljite dobijen ili spreman lead u upravljanje projektima da pratite isporuku na zajedničkoj tabli.',
  'detail.sendToProjects': 'Pošalji u upravljanje projektima',
  'detail.sendFailed': 'Nije moguće kreirati projekat od ovog leada.',
  'detail.openIdeas': 'Otvori tablu ideja',
  'detail.deleteConfirm': 'Obrisati lead „{name}”?',
  'detail.deleteFailed': 'Brisanje nije uspelo.',
  'detail.copyAsText': 'Kopiraj kao tekst',
  'detail.copying': 'Kopiram…',
  'detail.copied': 'Kopirano!',
  'detail.copyFailed': 'Kopiranje u clipboard nije uspelo.',
  'detail.collapse': 'Skupi',
  'detail.expand': 'Proširi',
  'detail.collapseAria': 'Skupi detalje leada',
  'detail.expandAria': 'Proširi detalje leada',

  'locale.title': 'Lokalni sat i vremenska prognoza',
  'locale.blurb': 'Živi sat i uslovi tamo gde je klijent.',
  'locale.empty': 'Dodajte grad i vremensku zonu pri izmeni leada.',
  'locale.schemaMissing':
    'Kolone za grad/vremensku zonu nedostaju u bazi. Nalepite i pokrenite crm_lead_client_locale_migration.sql u Supabase SQL Editoru, pa osvežite stranicu.',
  'locale.localTime': 'Lokalno vreme klijenta',
  'locale.noTimezone': 'Vremenska zona nije postavljena',
  'locale.weather': 'Prognoza',
  'locale.weatherLoading': 'Učitavanje prognoze…',
  'locale.weatherError': 'Prognoza nije dostupna',
  'locale.weatherNeedPlace': 'Dodajte grad da učitate prognozu',
  'locale.sunrise': 'Izlazak',
  'locale.sunset': 'Zalazak',
  'locale.moonPhase': 'Mesec',
  'locale.moon.new': 'Mlađak',
  'locale.moon.waxingCrescent': 'Rastući srp',
  'locale.moon.firstQuarter': 'Prva četvrt',
  'locale.moon.waxingGibbous': 'Rastući ispupčeni',
  'locale.moon.full': 'Pun mesec',
  'locale.moon.waningGibbous': 'Opadajući ispupčeni',
  'locale.moon.lastQuarter': 'Poslednja četvrt',
  'locale.moon.waningCrescent': 'Opadajući srp',
  'locale.clockShort': 'Lokalno',
  'locale.wx.clear': 'Vedro',
  'locale.wx.mainlyClear': 'Uglavnom vedro',
  'locale.wx.partlyCloudy': 'Delimično oblačno',
  'locale.wx.overcast': 'Oblačno',
  'locale.wx.fog': 'Magla',
  'locale.wx.drizzle': 'Rominanje',
  'locale.wx.rain': 'Kiša',
  'locale.wx.snow': 'Sneg',
  'locale.wx.showers': 'Pljuskovi',
  'locale.wx.snowShowers': 'Snežni pljuskovi',
  'locale.wx.thunderstorm': 'Grmljavina',
  'locale.wx.unknown': '—',

  'nav.aria': 'CRM sekcije',
  'nav.leads': 'Leadovi',
  'nav.projects': 'Projekti',
  'nav.time': 'Vreme',
  'nav.ideas': 'Ideje',

  'music.aria': 'Muzički plejer',
  'music.play': 'Pusti',
  'music.pause': 'Pauza',
  'music.prev': 'Prethodna numera',
  'music.next': 'Sledeća numera',
  'music.nowPlaying': 'Svira',
  'music.idle': 'Zvučni pejzaži',
  'music.volume': 'Jačina zvuka',
  'music.vol': 'Vol',

  'proj.kicker': 'Tabla projekta',
  'proj.create': '+ Novi projekat',
  'proj.newPlaceholder': 'Naziv projekta…',
  'proj.loading': 'Učitavanje projekata…',
  'proj.empty': 'Još nema projekata. Kreirajte jedan ili pošaljite lead ovde.',
  'proj.select': 'Izaberite projekat ili kreirajte novi.',
  'proj.loadFailed': 'Učitavanje projekata nije uspelo.',
  'proj.createFailed': 'Kreiranje projekta nije uspelo.',
  'proj.deleteFailed': 'Brisanje projekta nije uspelo.',
  'proj.deleteConfirm': 'Obrisati projekat „{name}” i njegove zadatke?',
  'proj.fromLead': 'iz leada',
  'proj.standalone': 'Samostalno',
  'proj.status': 'Status projekta',
  'proj.openTime': 'Vreme',
  'proj.openIdeas': 'Ideje',
  'proj.addColumn': '+ Kolona',
  'proj.columnPrompt': 'Naziv kolone',
  'proj.taskPlaceholder': 'Novi zadatak…',
  'proj.taskFailed': 'Ažuriranje zadatka nije uspelo.',
  'proj.move': 'Premesti u kolonu',
  'proj.editTask': 'Izmeni zadatak',
  'proj.taskTitle': 'Naslov',
  'proj.priority': 'Prioritet',
  'proj.due': 'Rok',
  'proj.assignee': 'Dodeljeno',
  'proj.unassigned': 'Nedodeljeno',
  'proj.column': 'Kolona',
  'proj.deleteTaskConfirm': 'Obrisati ovaj zadatak?',
  'proj.collapse': 'Skupi',
  'proj.expand': 'Proširi',
  'proj.collapseAria': 'Skupi tablu projekta',
  'proj.expandAria': 'Proširi tablu projekta',
  'proj.taskCount': '{count} zadataka',
  'proj.columnCount': '{count} kolona',

  'projStatus.planned': 'Planiran',
  'projStatus.active': 'Aktivan',
  'projStatus.on_hold': 'Na čekanju',
  'projStatus.completed': 'Završen',
  'projStatus.cancelled': 'Otkazan',

  'prio.low': 'Nizak',
  'prio.medium': 'Srednji',
  'prio.high': 'Visok',
  'prio.urgent': 'Hitan',

  'time.timerTitle': 'Tajmer',
  'time.timerBlurb':
    'Pokrenite tajmer na projektu, ili koristite tajmere zadataka na tabli Projekti.',
  'time.start': 'Start',
  'time.stop': 'Stop',
  'time.noProject': 'Bez projekta',
  'time.notesPlaceholder': 'Na čemu radite?',
  'time.manualTitle': 'Ručni unos',
  'time.hours': 'Sati',
  'time.addManual': 'Dodaj vreme',
  'time.reports': 'Izveštaji',
  'time.byProject': 'Po projektu',
  'time.byUser': 'Po korisniku',
  'time.byDay': 'Po danu',
  'time.noReport': 'Još nema završenog vremena.',
  'time.entries': 'Nedavni unosi',
  'time.loading': 'Učitavanje vremena…',
  'time.empty': 'Još nema zabeleženog vremena.',
  'time.loadFailed': 'Učitavanje unosa vremena nije uspelo.',
  'time.timerFailed': 'Akcija tajmera nije uspela.',
  'time.manualFailed': 'Ručni unos nije uspeo.',
  'time.invalidHours': 'Unesite pozitivan broj sati.',
  'time.deleteConfirm': 'Obrisati ovaj unos vremena?',

  'ideas.kicker': 'Tabla ideja',
  'ideas.create': '+ Nova mapa',
  'ideas.newPlaceholder': 'Naslov mape uma…',
  'ideas.linkLead': 'Poveži sa leadom',
  'ideas.linkProject': 'Poveži sa projektom',
  'ideas.noLead': 'Bez leada',
  'ideas.noProject': 'Bez projekta',
  'ideas.loading': 'Učitavanje ideja…',
  'ideas.empty':
    'Još nema mapa uma. Kreirajte samostalnu tablu ili povežite sa leadom/projektom.',
  'ideas.select': 'Izaberite mapu uma ili kreirajte novu.',
  'ideas.loadFailed': 'Učitavanje mapa uma nije uspelo.',
  'ideas.createFailed': 'Kreiranje mape uma nije uspelo.',
  'ideas.untitled': 'Ideje bez naziva',
  'ideas.linkedLead': 'Povezano sa leadom',
  'ideas.linkedProject': 'Povezano sa projektom',
  'ideas.standalone': 'Samostalno',
  'ideas.addChild': 'Dodaj dete',
  'ideas.addSibling': 'Dodaj brata/sestru',
  'ideas.newNode': 'Nova ideja',
  'ideas.deleteConfirm': 'Obrisati mapu uma „{name}”?',
  'ideas.deleteNodeConfirm': 'Obrisati ovu ideju i njenu decu?',
  'ideas.deleteNode': 'Obriši ideju',
  'ideas.shortcutsHint': 'Tab = dete · Enter = brat/sestra · klik za izbor · dupli klik za izmenu',
  'ideas.toolbar': 'Alati teme',
  'ideas.styleColor': 'Boja',
  'ideas.colorDefault': 'Podrazumevano',
  'ideas.bold': 'Podebljano',
  'ideas.italic': 'Kurziv',
  'ideas.link': 'Link',
  'ideas.linkPlaceholder': 'https://…',
  'ideas.note': 'Beleška',
  'ideas.notePlaceholder': 'Beleška ili komentar…',
  'ideas.save': 'Sačuvaj',
  'ideas.saveFailed': 'Čuvanje teme nije uspelo.',
  'ideas.styleSchemaMissing':
    'Boja, link i naglašavanje traže ažuriranje baze. U Supabase → SQL Editor nalepite i pokrenite crm_mind_node_style_migration.sql, zatim hard-refresh.',

  'form.company': 'Firma / nalog',
  'form.website': 'Sajt',
  'form.linksSection': 'Dodatni linkovi',
  'form.linksHint':
    'Opcioni linkovi sa nazivom (sajt kompozitora, portfolio, društvene mreže…). Prazni redovi se ignorišu pri čuvanju.',
  'form.linksEmpty': 'Još nema dodatnih linkova.',
  'form.linkLabel': 'Naziv',
  'form.linkLabelPlaceholder': 'npr. Kompozitor muzike',
  'form.linkUrl': 'URL',
  'form.linkUrlPlaceholder': 'https://',
  'form.linkAdd': '+ Dodaj link',
  'form.linkRemove': 'Ukloni',
  'form.linkUrlRequired': 'Svaki link treba URL (ili obrišite red).',
  'form.linkUrlInvalid': 'Unesite ispravan http(s) URL za svaki link.',
  'form.contact': 'Ime kontakta',
  'form.contactRole': 'Uloga kontakta',
  'form.contactRolePlaceholder': 'npr. kreativni direktor',
  'form.email': 'Email (primarni)',
  'form.emailsSection': 'Emailovi po odeljenju',
  'form.emailsHint':
    'Opcioni emailovi sa oznakom (Sales, New Business, General…). Prazni redovi se ignorišu pri čuvanju. Primarni email ostaje iznad.',
  'form.emailsEmpty': 'Još nema emailova po odeljenju.',
  'form.emailLabel': 'Odeljenje / oznaka',
  'form.emailLabelPlaceholder': 'npr. Sales',
  'form.emailAddress': 'Email',
  'form.emailAddressPlaceholder': 'ime@firma.com',
  'form.emailAdd': '+ Dodaj email',
  'form.emailRemove': 'Ukloni',
  'form.emailInvalid': 'Unesite ispravan email za svaki red odeljenja.',
  'form.phone': 'Telefon',

  'atlas.title': 'Atlas Evaluation',
  'atlas.principle':
    'Ne pitajte samo „Mogu li da nas angažuju?“ — već i „Da li su ovo naši ljudi?“',
  'atlas.principleNote':
    'Dugoročno kreativno i filozofsko poklapanje često znači više od kratkoročnog budžeta.',
  'atlas.criteria': 'Kriterijumi',
  'atlas.priority': 'Hint prioriteta:',
  'atlas.can_hire_us': 'Mogu da nas angažuju',
  'atlas.can_hire_us.hint': 'Verovatnoća komercijalnog angažmana / saradnje',
  'atlas.thinks_like_us': 'Misle kao mi',
  'atlas.thinks_like_us.hint': 'Kreativno / filozofsko poklapanje',
  'atlas.commercial_potential': 'Komercijalni potencijal',
  'atlas.creative_compatibility': 'Kreativna kompatibilnost',
  'atlas.technical_compatibility': 'Tehnička kompatibilnost',
  'atlas.relationship_potential': 'Potencijal odnosa',
  'atlas.strategic_value': 'Strateška vrednost',
  'atlas.priority5': 'Odnos visokog prioriteta — investirajte rano i ostanite blizu.',
  'atlas.priority4': 'Veoma dobar match — prioritetizujte promišljen outreach.',
  'atlas.priority3': 'Zanimljiva veza — vredi pažljivo istražiti.',
  'atlas.priority2': 'Istraživanje / inspiracija — učite od njih bez forsiranja dogovora.',
  'atlas.priority1': 'Nizak prioritet — držite na mapi, ne preinvestirajte.',

  'form.value': 'Procenjena vrednost',
  'form.valueOptionalHint': 'Opciono — ostavite prazno za pro-bono',
  'form.valueEmoji': 'Oznaka vrednosti',
  'form.valueEmojiNone': 'Nema',
  'form.valueEmojiHeart': 'Od srca',
  'form.valueEmojiGift': 'Poklon / besplatno',
  'form.valueEmojiPartner': 'Partnerstvo',
  'form.valueEmojiStar': 'Prioritet',
  'form.valueEmojiHeartHint':
    'Vrednost može biti prazna ili €0 — srce pokazuje da je od srca / bez naplate.',
  'form.temperature': 'Temperatura',
  'form.stage': 'Faza pipeline-a',
  'form.followUp': 'Sledeći follow-up',
  'form.offer': 'Šta ponuditi',
  'form.offerPlaceholder': 'Proizvod, paket ili pitch za ovaj lead',
  'form.outreachSection': 'Inicijalni outreach email',
  'form.outreachHint':
    'Draft prvog emaila koji planirate da pošaljete. Čuva se uz lead — možete ga kopirati, otvoriti u mail aplikaciji ili kasnije označiti kao poslat.',
  'form.companyFocus': 'Čime se firma bavi',
  'form.companyFocusPlaceholder': 'Kratak kontekst — proizvod, publika ili zašto ste ih kontaktirali',
  'form.initialEmailSubjectPlaceholder': 'npr. Interaktivna 360° tura za vaš sajamski štand',
  'form.initialEmailBodyPlaceholder':
    'Napišite ceo email ovde — pozdrav, pitch i potpis. Možete ga doraditi kasnije na stranici leada.',
  'form.notes': 'Interne beleške',
  'form.localeSection': 'Lokacija i vremenska zona klijenta',
  'form.localeHint':
    'Pretražite i izaberite grad da se automatski popune država, vremenska zona i koordinate za živi sat i vreme.',
  'form.city': 'Grad',
  'form.cityPlaceholder': 'npr. Beograd',
  'form.citySearchPlaceholder': 'Kucajte da pretražite gradove…',
  'form.citySearching': 'Pretraga gradova…',
  'form.cityNoResults': 'Nema rezultata. Probajte drugačiji unos.',
  'form.cityClear': 'Obriši grad i polja lokacije',
  'form.citySuggestions': 'Predlozi gradova',
  'form.country': 'Država',
  'form.countryPlaceholder': 'npr. Srbija',
  'form.timezone': 'Vremenska zona (IANA)',
  'form.timezonePlaceholder': 'Europe/Belgrade',
  'form.timezoneInvalid': 'Izaberite ispravnu IANA zonu (npr. Europe/Belgrade).',
  'form.cancel': 'Otkaži',
  'form.save': 'Sačuvaj lead',
  'form.add': 'Dodaj lead',
  'form.saving': 'Čuvanje…',
  'form.saveFailed': 'Čuvanje nije uspelo.',

  'act.title': 'Dnevnik komunikacije',
  'act.blurb':
    'Beležite pozive, emailove, sastanke i beleške — istorija odnosa u Salesforce stilu.',
  'act.type': 'Tip',
  'act.subject': 'Naslov',
  'act.subjectPlaceholder': 'npr. Uvodni poziv — razgovor o 360 turama',
  'act.details': 'Detalji',
  'act.log': 'Zabeleži aktivnost',
  'act.logging': 'Beleženje…',
  'act.loading': 'Učitavanje istorije…',
  'act.empty': 'Još nema aktivnosti. Zabeležite prvi kontakt iznad.',
  'act.delete': 'Obriši',
  'act.deleteConfirm': 'Obrisati ovu aktivnost?',
  'act.loadFailed': 'Učitavanje aktivnosti nije uspelo.',
  'act.logFailed': 'Beleženje aktivnosti nije uspelo.',
  'act.deleteFailed': 'Brisanje nije uspelo.',
  'act.edit': 'Izmeni',
  'act.save': 'Sačuvaj izmene',
  'act.saving': 'Čuvam…',
  'act.cancel': 'Otkaži',
  'act.when': 'Kada',
  'act.editFailed': 'Ažuriranje aktivnosti nije uspelo.',

  'outreach.title': 'Inicijalni outreach email',
  'outreach.subject': 'Naslov',
  'outreach.body': 'Tekst',
  'outreach.contactRole': 'Uloga kontakta',
  'outreach.companyFocus': 'Fokus kompanije',
  'outreach.pendingAlert': 'Inicijalni email je pripremljen ali još nije označen kao poslat.',
  'outreach.badgePending': 'Email na čekanju',
  'outreach.badgeSent': 'Email poslat',
  'outreach.badgeSentAt': 'Inicijalni outreach označen poslat · {date}',
  'outreach.statusNone': 'Nema drafta',
  'outreach.statusPending': 'Spreman za slanje',
  'outreach.statusDrafted': 'Označen kao draft',
  'outreach.statusSent': 'Poslat',
  'outreach.copyEmail': 'Kopiraj email',
  'outreach.openMail': 'Otvori u mail aplikaciji',
  'outreach.markDrafted': 'Označi draft',
  'outreach.markSent': 'Označi kao poslat',
  'outreach.sentConfirm': 'Označiti inicijalni outreach kao poslat? Ovo beleži email aktivnost i prebacuje New leadove u Contacted.',
  'outreach.draftedAt': 'Označen draft',
  'outreach.sentAt': 'Označen poslat',
  'outreach.addDraft': 'Dodaj email draft',
  'outreach.saveDraft': 'Sačuvaj draft',
  'outreach.saveFailed': 'Čuvanje email drafta nije uspelo.',
  'outreach.markFailed': 'Ažuriranje outreach statusa nije uspelo.',
  'outreach.defaultActivitySubject': 'Inicijalni outreach email poslat',
  'outreach.sentActivityBody': 'Inicijalni outreach email označen kao poslat iz CRM-a.',

  'profile.title': 'Vaša profilna fotografija',
  'profile.photo': 'Vaša fotografija',
  'profile.yourPhoto': 'Vaša fotografija',
  'profile.menuAria': 'Profilna fotografija',
  'profile.upload': 'Otpremi fotografiju',
  'profile.change': 'Promeni fotografiju',
  'profile.remove': 'Ukloni',
  'profile.hint': 'JPG, PNG, WebP ili GIF · iseći i kompresuj pre otpreme (max 12 MB izvor)',
  'profile.uploadFailed': 'Otpremanje nije uspelo.',
  'profile.removeFailed': 'Nije moguće ukloniti fotografiju.',
  'profile.invalidImage': 'Izaberite sliku.',
  'profile.tooLarge': 'Slika mora biti manja od 12 MB pre isečka.',

  'crop.title': 'Iseci profilnu fotografiju',
  'crop.hint': 'Prevucite za poziciju · zumirajte kadar · čuva se kao komprimirani krug',
  'crop.zoom': 'Zum',
  'crop.cancel': 'Otkaži',
  'crop.save': 'Sačuvaj fotografiju',
  'crop.saving': 'Čuvanje…',
  'crop.failed': 'Obrada slike nije uspela.',

  'guide.kicker': 'Dobrodošli',
  'guide.title': 'IOM klijentski CRM',
  'guide.close': 'Zatvori vodič',
  'guide.gotIt': 'Razumem',
  'guide.whatHeading': 'Šta je ovaj alat',
  'guide.whatText':
    'Vaš privatni IOM radni prostor — leadovi i pipeline, table projekata u Monday stilu, praćenje vremena u Clockify stilu i mape uma u MindMeister stilu. U online režimu prijavljeni zaposleni dele iste podatke.',
  'guide.what1': 'Leadovi — firme za pitch, Vruć / Topao / Hladan, faze pipeline-a, dnevnik aktivnosti',
  'guide.what2': 'Projekti — kanban table sa kolonama i zadacima za isporuku',
  'guide.what3': 'Vreme — start/stop tajmeri, ručni unosi i izveštaji',
  'guide.what4': 'Ideje — mape uma samostalno ili povezane sa leadom / projektom',
  'guide.navHeading': 'Navigacija',
  'guide.navText': 'Kartice ispod zaglavlja menjaju alate: Leadovi | Projekti | Vreme | Ideje.',
  'guide.nav1': 'Leadovi — CRM u Salesforce stilu za potencijalne klijente',
  'guide.nav2': 'Projekti — table u Monday stilu za rad na isporuci',
  'guide.nav3': 'Vreme — tajmeri, unosi i izveštaji u Clockify stilu',
  'guide.nav4': 'Ideje — mape uma u MindMeister stilu za brainstorming',
  'guide.leadHeading': 'Leadovi — šta je lead?',
  'guide.leadText':
    'Lead je potencijalni klijent ili kontakt kog pokušavate da osvojite — još ne zatvoren posao.',
  'guide.lead1': 'Jedan zapis po firmi ili prilici koju želite da pratite',
  'guide.lead2': 'Sadrži kontakt podatke, šta nameravate da ponudite, fazu i temperaturu',
  'guide.lead3': 'Otvoreni leadovi ostaju u pipeline-u dok ne budu Dobijen ili Izgubljen',
  'guide.pipelineHeading': 'Šta je pipeline?',
  'guide.pipelineText':
    'Pipeline je put kojim lead prolazi kroz prodajne faze, od prvog unosa do zatvorenog ishoda.',
  'guide.pipeline1':
    'Faze: Novi → Kontaktiran → Kvalifikovan → Ponuda → Pregovori → Dobijen / Izgubljen',
  'guide.pipeline2': 'Ažurirajte fazu kako posao napreduje da lista odgovara stvarnosti',
  'guide.pipeline3':
    'Faza = koliko je posao odmakao (odvojeno od Vruć / Topao / Hladan)',
  'guide.tempHeading': 'Vruć / Topao / Hladan',
  'guide.tempText':
    'Temperatura je signal prioriteta — koliko je lead zainteresovan ili hitan trenutno.',
  'guide.temp1': 'Vruć — visoko interesovanje ili hitnost; kontaktirajte uskoro',
  'guide.temp2': 'Topao — aktivna prilika; nastavite da negujete',
  'guide.temp3': 'Hladan — nisko interesovanje ili na čekanju; vratite se kasnije',
  'guide.temp4':
    'Temperatura nije ista kao faza: lead može biti Vruć na Novi, ili Hladan u Pregovorima',
  'guide.fieldsHeading': 'Polja leada',
  'guide.fields1':
    'Kontakt: naziv firme, sajt, kontakt osoba, email i telefon',
  'guide.fields2':
    'Šta ponuditi — proizvod, paket ili pitch za ovaj lead',
  'guide.fields3':
    'Opciono: datum sledećeg follow-up-a i procenjena vrednost posla za planiranje',
  'guide.startHeading': 'Početak rada sa leadovima',
  'guide.start1': 'Kliknite + Dodaj lead da kreirate potencijalnog klijenta',
  'guide.start2': 'Popunite kontakt polja i šta planirate da ponudite',
  'guide.start3': 'Podesite temperaturu (Vruć / Topao / Hladan) i početnu fazu pipeline-a',
  'guide.start4': 'Opciono: datum sledećeg follow-up-a i procenjena vrednost',
  'guide.pipeHeading': 'Rad sa pipeline-om',
  'guide.pipe1': 'Izaberite lead u levoj listi da otvorite panel sa detaljima',
  'guide.pipe2':
    'Ažurirajte fazu kako napredujete: Novi → Kontaktiran → Kvalifikovan → Ponuda → Pregovori → Dobijen / Izgubljen',
  'guide.pipe3': 'Menjajte Vruć / Topao / Hladan kad god se interesovanje promeni',
  'guide.pipe4': 'Izmenite detalje, tekst ponude i beleške kako razgovori napreduju',
  'guide.commHeading': 'Dnevnik aktivnosti',
  'guide.comm1':
    'Na leadu zabeležite Poziv, Email, Sastanak, Belešku ili Zadatak u panelu aktivnosti',
  'guide.comm2': 'Dodajte kratak naslov i opcione detalje da vremenska linija ostane korisna',
  'guide.comm3': 'Pregledajte prošle aktivnosti na istom leadu pre sledećeg kontakta',
  'guide.findHeading': 'Pretraga i filteri',
  'guide.find1': 'Pretražujte po firmi, kontaktu ili emailu u gornjoj traci',
  'guide.find2':
    'Filtrirajte po fazi pipeline-a, temperaturi (Vruć / Topao / Hladan) i po tome ko je dodao lead',
  'guide.find3':
    'Sortirajte po poslednjoj izmeni, ko je dodao ili fazi; statistika pokazuje brojeve za trenutne filtere',
  'guide.projectsHeading': 'Projekti',
  'guide.projectsText':
    'Table u Monday stilu za isporuku — kolone, zadaci i status projekta.',
  'guide.projects1':
    'Kreirajte samostalan projekat dugmetom + Novi projekat na kartici Projekti',
  'guide.projects2':
    'Sa leada koristite Pošalji u upravljanje projektima da otvorite povezanu tablu za isporuku',
  'guide.projects3':
    'Dodajte kolone (+ Kolona), kreirajte zadatke u kolonama i premestajte ih kako rad napreduje',
  'guide.projects4':
    'Podesite status u zaglavlju table: Planiran / Aktivan / Na čekanju / Završen / Otkazan',
  'guide.projects5':
    'Iz trake table skočite na Vreme ili Ideje za taj projekat',
  'guide.timeHeading': 'Vreme',
  'guide.timeText':
    'Praćenje vremena u Clockify stilu za projekte i zadatke.',
  'guide.time1':
    'Na kartici Vreme pokrenite/zaustavite tajmer na projektu sa opcionim beleškama',
  'guide.time2': 'Dodajte ručni unos kada zaboravite da pokrenete tajmer',
  'guide.time3': 'Izveštaji razlažu završeno vreme po projektu, korisniku i danu',
  'guide.time4':
    'Na tabli Projekata pokrenite/zaustavite tajmer direktno sa kartice zadatka',
  'guide.ideasHeading': 'Ideje',
  'guide.ideasText':
    'Mape uma u MindMeister stilu — samostalne ili povezane sa leadom ili projektom.',
  'guide.ideas1':
    'Kreirajte mapu na kartici Ideje; opciono je povežite sa leadom i/ili projektom',
  'guide.ideas2':
    'Sa leada, Otvori tablu ideja skače na Ideje i fokusira mapu tog leada',
  'guide.ideas3':
    'Gradite stablo: dodajte podideje, menjajte naslove na mestu, ugnezdite po potrebi',
  'guide.ideas4':
    'U online režimu mape su deljene sa svim prijavljenim zaposlenima — tim vidi iste table',
  'guide.photoHeading': 'Profilna fotografija',
  'guide.photo1': 'Kliknite avatar ili email u gornjoj traci da otvorite meni fotografije',
  'guide.photo2':
    'Isecite u krug, komprimujte, pa otpremite, promenite ili uklonite svoju profilnu sliku',
  'guide.photo3':
    'Vaša fotografija se prikazuje pored leadova koje dodate; ažuriranje osvežava i postojeće leadove',
  'guide.uiHeading': 'Pomoć i jezik',
  'guide.ui1':
    'Pomoć (zaglavlje, pored Odjava) ponovo otvara ovaj vodič bilo kada',
  'guide.ui2': 'Dugme sa zastavom prebacuje ceo CRM između engleskog i srpskog',
  'guide.hint':
    'Kartice: Leadovi · Projekti · Vreme · Ideje. Ponovo otvorite vodič dugmetom Pomoć. Zastava = Engleski ↔ Srpski.',
}

const dictionaries: Record<'en' | 'sr', Dict> = { en, sr }

function isDemoLang(value: string | null | undefined): value is DemoLang {
  return (
    value === 'en' ||
    value === 'de' ||
    value === 'nl' ||
    value === 'fr' ||
    value === 'it'
  )
}

function readStoredLang(demo: boolean): CrmLang {
  try {
    if (demo) {
      const raw = localStorage.getItem(DEMO_LANG_KEY)
      if (isDemoLang(raw)) return raw
      return 'en'
    }
    const raw = localStorage.getItem(CRM_LANG_KEY)
    if (raw === 'sr' || raw === 'en') return raw
  } catch {
    /* ignore */
  }
  return 'en'
}

function writeStoredLang(lang: CrmLang, demo: boolean): void {
  try {
    if (demo) {
      if (isDemoLang(lang)) localStorage.setItem(DEMO_LANG_KEY, lang)
      return
    }
    if (lang === 'en' || lang === 'sr') {
      localStorage.setItem(CRM_LANG_KEY, lang)
    }
  } catch {
    /* ignore */
  }
}

function resolveDict(lang: CrmLang): Dict {
  if (lang === 'sr') return dictionaries.sr
  if (lang === 'en') return dictionaries.en
  return demoDictionaries[lang] ?? dictionaries.en
}

function localeTagFor(lang: CrmLang): string {
  if (lang === 'sr') return 'sr-RS'
  if (isDemoLang(lang)) return DEMO_LOCALE_TAGS[lang]
  return 'en-US'
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string

interface CrmI18nValue {
  lang: CrmLang
  setLang: (lang: CrmLang) => void
  toggleLang: () => void
  /** Languages offered by the current mode (demo vs staff). */
  availableLangs: readonly CrmLang[]
  demo: boolean
  t: TranslateFn
  statusLabel: (status: LeadStatus) => string
  tempLabel: (temp: LeadTemperature) => string
  activityLabel: (type: ActivityType) => string
  locale: string
}

const CrmI18nContext = createContext<CrmI18nValue | null>(null)

export function CrmI18nProvider({
  children,
  demo = false,
}: {
  children: ReactNode
  /** Public CRM demo — EN/DE/NL/FR/IT only (no Serbian). */
  demo?: boolean
}) {
  const [lang, setLangState] = useState<CrmLang>(() => readStoredLang(demo))

  const availableLangs = useMemo<readonly CrmLang[]>(
    () => (demo ? DEMO_LANGS : (['en', 'sr'] as const)),
    [demo],
  )

  const setLang = useCallback(
    (next: CrmLang) => {
      const allowed = demo
        ? isDemoLang(next)
        : next === 'en' || next === 'sr'
      if (!allowed) return
      setLangState(next)
      writeStoredLang(next, demo)
    },
    [demo],
  )

  const toggleLang = useCallback(() => {
    const list = availableLangs
    const idx = list.indexOf(lang as (typeof list)[number])
    const next = list[(idx >= 0 ? idx + 1 : 0) % list.length]
    setLang(next)
  }, [availableLangs, lang, setLang])

  // If staff had SR stored and user opens demo, snap back to EN.
  useEffect(() => {
    if (demo && !isDemoLang(lang)) {
      setLangState('en')
      writeStoredLang('en', true)
    }
  }, [demo, lang])

  const t = useCallback<TranslateFn>(
    (key, vars) => {
      const dict = resolveDict(lang)
      let text = dict[key] ?? dictionaries.en[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{${k}}`, String(v))
        }
      }
      return text
    },
    [lang],
  )

  const value = useMemo<CrmI18nValue>(
    () => ({
      lang,
      setLang,
      toggleLang,
      availableLangs,
      demo,
      t,
      statusLabel: (status) => t(`status.${status}`),
      tempLabel: (temp) => t(`temp.${temp}`),
      activityLabel: (type) => t(`activity.${type}`),
      locale: localeTagFor(lang),
    }),
    [lang, setLang, toggleLang, availableLangs, demo, t],
  )

  return <CrmI18nContext.Provider value={value}>{children}</CrmI18nContext.Provider>
}

export function useCrmI18n(): CrmI18nValue {
  const ctx = useContext(CrmI18nContext)
  if (!ctx) throw new Error('useCrmI18n must be used within CrmI18nProvider')
  return ctx
}

export const LEAD_STATUS_VALUES: LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]

export const LEAD_TEMP_VALUES: LeadTemperature[] = ['hot', 'warm', 'cold']

export const ACTIVITY_TYPE_VALUES: ActivityType[] = [
  'call',
  'email',
  'meeting',
  'note',
  'task',
]
