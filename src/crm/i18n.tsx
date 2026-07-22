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
  'stats.priority': 'Priority',
  'stats.priorityFilter': 'Show priority outreach leads',
  'stats.priorityFilterClear': 'Clear priority filter',

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
  'toolbar.notContacted': 'Not contacted',
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
  'error.contactPrioritySchemaMissing':
    'Priority queue will not save until you run crm_lead_contact_priority_migration.sql in Supabase → SQL Editor, then hard-refresh.',
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
    'Interactive sample workspace with fictional companies. Try Email conversation (e.g. Copper Lantern), Blog (posts / comments / emails), and Log client reply — all simulated in this browser. Nothing touches live clients or real inboxes.',
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
  'list.priority': 'Priority',
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
  'detail.priority': 'Priority',
  'detail.prioritySet': 'Add to priority queue',
  'detail.priorityClear': 'Remove from priority queue',
  'detail.priorityFailed': 'Could not update priority queue.',
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
  'nav.notes': 'Notes',
  'nav.recordings': 'Recorder',
  'nav.blog': 'Blog',
  'nav.links': 'Links',
  'nav.demos': 'Demo',
  'nav.seo': 'IOM-SEO',
  'nav.toolsAria': 'Blog, Links and SEO',

  'recorder.tab.record': 'Record',
  'recorder.tab.screenshot': 'Screenshot',
  'recorder.tab.library': 'Library',
  'recorder.screenshot.intro':
    'Capture a tab, window, or screen as a PNG. Save online (Cloudflare R2 — files stay until you delete them). Then in Blog → Attached images use Replace / Insert with Copy image URL or the /r/… share link. Same for videos from Record — paste the /r/… share link in the post body.',
  'recorder.screenshot.capture': 'Capture screenshot',
  'recorder.screenshot.capturing': 'Capturing…',
  'recorder.screenshot.uploading': 'Saving screenshot…',
  'recorder.screenshot.done': 'Screenshot saved.',
  'recorder.screenshot.preview': 'Last screenshot',
  'recorder.screenshot.error': 'Could not capture screenshot. Allow screen share and try again.',
  'recorder.kind.video': 'Video',
  'recorder.kind.image': 'Screenshot',
  'recorder.copyImageUrl': 'Copy lasting image URL',
  'recorder.copyImageUrlHint':
    'Lasting link for Blog covers and markdown — Cloudflare R2 file stays until you delete it. Paste into Blog → Attached images → Replace / cover URL.',
  'recorder.intro':
    'Record video or capture screenshots. Use mic, camera PiP, voice presets or AI morph, static/avatar appearance, then save locally or online (Cloudflare R2) and share with a password-protected /r/… link.',
  'recorder.introDemo':
    'Demo sandbox — recordings and screenshots stay in this browser only. Online save and lasting share links need the live CRM (/client-login).',
  'recorder.onlinePersistHint':
    'Online files are stored on Cloudflare R2 and are not auto-deleted. Use Copy lasting image URL or /r/… share links for blogs — temporary R2 signed links expire in hours.',
  'recorder.start': 'Start recording',
  'recorder.stop': 'Stop',
  'recorder.pause': 'Pause',
  'recorder.resume': 'Resume',
  'recorder.changeScreen': 'Change screen / tab',
  'recorder.changeScreen.hint':
    'While paused you can switch to another tab, window, or screen, then resume.',
  'recorder.changeScreen.busy': 'Waiting for screen pick…',
  'recorder.changeScreen.failed': 'Could not change screen. Keep the current one or try again.',
  'recorder.float.title': 'IOM Recorder',
  'recorder.float.open': 'Floating controls',
  'recorder.float.hint':
    'After Start, click Floating controls for an always-on-top Pause / Camera / Stop panel (needs a click — not automatic).',
  'recorder.float.cameraOn': 'Camera PiP on',
  'recorder.float.cameraOff': 'Camera PiP off',
  'recorder.float.blocked':
    'Could not open floating controls (allow popups). Pause and Stop still work in this CRM tab.',
  'recorder.error.shareEnded':
    'Screen sharing ended. Recording stopped — click Start to record again.',
  'recorder.error.emptyRecording':
    'Recording looks frozen or empty (often from switching away from the CRM tab). Keep the recorder tab visible, or use Floating controls, then try again.',
  'recorder.error.tabHidden':
    'CRM tab is in the background — keep it visible (or use Floating controls) so the recording does not freeze on one frame.',
  'recorder.mic': 'Microphone',
  'recorder.shareAudio': 'Tab / system audio',
  'recorder.shareAudioHint':
    'Records sound from the shared tab or screen (YouTube, demos, etc.). In Chrome, pick a tab and enable “Also share tab audio”.',
  'recorder.shareAudio.missing':
    'Tab audio was requested but not shared. Stop and start again — choose a Chrome tab and check “Also share tab audio”.',
  'recorder.camera': 'Camera (PiP)',
  'recorder.noise': 'Noise suppression',
  'recorder.noiseHint':
    'Uses the browser’s mic noise filter (Chrome/Edge work best). Turn off if music or ambience sounds muffled.',
  'recorder.hud.micOn': 'Mic on',
  'recorder.hud.micOff': 'Mic off',
  'recorder.hud.shareAudioOn': 'Tab audio on',
  'recorder.hud.shareAudioOff': 'Tab audio off',
  'recorder.hud.cameraOn': 'Camera on',
  'recorder.hud.cameraOff': 'Camera off',
  'recorder.hud.noAvatar': 'No avatar',
  'recorder.hud.live': 'REC',
  'recorder.warn.inputsOff':
    '{items} are turned off. Continue without them?\n\nTip: enable Microphone for your voice, and Tab / system audio for YouTube or demo sound (Chrome: check “Also share tab audio”).',
  'recorder.voice': 'Voice',
  'recorder.voice.natural': 'Natural',
  'recorder.voice.deep': 'Deep',
  'recorder.voice.high': 'Higher',
  'recorder.voice.robot': 'Robot',
  'recorder.voice.ai': 'AI morph (ElevenLabs)',
  'recorder.voice.aiPick': 'AI voice',
  'recorder.voice.aiLoading': 'Loading voices…',
  'recorder.voice.aiEmpty': 'No voices found',
  'recorder.voice.aiHint':
    'AI morph applies after you stop. Free ElevenLabs cannot use library voices — pick a cloned/created voice, or upgrade.',
  'recorder.voice.aiLibraryTag': 'library — needs paid plan',
  'recorder.voice.aiOwnedHint':
    'No cloned voices on this ElevenLabs account. Clone a voice at elevenlabs.io, or upgrade to use library voices.',
  'recorder.voice.aiUnavailable': 'AI morph unavailable (no API key). Using live preset only.',
  'recorder.voice.aiFailedKeep':
    'AI voice morph failed — saved original audio. ({detail})',
  'recorder.appearance': 'Appearance',
  'recorder.appearance.none': 'None (no avatar)',
  'recorder.appearance.real': 'Real camera',
  'recorder.appearance.filters': 'Filters',
  'recorder.appearance.avatar': 'Avatar (animated)',
  'recorder.appearance.static': 'Static image',
  'recorder.appearance.staticHint':
    'Shows a fixed photo or logo in the corner — no webcam needed. Default is the IOM raven; upload your own or use your CRM profile photo.',
  'recorder.appearance.staticIomRaven': 'IOM raven',
  'recorder.appearance.staticUpload': 'Upload image',
  'recorder.appearance.staticUseProfile': 'Use profile photo',
  'recorder.appearance.staticClear': 'Clear',
  'recorder.appearance.staticEmpty': 'No image',
  'recorder.appearance.staticMissing': 'Choose a static image before recording.',
  'recorder.appearance.staticBadType': 'Please choose a PNG, JPEG, WebP, or GIF image.',
  'recorder.appearance.staticTooLarge': 'Image is too large. Try a smaller photo (under ~700 KB).',
  'recorder.appearance.staticNoProfile': 'No CRM profile photo found. Upload one in the top bar, or pick a file.',
  'recorder.hud.staticOn': 'Static on',
  'recorder.hud.staticOff': 'Static off',
  'recorder.blur.tool': 'Blur tool',
  'recorder.blur.strength': 'Blur strength',
  'recorder.blur.light': 'Light',
  'recorder.blur.medium': 'Medium',
  'recorder.blur.strong': 'Strong',
  'recorder.blur.hint':
    'Drag on the preview to blur areas. Boxes drawn while recording are baked in; after stop, use Apply blur on take.',
  'recorder.blur.count': '{n} blur region(s)',
  'recorder.blur.undo': 'Undo last',
  'recorder.blur.clear': 'Clear boxes',
  'recorder.blur.applyPost': 'Apply blur on take',
  'recorder.blur.applying': 'Applying blur…',
  'recorder.edit': 'Edit',
  'recorder.edit.title': 'Edit recording',
  'recorder.edit.cancel': 'Close',
  'recorder.edit.trimStart': 'Trim start',
  'recorder.edit.trimEnd': 'Trim end',
  'recorder.edit.trimRange': 'Keep {range}',
  'recorder.edit.volume': 'Volume',
  'recorder.edit.mute': 'Mute',
  'recorder.edit.music': 'Background music',
  'recorder.edit.musicNone': 'None',
  'recorder.edit.musicCatalog': 'IOM website tracks',
  'recorder.edit.musicUpload': 'Upload audio file',
  'recorder.edit.musicTrack': 'Track',
  'recorder.edit.musicVolume': 'Music level',
  'recorder.edit.musicHint':
    'Music mixes under your voice at {pct}%. Mute original volume for music-only. Preview plays with the video.',
  'recorder.edit.musicChooseFile': 'Choose audio…',
  'recorder.edit.musicReplace': 'Replace file…',
  'recorder.edit.musicClear': 'Clear',
  'recorder.edit.musicBadType': 'Please choose an audio file (mp3, wav, etc.).',
  'recorder.edit.musicMissingUpload': 'Choose an audio file to upload first.',
  'recorder.edit.musicMissingTrack': 'No IOM track selected.',
  'recorder.edit.blurHint':
    'Drag on the video to add blur boxes. Changes apply when you save or download.',
  'recorder.edit.encoding': 'Encoding… {pct}%',
  'recorder.edit.saving': 'Saving…',
  'recorder.edit.save': 'Save online',
  'recorder.edit.applyLocal': 'Apply to library',
  'recorder.edit.slowHint':
    'Uses offline WebCodecs encoding when available (often much faster than real-time on a strong PC). Falls back to real-time encode if needed.',
  'recorder.edit.loading': 'Loading…',
  'recorder.edit.loadFailed': 'Could not load recording for edit.',
  'recorder.edit.error': 'Edit failed. Try again.',
  'recorder.destination': 'Save to',
  'recorder.destination.local': 'Download locally',
  'recorder.destination.online': 'Save online',
  'recorder.destination.onlineDemo': 'Online save needs live CRM',
  'recorder.title': 'Title',
  'recorder.titlePlaceholder': 'Recording or screenshot title',
  'recorder.preview': 'Preview',
  'recorder.status.idle': 'Ready',
  'recorder.status.recording': 'Recording…',
  'recorder.status.paused': 'Paused',
  'recorder.status.processing': 'Processing…',
  'recorder.status.uploading': 'Uploading…',
  'recorder.error.screen': 'Could not capture screen. Allow screen sharing and try again.',
  'recorder.error.mic': 'Could not access microphone.',
  'recorder.error.camera': 'Could not access camera.',
  'recorder.error.save': 'Could not save recording.',
  'recorder.error.upload': 'Could not upload recording.',
  'recorder.error.tooLarge':
    'Online save failed — file is {mb} MB (over the 512 MB limit). A local copy was downloaded. Use a shorter clip.',
  'recorder.library.empty': 'No recordings yet.',
  'recorder.library.loading': 'Loading recordings…',
  'recorder.library.schemaMissing':
    'Recordings storage is not set up yet. Run supabase/crm_recordings_migration.sql in the Supabase SQL Editor.',
  'recorder.library.local': 'This session (local)',
  'recorder.library.online': 'Online (Cloudflare R2)',
  'recorder.uploadOnline': 'Upload online',
  'recorder.uploadOnline.busy': 'Uploading…',
  'recorder.uploadOnline.tooLarge':
    'File is {mb} MB — over the 512 MB online limit. Keep local / download, or trim the clip.',
  'recorder.uploadAll': 'Upload all online',
  'recorder.uploadAll.busy': 'Uploading all…',
  'recorder.uploadAll.tooLarge':
    'Skipped “{title}” ({mb} MB) — over the online limit. Other items may still upload.',
  'recorder.manualUpload': 'Upload video',
  'recorder.manualUpload.busy': 'Uploading…',
  'recorder.manualUpload.hint':
    'Choose a WebM, MP4, or MOV from your computer. Live CRM saves it Online; demo keeps it in this session.',
  'recorder.manualUpload.invalid': 'Please choose a video file (WebM, MP4, or MOV).',
  'recorder.manualImage': 'Upload image',
  'recorder.manualImage.busy': 'Uploading…',
  'recorder.manualImage.hint':
    'Or upload a PNG, JPEG, WebP, or GIF from your computer (uses Title + Save to above).',
  'recorder.manualImage.invalid':
    'Please choose an image file (PNG, JPEG, WebP, or GIF).',
  'recorder.download': 'Download',
  'recorder.delete': 'Delete',
  'recorder.deleteConfirm': 'Delete “{title}”?',
  'recorder.copyShare': 'Copy share link',
  'recorder.copyEmbed': 'Copy embed code',
  'recorder.copied': 'Copied',
  'recorder.setPassword': 'Set password',
  'recorder.clearPassword': 'Clear password',
  'recorder.passwordPlaceholder': 'Share password',
  'recorder.passwordSaved': 'Password saved',
  'recorder.openShare': 'Open share page',
  'recorder.duration': 'Duration',
  'recorder.size': 'Size',
  'share.title': 'Shared recording',
  'share.password': 'Password',
  'share.unlock': 'Unlock',
  'share.wrongPassword': 'Wrong password',
  'share.notFound': 'Recording not found',
  'share.loading': 'Loading…',
  'share.locked': 'This recording is password protected.',

  'links.kicker': 'Shared resource library',
  'links.kickerDemo': 'Sample resource library',
  'links.title': 'Links',
  'links.intro':
    'Useful YouTube channels, webpages, forums, and blog posts we want to keep handy. Add your own, filter by type, search by topic — every entry can carry a short “why” note.',
  'links.introDemo':
    'Sample bookmarks for the public CRM demo — add, remove, search, and filter freely. Reset sample data restores the original sample list.',
  'links.open': 'Open',
  'links.copy': 'Copy',
  'links.copied': 'Copied',
  'links.remove': 'Remove',
  'links.add': '+ Add link',
  'links.cancelAdd': 'Cancel',
  'links.save': 'Save link',
  'links.saving': 'Saving…',
  'links.loading': 'Loading links…',
  'links.loadFailed': 'Could not load links.',
  'links.createFailed': 'Could not add link.',
  'links.deleteFailed': 'Could not remove link.',
  'links.deleteConfirm': 'Remove “{name}” from Links?',
  'links.form.title': 'Title',
  'links.form.url': 'https://…',
  'links.form.category': 'Type',
  'links.form.note': 'Why keep this? (optional)',
  'links.empty': 'No links in this category yet.',
  'links.emptySearch': 'No links match that search.',
  'links.searchPlaceholder': 'Search title, note, tag…',
  'links.searchAria': 'Search links',
  'links.filtersAria': 'Filter links by type',
  'links.filter.all': 'All',
  'links.category.youtube': 'YouTube',
  'links.category.webpage': 'Webpage',
  'links.category.forum': 'Forum',
  'links.category.blog': 'Blog post',

  'demos.kicker': 'Private client demos',
  'demos.title': 'Demo',
  'demos.intro':
    'Demos we build for clients that are not on the public site. Password-gated links for pitches and reviews.',
  'demos.open': 'Open demo',
  'demos.openLocal': 'Open on this site',
  'demos.preview': 'Preview',
  'demos.url': 'Website',
  'demos.password': 'Password',
  'demos.gallery': 'Images from this demo',
  'demos.expand': 'Expand',
  'demos.collapse': 'Collapse',
  'demos.expandAria': 'Expand {name} demo',
  'demos.collapseAria': 'Collapse {name} demo',
  'demos.status.preview': 'Preview',
  'demos.status.draft': 'Draft',
  'demos.status.live': 'Live',

  'seo.kicker': 'Website',
  'seo.title': 'SEO & traffic',
  'seo.intro':
    'Search visibility, keyword targets, and privacy-friendly analytics for iobjectm.com — extend the registry when adding new content.',
  'seo.openSite': 'Open iobjectm.com',
  'seo.sitemap': 'Sitemap',
  'seo.schemaMissing':
    'Analytics tables not found — run supabase/site_analytics_migration.sql in your Supabase project.',
  'seo.trafficTitle': 'Traffic overview',
  'seo.rangeAria': 'Date range',
  'seo.range.7d': '7 days',
  'seo.range.30d': '30 days',
  'seo.range.90d': '90 days',
  'seo.loading': 'Loading analytics…',
  'seo.pageviews': 'Pageviews',
  'seo.visitors': 'Visitors',
  'seo.humans': 'Humans',
  'seo.bots': 'Crawlers / bots',
  'seo.bounce': 'Bounce rate',
  'seo.pagesPerSession': 'Pages / session',
  'seo.avgTime': 'Avg time on page',
  'seo.liveVisitors': 'Live (30 min)',
  'seo.globeTitle': 'Visitor map',
  'seo.globeBlurb': 'Realtime globe — brighter pulses are visitors from the last 30 minutes.',
  'seo.globeLoading': 'Loading globe…',
  'seo.topCountries': 'Top countries',
  'seo.noGeo': 'No location data yet — new visits will appear after geo migration.',
  'seo.dailyTrend': 'Daily pageviews',
  'seo.topPages': 'Top pages',
  'seo.topReferrers': 'Top referrers',
  'seo.topSources': 'How they find you',
  'seo.topSourcesNote': 'UTM, search, social, and referrers.',
  'seo.noSources': 'No acquisition data yet.',
  'seo.topKeywords': 'Keywords',
  'seo.topKeywordsNote': 'From utm_term / search referrers. Google organic → Search Console.',
  'seo.noKeywords': 'No keywords yet — add ?utm_term=… on campaign links.',
  'seo.topLinks': 'Links opened',
  'seo.topLinksNote': 'Internal and outbound clicks from your pages.',
  'seo.noLinks': 'No link clicks yet.',
  'seo.devices': 'Devices',
  'seo.noReferrers': 'No referrers yet.',
  'seo.noPages': 'No pages yet.',
  'seo.noDevices': 'No device data yet.',
  'seo.demoNote': 'Sample data — demo mode does not record live traffic.',
  'seo.noData': 'No traffic recorded yet for this period.',
  'seo.upgradesTitle': 'SEO upgrade registry',
  'seo.upgradesBlurb':
    'Track completed and planned SEO work. Add a row in src/seo/registry.ts when shipping improvements.',
  'seo.upgradeDone': '{n} done',
  'seo.upgradePending': '{n} pending',
  'seo.upgradePlanned': '{n} planned',
  'seo.targetsTitle': 'Keyword targets',
  'seo.targetsBlurb': 'Priority phrases mapped to public pages and portfolio sections.',
  'seo.contentTitle': 'Content inventory',
  'seo.contentBlurb': 'Homepage sections — update src/data/projects.ts and rebuild to refresh sitemap.',
  'seo.projects': 'projects',

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

  'notes.kicker': 'Research notes',
  'notes.create': '+ New note',
  'notes.newPlaceholder': 'Note title…',
  'notes.titlePlaceholder': 'Note title',
  'notes.bodyPlaceholder':
    'Use ## Section title for jump links in Preview. Name on one line + URL on the next, or paste free-form text…',
  'notes.editHint': 'Use ## Section title to create jump links · Edits save automatically',
  'notes.previewHint': 'Click Expand to open preview · Sections collapse individually inside',
  'notes.tocLabel': 'On this page',
  'notes.tocCount': '{count} sections',
  'notes.tocAria': 'Note sections',
  'notes.linkLead': 'Link to lead',
  'notes.linkProject': 'Link to project',
  'notes.noLead': 'No lead link',
  'notes.noProject': 'No project link',
  'notes.loading': 'Loading notes…',
  'notes.empty':
    'No research notes yet. Create one for artist lists, market research, or follow-up ideas.',
  'notes.select': 'Select a note or create one.',
  'notes.loadFailed': 'Failed to load notes.',
  'notes.createFailed': 'Could not create note.',
  'notes.saveFailed': 'Could not save note.',
  'notes.deleteFailed': 'Could not delete note.',
  'notes.untitled': 'Untitled note',
  'notes.noBody': 'Empty note',
  'notes.deleteConfirm': 'Delete note “{name}”?',
  'notes.edit': 'Edit',
  'notes.preview': 'Preview',
  'notes.saving': 'Saving…',
  'notes.saved': 'Saved',
  'notes.autosaveHint': 'Edits save automatically',
  'notes.schemaMissing':
    'Research notes table is missing. In Supabase → SQL Editor, paste and Run crm_research_notes_migration.sql, then hard-refresh.',

  'blog.schemaMissing':
    'Blog tables are missing. In Supabase → SQL Editor, paste and Run blog_migration.sql, then hard-refresh.',
  'blog.loadFailed': 'Failed to load blog data.',
  'blog.saveFailed': 'Could not save post.',
  'blog.saveOk': 'Post saved.',
  'blog.deleteFailed': 'Could not delete post.',
  'blog.moderationFailed': 'Could not update comment.',
  'blog.audienceFailed': 'Could not update email list.',
  'blog.loading': 'Loading blog…',
  'blog.tabPending': 'Pending Review',
  'blog.tabPosts': 'Posts',
  'blog.tabComments': 'Comments',
  'blog.tabEmails': 'Emails',
  'blog.pendingHint':
    'Review catalog posts here. Publish to show on public /blog (when BLOG_PUBLIC_ENABLED is on). Hide removes a post from this queue without deleting it.',
  'blog.postsHint':
    'Drafts, published, and hidden posts. Unpublish sends a live post back to Pending Review. Public /blog only lists published posts.',
  'blog.newPost': '+ New post',
  'blog.importCatalog': 'Import catalog ({count})',
  'blog.importCatalogDone': 'Sync catalog text',
  'blog.importing': 'Importing…',
  'blog.importResult':
    'Catalog sync: {created} new, {updated} updated ({skipped} unchanged).',
  'blog.importFailed': 'Could not import catalog posts.',
  'blog.statusFailed': 'Could not update post status.',
  'blog.publish': 'Publish',
  'blog.unpublish': 'Unpublish',
  'blog.hide': 'Hide',
  'blog.restoreReview': 'Restore to review',
  'blog.preview': 'Preview',
  'blog.noPending': 'Nothing pending — all reviewed posts are under Posts.',
  'blog.noPendingImport': 'No pending posts yet. Import the catalog to fill this queue.',
  'blog.demoComment': 'Add sample comment',
  'blog.untitled': 'Untitled',
  'blog.noPosts': 'No posts yet.',
  'blog.viewLive': 'View live',
  'blog.edit': 'Edit',
  'blog.delete': 'Delete',
  'blog.deleteConfirm': 'Delete this post and its comments?',
  'blog.backList': '← Back',
  'blog.save': 'Save',
  'blog.saving': 'Saving…',
  'blog.editorTip':
    'Required: title + excerpt. Use Markdown. Include internal links to demos or /#contact.',
  'blog.markdownHint':
    'Images: ![Caption](/assets/blog/slug/hero.jpg) on its own line. Links: [label](/demos/…) or https://… Cover path convention: /assets/blog/<slug>/cover.jpg. Recorder screenshots: paste Copy lasting image URL into Attached images. Recorder videos: paste the /r/… share link in the body.',
  'blog.coverHint':
    'Prefer site assets under /assets/blog/<slug>/ — or a full https:// URL from Recorder → Screenshot (Save online). No upload bucket yet.',
  'blog.attachTitle': 'Attached images',
  'blog.attachHint':
    'Cover + images from body markdown. Replace via URL, or Upload image (live CRM → Cloudflare R2 lasting link). Save keeps pending Replace URLs even without Apply. Avoid temporary r2.cloudflarestorage.com links.',
  'blog.attachEmpty': 'No images yet. Add a cover URL, or insert a body image slot below.',
  'blog.attachCover': 'Cover',
  'blog.attachBody': 'Body image {n}',
  'blog.attachReplace': 'Replace',
  'blog.attachBust': 'Bust cache',
  'blog.attachBustTitle':
    'Append a fresh ?v= so browsers pick up the new file (site assets / lasting media URLs only)',
  'blog.attachBustOk': 'Cache-busted. Save the post when ready.',
  'blog.attachBustSigned':
    'This is a temporary Cloudflare R2 signed URL — Bust cache cannot fix it (extra ?v= breaks the signature). Replace with Recorder → Screenshot → Copy lasting image URL (/api/crm-recorder?action=media&slug=…).',
  'blog.attachSignedWarn':
    'One or more images use temporary R2 signed links (they expire / break if edited). Replace each with Recorder → Copy lasting image URL.',
  'blog.previewInCrmHint':
    'Unpublished posts preview here in CRM (body Preview pane) — they are not on the public /blog site until Published.',
  'blog.attachNewUrl': 'Image URL',
  'blog.attachPathHint': 'File on disk: {path}',
  'blog.attachApply': 'Apply',
  'blog.attachCancel': 'Cancel',
  'blog.attachPickFile': 'Use filename…',
  'blog.attachUploadFile': 'Upload image…',
  'blog.attachUploading': 'Uploading image…',
  'blog.attachUploaded': 'Image uploaded to Cloudflare R2. Save the post to keep it.',
  'blog.attachUploadFailed': 'Image upload failed.',
  'blog.attachUploadNeedAuth': 'Sign in to live CRM to upload images.',
  'blog.attachUploadWait': 'Wait for the image upload to finish, then Save.',
  'blog.attachFileHint':
    'URL set from filename. Copy the file into {path}, then Apply + Save. (Demo has no cloud upload.)',
  'blog.attachAddCover': '+ Add cover',
  'blog.attachAddBody': '+ Insert body image',
  'blog.attachBodyInserted':
    'Inserted markdown image. Place the file at {path} (or change the URL), then Save.',
  'blog.insertDemoCta': 'Insert demo CTA',
  'blog.bodyPane': 'Body editor',
  'blog.paneEdit': 'Edit',
  'blog.panePreview': 'Preview',
  'blog.previewEmpty': 'Nothing to preview yet.',
  'blog.fieldTitle': 'Title',
  'blog.fieldSlug': 'URL slug',
  'blog.fieldExcerpt': 'Excerpt',
  'blog.fieldBody': 'Body (Markdown)',
  'blog.bodyPlaceholder':
    '## Heading\n\nParagraph with a [link](/demos/panorama-360/).\n\n![Camera view](/assets/blog/volume-lighting/hero.jpg)',
  'blog.fieldCover': 'Cover image URL',
  'blog.fieldAuthor': 'Author name',
  'blog.fieldTags': 'Tags (comma-separated)',
  'blog.fieldSeoTitle': 'SEO title',
  'blog.fieldSeoDesc': 'SEO description',
  'blog.fieldStatus': 'Status',
  'blog.statusDraft': 'Draft',
  'blog.statusPendingReview': 'Pending review',
  'blog.statusPublished': 'Published',
  'blog.statusHidden': 'Hidden',
  'blog.titleRequired': 'Title is required.',
  'blog.excerptRequired': 'Excerpt is required (used in listings + SEO).',
  'blog.filterStatus': 'Status',
  'blog.filterAll': 'All',
  'blog.statusPendingMod': 'Pending moderation',
  'blog.statusPendingVerify': 'Pending email verify',
  'blog.statusApproved': 'Approved',
  'blog.statusRejected': 'Rejected',
  'blog.statusSpam': 'Spam',
  'blog.approve': 'Approve',
  'blog.reject': 'Reject',
  'blog.spam': 'Spam',
  'blog.noComments': 'No comments in this filter.',
  'blog.optIn': 'marketing opt-in',
  'blog.optOut': 'no marketing',
  'blog.emailSearch': 'Search email or name…',
  'blog.marketingOnly': 'Marketing opt-in only',
  'blog.manualName': 'Name',
  'blog.manualEmail': 'Email',
  'blog.addManual': 'Add to list',
  'blog.deleteAudienceConfirm': 'Remove this email from the list?',
  'blog.notesPlaceholder': 'Internal notes…',
  'blog.noEmails': 'No blog emails yet — they appear when comments are verified.',

  'notesChatgpt.title': 'ChatGPT note assist',
  'notesChatgpt.blurb':
    'Copy a research prompt into ChatGPT, paste the JSON back, and load title + sections into this note.',
  'notesChatgpt.copyPrompt': 'Copy ChatGPT prompt',
  'notesChatgpt.step1':
    'Copy the prompt and tell ChatGPT what to research (e.g. artists to follow, market list, lead targets).',
  'notesChatgpt.step2': 'Ask ChatGPT to return the JSON object only.',
  'notesChatgpt.step3': 'Paste JSON below → Load into note → switch to Preview to check links and sections.',
  'notesChatgpt.pasteLabel': 'Paste ChatGPT JSON',
  'notesChatgpt.pastePlaceholder':
    'Paste JSON from ChatGPT here (with or without ```json fences)…',
  'notesChatgpt.loadIntoNote': 'Load into note',
  'notesChatgpt.loadSuccess': 'Note loaded — review in Preview; edits save automatically.',
  'notesChatgpt.copyFailed': 'Could not copy prompt to clipboard.',
  'notesChatgpt.pasteEmpty': 'Paste ChatGPT JSON first.',
  'notesChatgpt.missingTitle': 'JSON must include a title.',
  'notesChatgpt.missingBody': 'JSON must include body text or a sections array.',
  'notesChatgpt.parseFailed': 'Could not parse JSON — ask ChatGPT for a single JSON object only.',
  'notesChatgpt.importFailed': 'Could not load note data.',

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
  'outreach.showPreview': 'Preview formatted email',
  'outreach.hidePreview': 'Hide preview',
  'outreach.previewTitle': 'How it will look when sent',
  'outreach.markDrafted': 'Mark drafted',
  'outreach.markSent': 'Mark as sent',
  'outreach.markNotSent': 'Mark as not sent',
  'outreach.sendFromCrm': 'Send from CRM',
  'outreach.resend': 'Resend from CRM',
  'outreach.composeAdditional': 'Compose another email',
  'outreach.additionalTitle': 'Additional email',
  'outreach.additionalSubjectHint': 'Follow-up subject…',
  'outreach.sendAdditional': 'Send additional email',
  'outreach.recipient': 'Send to',
  'outreach.from': 'Send from',
  'outreach.noRecipient': 'Add an email address on this lead to send from CRM.',
  'outreach.sending': 'Sending…',
  'outreach.sendConfirm':
    'Send this email now to {email} from {from}? It will be wrapped in the IOM HTML template and marked as sent.',
  'outreach.resendConfirm':
    'Resend this outreach to {email} from {from}? This logs another email activity.',
  'outreach.additionalConfirm':
    'Send this additional email to {email} from {from}?',
  'outreach.sendDemoConfirm':
    'Simulate sending this email to {email} from {from}? No real message leaves this browser — the lead and activity log update with fake data only.',
  'outreach.resendDemoConfirm':
    'Simulate a resend to {email} from {from}? No real email is delivered — activity is logged in this demo only.',
  'outreach.additionalDemoConfirm':
    'Simulate sending this additional email to {email} from {from}? Fake data only — nothing is delivered.',
  'outreach.demoSendNote':
    'Demo mode: Send from CRM simulates delivery with fake data. No Proton SMTP or real inbox is used.',
  'outreach.sendMissing': 'Recipient, subject, and body are required to send.',
  'outreach.sendFailed': 'Could not send email via Proton.',
  'outreach.sendDemoBlocked': 'Sending is disabled in CRM demo mode.',
  'outreach.sendLiveRequired': 'Sign in to the live CRM to send email.',
  'outreach.sentConfirm': 'Mark initial outreach as sent? This logs an email activity and moves New leads to Contacted.',
  'outreach.notSentConfirm':
    'Mark initial outreach as not sent? The Email sent badge clears so you can send again. Activity history stays.',
  'outreach.draftedAt': 'Marked drafted',
  'outreach.sentAt': 'Marked sent',
  'outreach.addDraft': 'Add email draft',
  'outreach.saveDraft': 'Save draft',
  'outreach.saveFailed': 'Could not save email draft.',
  'outreach.markFailed': 'Could not update outreach status.',
  'outreach.defaultActivitySubject': 'Initial outreach email sent',
  'outreach.sentActivityBody': 'Marked initial outreach email as sent from CRM.',
  'outreach.sentViaCrmActivityBody':
    'Sent initial outreach email from CRM via {from} (Proton SMTP).',
  'outreach.resendActivityBody':
    'Resent outreach email from CRM to {email} via {from}.',
  'outreach.additionalActivityBody':
    'Sent additional email from CRM to {email} via {from}.',

  'thread.title': 'Email conversation',
  'thread.blurb':
    'Outbound CRM sends and mirrored client replies (Proton keep-copy → Resend → CRM). Mail still lives in Proton — this is the lead thread mirror.',
  'thread.loading': 'Loading…',
  'thread.count': '{n} messages',
  'thread.empty': 'No messages in this thread yet. Send the initial outreach or a reply to start.',
  'thread.schemaMissing':
    'Email conversation table is missing. Run supabase/crm_lead_messages_migration.sql in Supabase, then refresh.',
  'thread.loadFailed': 'Could not load email conversation.',
  'thread.outbound': 'Sent',
  'thread.inbound': 'Received',
  'thread.noSubject': '(no subject)',
  'thread.composeReply': 'Compose reply',
  'thread.replyTitle': 'Reply / follow-up',
  'thread.sendReply': 'Send reply',
  'thread.logInbound': 'Log client reply',
  'thread.logInboundFromHint': 'Client From email:',
  'thread.logInboundSubjectHint': 'Subject:',
  'thread.logInboundBodyHint': 'Paste the client reply body:',
  'thread.inboundDefaultSubject': 'Client reply',
  'thread.logInboundActivityBody': 'Logged client reply from {email} into CRM.',
  'thread.logFailed': 'Could not log client reply.',

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
    'Your private IOM workspace — leads and pipeline, Monday-style project boards, Clockify-style time tracking, MindMeister-style idea maps, research notes, Recorder (video + screenshots), public Journal (Blog), a shared Links library, and SEO / traffic analytics. In online mode, signed-in staff share the same data. The public CRM demo uses fictional sample data only.',
  'guide.what1':
    'Leads — companies to pitch, Hot / Warm / Cold, pipeline stages, Email conversation, activity log',
  'guide.what2': 'Projects — kanban boards with columns and tasks for delivery',
  'guide.what3': 'Time — start/stop timers, manual entries, and reports',
  'guide.what4': 'Ideas — mind maps standalone or linked to a lead / project',
  'guide.what5': 'Notes — long-form research lists (artists, markets, follow-ups) with sections and links',
  'guide.what6':
    'Demo — private client demos not listed on the public site (password links for pitches)',
  'guide.what7':
    'Blog — Journal posts, comment moderation, and a private blog email list (addresses never shown publicly)',
  'guide.what8':
    'Links — curated YouTube channels, webpages, forums, and blog posts worth keeping for both of us',
  'guide.what9': 'SEO — site inventory, upgrade checklist, and traffic analytics with a visitor globe',
  'guide.what10':
    'Recorder — screen video and PNG screenshots, voice/avatar options, library with share links for blogs and clients',
  'guide.navHeading': 'Navigation',
  'guide.navText':
    'Tabs under the header: Leads | Projects | Time | Ideas | Notes | Recorder | Demo; Blog, Links and SEO sit on the right (before the music player).',
  'guide.nav1': 'Leads — Salesforce-style CRM for potential clients',
  'guide.nav2': 'Projects — Monday-style boards for delivery work',
  'guide.nav3': 'Time — Clockify-style timers, logs, and reports',
  'guide.nav4': 'Ideas — MindMeister-style maps for brainstorming',
  'guide.nav5': 'Notes — research documents with sections, clickable links, and ChatGPT assist',
  'guide.nav6':
    'Recorder — Record / Screenshot / Library: video or PNG capture, voice & appearance, edit with trim/blur/music, share at /r/…',
  'guide.nav7':
    'Demo — catalogue of private client demos (e.g. ICM) not on the public homepage',
  'guide.nav8':
    'Blog — write/publish Journal posts, moderate verified comments, manage blog emails',
  'guide.nav9':
    'Links — shared library of useful channels, pages, forums, and posts (filter by type)',
  'guide.nav10': 'SEO — content inventory, search upgrades, and analytics (live traffic when signed in; sample data in demo)',
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
  'guide.start5':
    'ChatGPT lead assist (+ Add lead): copy prompt → research in ChatGPT → paste JSON → Load into form',
  'guide.pipeHeading': 'Working the pipeline',
  'guide.pipe1': 'Select a lead in the left list to open its detail panel',
  'guide.pipe2':
    'Update stage as you progress: New → Contacted → Qualified → Proposal → Negotiation → Closed Won / Lost',
  'guide.pipe3': 'Change Hot / Warm / Cold anytime as interest shifts',
  'guide.pipe4': 'Edit details, offer text, and notes as conversations evolve',
  'guide.pipe5':
    'Copy as text — export the full lead (contact, outreach, activities) for ChatGPT or email drafts',
  'guide.outreachHeading': 'Outreach & email conversation',
  'guide.outreachText':
    'Mail still lives in Proton. The CRM drafts, sends, and mirrors the lead thread so you can correspond without leaving /client-login.',
  'guide.outreach1':
    'Initial outreach: draft subject/body on the lead (or via ChatGPT JSON), Preview formatted email, then Send from CRM (Proton SMTP). You will also see it in Proton Sent',
  'guide.outreach2':
    'Email conversation (below): full Sent / Received timeline. Use Compose reply for follow-ups — preview shows only that reply, never the initial draft by mistake',
  'guide.outreach3':
    'Client replies: Proton keeps the real Inbox. A keep-copy forward to Resend mirrors them into CRM automatically. Until then (or for one-offs), use Log client reply',
  'guide.outreach4':
    'Matching: CRM attaches inbound mail by reply thread (In-Reply-To) or by the sender matching the lead’s email addresses',
  'guide.outreach5':
    'List badges show Email pending / Email sent / Priority. Stage filter “Not contacted” lists leads with no initial email sent yet. Activity log still records calls, meetings, and notes — the email thread is the source of truth for correspondence',
  'guide.outreach6':
    'Priority on a lead queues it for outreach (does not expire at midnight). Click the Priority stats pill to focus that list; it clears when you mark the initial email sent, or tap Priority again. Mistaken Sent? Use Mark as not sent on the outreach panel',
  'guide.outreachDemoText':
    'In the public demo, sending is simulated (no Proton / Resend). Explore the fictional Email conversation and try Compose reply or Log client reply safely.',
  'guide.outreachDemo1':
    'Open Copper Lantern Museums (negotiation) — it already has a Sent message and a sample Received client reply',
  'guide.outreachDemo2':
    'Harbor & Pine is Priority + Email pending — try the Priority stats pill and stage filter Not contacted',
  'guide.outreachDemo3':
    'Initial outreach: Preview and Send from CRM update the lead and thread with fake data only — nothing is delivered',
  'guide.outreachDemo4':
    'Email conversation → Compose reply: write a follow-up; preview shows only that reply. Send reply logs another outbound message in the demo thread',
  'guide.outreachDemo5':
    'Log client reply or Reset sample data (banner) to restore the original demo leads and Copper Lantern thread',
  'guide.calendarHeading': 'Stats & follow-up calendar',
  'guide.calendarText':
    'Compact stats and a collapsible calendar on the Leads tab help you focus on what matters today.',
  'guide.calendar1':
    'Stats pills: Visible, Open, Hot, and Priority (click Priority to show only queued leads)',
  'guide.calendar2':
    'Follow-up calendar starts collapsed — click the pill to expand, pick a date to filter leads',
  'guide.calendar3':
    'Days with follow-ups show a dot; clear the date filter to see all leads again',
  'guide.commHeading': 'Activity log',
  'guide.commText':
    'Use the activity panel for calls, meetings, notes, and tasks. Full email bodies live in Email conversation above — not only as short activity stubs.',
  'guide.comm1':
    'On a lead, log a Call, Meeting, Note, or Task (and optional Email notes) in the activity panel',
  'guide.comm2': 'Add a short subject and optional body so the timeline stays useful',
  'guide.comm3': 'Review past activity on the same lead before your next outreach',
  'guide.findHeading': 'Search & filters',
  'guide.find1': 'Search by company, contact, or email in the top bar',
  'guide.find2':
    'Filter by stage (including Not contacted), temperature (Hot / Warm / Cold), and who added the lead',
  'guide.find3':
    'Sort by last updated, who added, or pipeline stage; use stats pills and the follow-up calendar to filter by date',
  'guide.chatgptHeading': 'ChatGPT assist',
  'guide.chatgptText':
    'Speed up research with copy-paste ChatGPT workflows — no API key in the CRM; you run ChatGPT yourself.',
  'guide.chatgpt1':
    'Add lead: ChatGPT lead assist builds company, contact, outreach email, Atlas scores, and more from one JSON paste',
  'guide.chatgpt2':
    'Notes (Edit mode): ChatGPT note assist generates title + body with ## sections for artist/lead research lists',
  'guide.chatgpt3':
    'Copy as text on a lead exports everything for pasting into ChatGPT when you need a fresh analysis',
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
  'guide.notesHeading': 'Notes',
  'guide.notesText':
    'Research notebooks for lists you monitor over time — artists, venues, competitors, warm intros.',
  'guide.notes1':
    'Notes tab → + New note; optionally link to a lead or project',
  'guide.notes2':
    'Edit / Preview: URLs become clickable; use ## Section title for each person or topic',
  'guide.notes3':
    'Preview shows an On this page index when you have 2+ sections — jump without scrolling',
  'guide.notes4':
    'ChatGPT note assist (Edit): copy prompt, paste JSON, Load into note — review in Preview, then autosave',
  'guide.notes5':
    'Format: intro paragraph, then ## Name, URL on next line, then your monitoring notes per section',
  'guide.recordingsHeading': 'Recorder',
  'guide.recordingsText':
    'Capture screen video or still screenshots, optionally with mic, camera PiP, voice presets / AI morph, and appearance modes — then save locally or online and share with a password.',
  'guide.recordings1':
    'Record tab → mic/camera, voice, appearance, local vs online → Start, pick a screen/window, Pause to change tab/screen, then Stop',
  'guide.recordings2':
    'Screenshot tab → title + Save to → Capture screenshot (tab/window/screen) → PNG lands in Library',
  'guide.recordings3':
    'Library → Edit videos (trim, blur, volume, IOM music bed or upload) · screenshots skip the video editor',
  'guide.recordings4':
    'Copy lasting image URL for blog covers/markdown, or /r/… share link / embed for video; optional password',
  'guide.recordings5':
    'Online files stay on Cloudflare R2 until you delete them — lasting image URLs and /r/… share pages keep working',
  'guide.recordingsDemoText':
    'In the public demo, Record and Screenshot work in this browser only. Online save, share links, and lasting /r/… pages need the live CRM.',
  'guide.recordingsDemo1':
    'Try Record and Screenshot — files appear under Library (local) and download to your device',
  'guide.recordingsDemo2':
    'Pause while recording to change screen/tab, then Resume — same as live CRM',
  'guide.recordingsDemo3':
    'Edit local videos (trim / blur / music from IOM tracks). Online save is disabled in demo',
  'guide.recordingsDemo4':
    'Sign in at /client-login for online Library, share links, and images you can send for blogs',
  'guide.demosHeading': 'Demo (private client sites)',
  'guide.demosText':
    'A short catalogue of demos built for clients that stay off the public portfolio — open links, share passwords, track pitch status.',
  'guide.demos1':
    'ICM is the first entry: https://iobjectm.com/demo/icm (password in the card)',
  'guide.demos2':
    'Use Open demo for the live URL; Open on this site for the same path on the current host',
  'guide.demos3':
    'Add more client demos here as you build them — they should not appear in the public Experiments list',
  'guide.blogHeading': 'Blog (IOM Journal)',
  'guide.blogText':
    'Author public Journal posts from CRM, moderate comments that require a verified email (never shown on the site), and keep a separate Blog email list — not the same as sales Leads.',
  'guide.blog1':
    'Posts — draft or publish Markdown articles with slug, excerpt, SEO title/description, tags, and cover URL',
  'guide.blog2':
    'Link into demos and /#contact for SEO; required excerpt powers listings and meta',
  'guide.blog3':
    'Comments — readers confirm email via magic link; first comments wait for Approve / Reject / Spam',
  'guide.blog4':
    'Emails — verified commenters land here; marketing opt-in only if they checked the box',
  'guide.blog5':
    'Public /blog stays Coming soon until you set BLOG_PUBLIC_ENABLED = true in src/blog/publicFlags.ts and redeploy',
  'guide.blogDemoText':
    'In this demo, Blog uses fictional posts, comments, and emails only. Reset sample data restores them. Nothing is published to the live Journal.',
  'guide.blogDemo1':
    'Open Blog → Posts: sample published articles plus a draft (WebGPU particles)',
  'guide.blogDemo2':
    'Comments tab: try Approve on Pending moderation; filter Spam / Pending email verify',
  'guide.blogDemo3':
    'Emails tab: commenter list + a manually added press contact; notes are editable',
  'guide.blogDemo4':
    'Add sample comment creates a new pending item on a published post',
  'guide.blogDemo5':
    'View opens /blog/… locally; production Journal stays Coming soon until staff enable it',
  'guide.linksHeading': 'Links (shared library)',
  'guide.linksText':
    'A private bookmark shelf for both of you — YouTube channels, webpages, forums, and interesting blog posts, grouped by type with a short “why keep this” note.',
  'guide.links1':
    'Open Links (right tools group, between Blog and SEO) to browse the shared library',
  'guide.links2':
    'Filter by type: YouTube, Webpage, Forum, Blog post — or search title, note, and tags',
  'guide.links3':
    'Use + Add link for title, URL, type, and optional note; Copy / Open / Remove on each row',
  'guide.links4':
    'Keep categories few and notes short — shared staff storage uses Supabase when the useful-links table is installed, otherwise this browser',
  'guide.linksDemoText':
    'In this demo, Links starts with sample bookmarks. You can add and remove freely; Reset sample data restores the original sample list.',
  'guide.linksDemo1':
    'Open Links — sample YouTube, webpage, forum, and blog bookmarks are already filled in',
  'guide.linksDemo2':
    'Try + Add link, then filters and search; Remove deletes a row after confirm',
  'guide.linksDemo3':
    'Copy or Open any link — real public pages open in a new tab',
  'guide.linksDemo4':
    'Reset sample data restores the original sample Links list (your demo adds/removes are cleared)',
  'guide.seoHeading': 'SEO & analytics',
  'guide.seoText':
    'The SEO tab tracks site content readiness and visitor traffic — the same tools staff use after login.',
  'guide.seo1':
    'Review SEO targets, upgrade checklist, and content inventory for the public site',
  'guide.seo2':
    'Analytics: pageviews, sources, keywords, devices, countries, and a globe of visitor cities',
  'guide.seo3':
    'Signed-in CRM uses live site analytics; the public demo shows realistic fake sample traffic only',
  'guide.seoDemoText':
    'In this demo, SEO shows sample content inventory and fake visitor traffic only — not live iobjectm.com analytics.',
  'guide.seoDemo1':
    'Browse SEO targets, upgrade checklist, and content inventory with sample readiness data',
  'guide.seoDemo2':
    'Analytics pane: sample pageviews, sources, keywords, devices, countries, and visitor globe',
  'guide.seoDemo3':
    'Reset sample data restores the fake traffic set; signed-in CRM uses live analytics instead',
  'guide.photoHeading': 'Profile photo',
  'guide.photo1': 'Click your avatar or email in the top bar to open your photo menu',
  'guide.photo2':
    'Crop to a circle, compress, then upload, change, or remove your staff profile picture',
  'guide.photo3':
    'Your photo appears next to leads you add; updating it refreshes your existing leads',
  'guide.uiHeading': 'Help & language',
  'guide.ui1':
    'Help (header, next to Sign out) reopens this guide anytime',
  'guide.ui2':
    'Flag button: staff CRM switches English ↔ Serbian; the public demo offers EN · DE · NL · FR · IT',
  'guide.hint':
    'Tabs: Leads · Projects · Time · Ideas · Notes · Demo — Blog · Links · SEO on the right. Help reopens this guide. Flag switches language.',
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
  'stats.priority': 'Prioritet',
  'stats.priorityFilter': 'Prikaži prioritetne leadove',
  'stats.priorityFilterClear': 'Ukloni filter prioriteta',

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
  'toolbar.notContacted': 'Nije kontaktiran',
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
  'error.contactPrioritySchemaMissing':
    'Prioritetni red se neće sačuvati dok ne pokrenete crm_lead_contact_priority_migration.sql u Supabase → SQL Editor, pa hard-refresh.',
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
    'Interaktivni uzorak sa izmišljenim firmama. Isprobajte Email konverzaciju (npr. Copper Lantern), Blog (članci / komentari / emailovi) i Zabeleži odgovor klijenta — sve je simulacija u ovom pregledaču. Ništa ne dira žive klijente ni prave sandučiće.',
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
  'list.priority': 'Prioritet',
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
  'detail.priority': 'Prioritet',
  'detail.prioritySet': 'Dodaj u prioritetni red',
  'detail.priorityClear': 'Ukloni iz prioritetnog reda',
  'detail.priorityFailed': 'Ažuriranje prioritetnog reda nije uspelo.',
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
  'nav.notes': 'Beleške',
  'nav.recordings': 'Snimač',
  'nav.blog': 'Blog',
  'nav.links': 'Linkovi',
  'nav.demos': 'Demo',
  'nav.seo': 'IOM-SEO',
  'nav.toolsAria': 'Blog, Linkovi i SEO',

  'recorder.tab.record': 'Snimanje',
  'recorder.tab.screenshot': 'Screenshot',
  'recorder.tab.library': 'Biblioteka',
  'recorder.screenshot.intro':
    'Uhvatite tab, prozor ili ekran kao PNG. Sačuvajte online (Cloudflare R2 — fajlovi ostaju dok ih ne obrišete). Zatim u Blog → Priložene slike koristite Zameni / Ubaci sa Kopiraj trajni URL slike ili /r/… share linkom. Isto važi za video iz Snimanje — nalepite /r/… share link u telo članka.',
  'recorder.screenshot.capture': 'Uhvati screenshot',
  'recorder.screenshot.capturing': 'Hvatanje…',
  'recorder.screenshot.uploading': 'Čuvanje screenshot-a…',
  'recorder.screenshot.done': 'Screenshot sačuvan.',
  'recorder.screenshot.preview': 'Poslednji screenshot',
  'recorder.screenshot.error':
    'Nije moguće uhvatiti screenshot. Dozvolite deljenje ekrana i pokušajte ponovo.',
  'recorder.kind.video': 'Video',
  'recorder.kind.image': 'Screenshot',
  'recorder.copyImageUrl': 'Kopiraj trajni URL slike',
  'recorder.copyImageUrlHint':
    'Trajni link za Blog naslovne i Markdown — fajl na Cloudflare R2 ostaje dok ga ne obrišete. Nalepite u Blog → Priložene slike → Zameni / URL naslovne.',
  'recorder.intro':
    'Snimite video ili uhvatite screenshot. Mikrofon, kamera PiP, glasovni preseti ili AI morf, statični/avatar izgled — sačuvajte lokalno ili online (Cloudflare R2) i podelite linkom sa lozinkom (/r/…).',
  'recorder.introDemo':
    'Demo sandbox — snimci i screenshot-ovi ostaju samo u ovom pregledaču. Online čuvanje i trajni share linkovi zahtevaju live CRM (/client-login).',
  'recorder.onlinePersistHint':
    'Online fajlovi su na Cloudflare R2 i ne brišu se sami. Za blog koristite Kopiraj trajni URL slike ili /r/… share link — privremeni R2 potpisani linkovi ističu za nekoliko sati.',
  'recorder.start': 'Počni snimanje',
  'recorder.stop': 'Zaustavi',
  'recorder.pause': 'Pauza',
  'recorder.resume': 'Nastavi',
  'recorder.changeScreen': 'Promeni ekran / tab',
  'recorder.changeScreen.hint':
    'Dok je pauzirano možete preći na drugi tab, prozor ili ekran, pa nastaviti snimanje.',
  'recorder.changeScreen.busy': 'Čeka se izbor ekrana…',
  'recorder.changeScreen.failed':
    'Nije moguće promeniti ekran. Zadržite trenutni ili pokušajte ponovo.',
  'recorder.float.title': 'IOM Snimač',
  'recorder.float.open': 'Lebdeće kontrole',
  'recorder.float.hint':
    'Posle Počni kliknite Lebdeće kontrole za panel Pauza / Kamera / Zaustavi (potreban je klik — nije automatski).',
  'recorder.float.cameraOn': 'Kamera PiP uključena',
  'recorder.float.cameraOff': 'Kamera PiP isključena',
  'recorder.float.blocked':
    'Lebdeće kontrole nisu otvorene (dozvolite iskačuće prozore). Pauza i Zaustavi i dalje rade u CRM kartici.',
  'recorder.error.shareEnded':
    'Deljenje ekrana je prekinuto. Snimanje je zaustavljeno — kliknite Počni da snimate ponovo.',
  'recorder.error.emptyRecording':
    'Snimak izgleda zamrznuto ili prazno (često jer ste napustili CRM karticu). Držite karticu snimača vidljivom ili koristite Lebdeće kontrole, pa pokušajte ponovo.',
  'recorder.error.tabHidden':
    'CRM kartica je u pozadini — držite je vidljivom (ili Lebdeće kontrole) da se snimak ne zamrzne na jednom kadru.',
  'recorder.mic': 'Mikrofon',
  'recorder.shareAudio': 'Audio taba / sistema',
  'recorder.shareAudioHint':
    'Snima zvuk deljenog taba ili ekrana (YouTube, demo…). U Chrome-u izaberite tab i uključite „Also share tab audio”.',
  'recorder.shareAudio.missing':
    'Tražen je audio taba, ali nije deljen. Zaustavite i krenite ponovo — izaberite Chrome tab i čekirajte „Also share tab audio”.',
  'recorder.camera': 'Kamera (PiP)',
  'recorder.noise': 'Suzbijanje šuma',
  'recorder.noiseHint':
    'Koristi filter šuma pregledača (najbolje Chrome/Edge). Isključite ako muzika ili ambijent zvuče prigušeno.',
  'recorder.hud.micOn': 'Mic uključen',
  'recorder.hud.micOff': 'Mic isključen',
  'recorder.hud.shareAudioOn': 'Audio taba uključen',
  'recorder.hud.shareAudioOff': 'Audio taba isključen',
  'recorder.hud.cameraOn': 'Kamera uključena',
  'recorder.hud.cameraOff': 'Kamera isključena',
  'recorder.hud.noAvatar': 'Bez avatara',
  'recorder.hud.live': 'SNIMA',
  'recorder.warn.inputsOff':
    '{items} su isključeni. Nastaviti bez njih?\n\nSavet: uključite Mikrofon za svoj glas, i Audio taba / sistema za YouTube ili demo zvuk (Chrome: „Also share tab audio”).',
  'recorder.voice': 'Glas',
  'recorder.voice.natural': 'Prirodan',
  'recorder.voice.deep': 'Dubok',
  'recorder.voice.high': 'Viši',
  'recorder.voice.robot': 'Robot',
  'recorder.voice.ai': 'AI morf (ElevenLabs)',
  'recorder.voice.aiPick': 'AI glas',
  'recorder.voice.aiLoading': 'Učitavanje glasova…',
  'recorder.voice.aiEmpty': 'Nema glasova',
  'recorder.voice.aiHint':
    'AI morf se primenjuje posle zaustavljanja. Besplatni ElevenLabs ne može da koristi library glasove — izaberite klonirani/kreirani glas ili nadogradite plan.',
  'recorder.voice.aiLibraryTag': 'library — potreban plaćeni plan',
  'recorder.voice.aiOwnedHint':
    'Nema kloniranih glasova na ovom ElevenLabs nalogu. Klonirajte glas na elevenlabs.io ili nadogradite plan za library glasove.',
  'recorder.voice.aiUnavailable': 'AI morf nije dostupan (nema API ključa). Koristi se samo preset.',
  'recorder.voice.aiFailedKeep':
    'AI morf glasa nije uspeo — sačuvan je originalni zvuk. ({detail})',
  'recorder.appearance': 'Izgled',
  'recorder.appearance.none': 'Bez avatara',
  'recorder.appearance.real': 'Prava kamera',
  'recorder.appearance.filters': 'Filteri',
  'recorder.appearance.avatar': 'Avatar (animirani)',
  'recorder.appearance.static': 'Statična slika',
  'recorder.appearance.staticHint':
    'Prikazuje fiksnu fotografiju ili logo u uglu — kamera nije potrebna. Podrazumevano je IOM gavran; otpremite svoju ili koristite CRM profilnu.',
  'recorder.appearance.staticIomRaven': 'IOM gavran',
  'recorder.appearance.staticUpload': 'Otpremi sliku',
  'recorder.appearance.staticUseProfile': 'Koristi profilnu',
  'recorder.appearance.staticClear': 'Obriši',
  'recorder.appearance.staticEmpty': 'Nema slike',
  'recorder.appearance.staticMissing': 'Izaberite statičnu sliku pre snimanja.',
  'recorder.appearance.staticBadType': 'Izaberite PNG, JPEG, WebP ili GIF sliku.',
  'recorder.appearance.staticTooLarge': 'Slika je prevelika. Probajte manju (ispod ~700 KB).',
  'recorder.appearance.staticNoProfile': 'Nema CRM profilne fotografije. Otpremite je u gornjoj traci ili izaberite fajl.',
  'recorder.hud.staticOn': 'Statično uklj.',
  'recorder.hud.staticOff': 'Statično isklj.',
  'recorder.blur.tool': 'Alat za zamućenje',
  'recorder.blur.strength': 'Jačina zamućenja',
  'recorder.blur.light': 'Slabo',
  'recorder.blur.medium': 'Srednje',
  'recorder.blur.strong': 'Jako',
  'recorder.blur.hint':
    'Prevucite po pregledu da zamutite oblasti. Kutije tokom snimanja ulaze u fajl; posle zaustavljanja koristite Primeni zamućenje.',
  'recorder.blur.count': '{n} oblast(i) zamućenja',
  'recorder.blur.undo': 'Poništi poslednje',
  'recorder.blur.clear': 'Obriši kutije',
  'recorder.blur.applyPost': 'Primeni zamućenje na snimak',
  'recorder.blur.applying': 'Primena zamućenja…',
  'recorder.edit': 'Izmeni',
  'recorder.edit.title': 'Izmena snimka',
  'recorder.edit.cancel': 'Zatvori',
  'recorder.edit.trimStart': 'Početak isečka',
  'recorder.edit.trimEnd': 'Kraj isečka',
  'recorder.edit.trimRange': 'Zadrži {range}',
  'recorder.edit.volume': 'Jačina zvuka',
  'recorder.edit.mute': 'Bez zvuka',
  'recorder.edit.music': 'Pozadinska muzika',
  'recorder.edit.musicNone': 'Bez muzike',
  'recorder.edit.musicCatalog': 'Numere sa IOM sajta',
  'recorder.edit.musicUpload': 'Otpremi audio fajl',
  'recorder.edit.musicTrack': 'Numera',
  'recorder.edit.musicVolume': 'Nivo muzike',
  'recorder.edit.musicHint':
    'Muzika se meša ispod glasa na {pct}%. Ugasite originalni zvuk za samo muziku. Pregled ide uz video.',
  'recorder.edit.musicChooseFile': 'Izaberi audio…',
  'recorder.edit.musicReplace': 'Zameni fajl…',
  'recorder.edit.musicClear': 'Obriši',
  'recorder.edit.musicBadType': 'Izaberite audio fajl (mp3, wav, itd.).',
  'recorder.edit.musicMissingUpload': 'Prvo izaberite audio fajl za otpremanje.',
  'recorder.edit.musicMissingTrack': 'Nije izabrana IOM numera.',
  'recorder.edit.blurHint':
    'Prevucite po videu da dodate kutije zamućenja. Primena je pri čuvanju ili preuzimanju.',
  'recorder.edit.encoding': 'Enkodiranje… {pct}%',
  'recorder.edit.saving': 'Čuvanje…',
  'recorder.edit.save': 'Sačuvaj online',
  'recorder.edit.applyLocal': 'Primeni u biblioteci',
  'recorder.edit.slowHint':
    'Koristi offline WebCodecs kodiranje kada je dostupno (često mnogo brže od realnog vremena na jakom PC-u). Ako zatreba, pada na real-time encode.',
  'recorder.edit.loading': 'Učitavanje…',
  'recorder.edit.loadFailed': 'Nije moguće učitati snimak za izmenu.',
  'recorder.edit.error': 'Izmena nije uspela. Pokušajte ponovo.',
  'recorder.destination': 'Sačuvaj',
  'recorder.destination.local': 'Preuzmi lokalno',
  'recorder.destination.online': 'Sačuvaj online',
  'recorder.destination.onlineDemo': 'Online čuvanje treba live CRM',
  'recorder.title': 'Naslov',
  'recorder.titlePlaceholder': 'Naslov snimka ili screenshot-a',
  'recorder.preview': 'Pregled',
  'recorder.status.idle': 'Spremno',
  'recorder.status.recording': 'Snimanje…',
  'recorder.status.paused': 'Pauzirano',
  'recorder.status.processing': 'Obrada…',
  'recorder.status.uploading': 'Otpremanje…',
  'recorder.error.screen': 'Nije moguće snimiti ekran. Dozvolite deljenje i pokušajte ponovo.',
  'recorder.error.mic': 'Nije moguće pristupiti mikrofonu.',
  'recorder.error.camera': 'Nije moguće pristupiti kameri.',
  'recorder.error.save': 'Nije moguće sačuvati snimak.',
  'recorder.error.upload': 'Nije moguće otpremiti snimak.',
  'recorder.error.tooLarge':
    'Online čuvanje nije uspelo — fajl je {mb} MB (preko limita 512 MB). Lokalna kopija je preuzeta. Snimite kraće.',
  'recorder.library.empty': 'Još nema snimaka.',
  'recorder.library.loading': 'Učitavanje snimaka…',
  'recorder.library.schemaMissing':
    'Skladište snimaka nije podešeno. Pokrenite supabase/crm_recordings_migration.sql u Supabase SQL Editoru.',
  'recorder.library.local': 'Ova sesija (lokalno)',
  'recorder.library.online': 'Online (Cloudflare R2)',
  'recorder.uploadOnline': 'Otpremi online',
  'recorder.uploadOnline.busy': 'Otpremanje…',
  'recorder.uploadOnline.tooLarge':
    'Fajl je {mb} MB — preko limita 512 MB. Zadržite lokalno / preuzmite, ili skratite snimak.',
  'recorder.uploadAll': 'Otpremi sve online',
  'recorder.uploadAll.busy': 'Otpremanje svega…',
  'recorder.uploadAll.tooLarge':
    'Preskočeno “{title}” ({mb} MB) — preko online limita. Ostalo se može otpremiti.',
  'recorder.manualUpload': 'Otpremi video',
  'recorder.manualUpload.busy': 'Otpremanje…',
  'recorder.manualUpload.hint':
    'Izaberite WebM, MP4 ili MOV sa računara. Live CRM čuva Online; demo ostaje u ovoj sesiji.',
  'recorder.manualUpload.invalid': 'Izaberite video fajl (WebM, MP4 ili MOV).',
  'recorder.manualImage': 'Otpremi sliku',
  'recorder.manualImage.busy': 'Otpremanje…',
  'recorder.manualImage.hint':
    'Ili otpremite PNG, JPEG, WebP ili GIF sa računara (koristi Naslov + Sačuvaj u iznad).',
  'recorder.manualImage.invalid':
    'Izaberite sliku (PNG, JPEG, WebP ili GIF).',
  'recorder.download': 'Preuzmi',
  'recorder.delete': 'Obriši',
  'recorder.deleteConfirm': 'Obrisati „{title}“?',
  'recorder.copyShare': 'Kopiraj share link',
  'recorder.copyEmbed': 'Kopiraj embed kod',
  'recorder.copied': 'Kopirano',
  'recorder.setPassword': 'Postavi lozinku',
  'recorder.clearPassword': 'Ukloni lozinku',
  'recorder.passwordPlaceholder': 'Lozinka za deljenje',
  'recorder.passwordSaved': 'Lozinka sačuvana',
  'recorder.openShare': 'Otvori share stranicu',
  'recorder.duration': 'Trajanje',
  'recorder.size': 'Veličina',
  'share.title': 'Podeljeni snimak',
  'share.password': 'Lozinka',
  'share.unlock': 'Otključaj',
  'share.wrongPassword': 'Pogrešna lozinka',
  'share.notFound': 'Snimak nije pronađen',
  'share.loading': 'Učitavanje…',
  'share.locked': 'Ovaj snimak je zaštićen lozinkom.',

  'links.kicker': 'Zajednička biblioteka resursa',
  'links.kickerDemo': 'Uzorak biblioteke resursa',
  'links.title': 'Linkovi',
  'links.intro':
    'Korisni YouTube kanali, veb stranice, forumi i blog postovi koje želimo da imamo pri ruci. Dodajte svoje, filtrirajte po tipu, pretražite — kratka napomena čuva zašto je link važan.',
  'links.introDemo':
    'Uzorak bookmarkova za javni CRM demo — slobodno dodajte, uklonite, pretražite i filtrirajte. Reset uzoraka vraća originalnu listu.',
  'links.open': 'Otvori',
  'links.copy': 'Kopiraj',
  'links.copied': 'Kopirano',
  'links.remove': 'Ukloni',
  'links.add': '+ Dodaj link',
  'links.cancelAdd': 'Otkaži',
  'links.save': 'Sačuvaj link',
  'links.saving': 'Čuvanje…',
  'links.loading': 'Učitavanje linkova…',
  'links.loadFailed': 'Nije moguće učitati linkove.',
  'links.createFailed': 'Nije moguće dodati link.',
  'links.deleteFailed': 'Nije moguće ukloniti link.',
  'links.deleteConfirm': 'Ukloniti „{name}“ iz Linkova?',
  'links.form.title': 'Naslov',
  'links.form.url': 'https://…',
  'links.form.category': 'Tip',
  'links.form.note': 'Zašto čuvamo? (opciono)',
  'links.empty': 'Još nema linkova u ovoj kategoriji.',
  'links.emptySearch': 'Nema linkova za tu pretragu.',
  'links.searchPlaceholder': 'Pretraži naslov, napomenu, tag…',
  'links.searchAria': 'Pretraži linkove',
  'links.filtersAria': 'Filtriraj linkove po tipu',
  'links.filter.all': 'Sve',
  'links.category.youtube': 'YouTube',
  'links.category.webpage': 'Veb stranica',
  'links.category.forum': 'Forum',
  'links.category.blog': 'Blog post',

  'demos.kicker': 'Privatni demoi za klijente',
  'demos.title': 'Demo',
  'demos.intro':
    'Demoi koje gradimo za klijente, a nisu na javnom sajtu. Linkovi sa lozinkom za pitch i pregled.',
  'demos.open': 'Otvori demo',
  'demos.openLocal': 'Otvori na ovom sajtu',
  'demos.preview': 'Pregled',
  'demos.url': 'Vebsajt',
  'demos.password': 'Lozinka',
  'demos.gallery': 'Slike sa ovog demoa',
  'demos.expand': 'Proširi',
  'demos.collapse': 'Skupi',
  'demos.expandAria': 'Proširi demo {name}',
  'demos.collapseAria': 'Skupi demo {name}',
  'demos.status.preview': 'Pregled',
  'demos.status.draft': 'Nacrt',
  'demos.status.live': 'Uživo',

  'seo.kicker': 'Veb sajt',
  'seo.title': 'SEO i saobraćaj',
  'seo.intro':
    'Vidljivost u pretrazi, ciljne fraze i analitika bez kolačića za iobjectm.com — proširite registar pri novom sadržaju.',
  'seo.openSite': 'Otvori iobjectm.com',
  'seo.sitemap': 'Sitemap',
  'seo.schemaMissing':
    'Tabele analitike nisu pronađene — pokrenite supabase/site_analytics_migration.sql u Supabase projektu.',
  'seo.trafficTitle': 'Pregled saobraćaja',
  'seo.rangeAria': 'Vremenski opseg',
  'seo.range.7d': '7 dana',
  'seo.range.30d': '30 dana',
  'seo.range.90d': '90 dana',
  'seo.loading': 'Učitavanje analitike…',
  'seo.pageviews': 'Pregledi stranica',
  'seo.visitors': 'Posetioci',
  'seo.humans': 'Ljudi',
  'seo.bots': 'Krawleri / botovi',
  'seo.bounce': 'Stopa odbijanja',
  'seo.pagesPerSession': 'Stranice / sesija',
  'seo.avgTime': 'Prosečno vreme na strani',
  'seo.liveVisitors': 'Uživo (30 min)',
  'seo.globeTitle': 'Mapa posetilaca',
  'seo.globeBlurb': 'Globus u realnom vremenu — svetlije tačke su posete u poslednjih 30 minuta.',
  'seo.globeLoading': 'Učitavanje globusa…',
  'seo.topCountries': 'Najčešće zemlje',
  'seo.noGeo': 'Još nema lokacija — nove posete će se pojaviti posle geo migracije.',
  'seo.dailyTrend': 'Dnevni pregledi',
  'seo.topPages': 'Najposećenije stranice',
  'seo.topReferrers': 'Izvori saobraćaja',
  'seo.topSources': 'Kako vas nalaze',
  'seo.topSourcesNote': 'UTM, pretraga, društvene mreže i referral.',
  'seo.noSources': 'Još nema podataka o akviziciji.',
  'seo.topKeywords': 'Ključne reči',
  'seo.topKeywordsNote': 'Iz utm_term / search referrera. Google organske → Search Console.',
  'seo.noKeywords': 'Još nema ključnih reči — dodajte ?utm_term=… na kampanje.',
  'seo.topLinks': 'Otvoreni linkovi',
  'seo.topLinksNote': 'Interni i spoljni klikovi sa vaših stranica.',
  'seo.noLinks': 'Još nema klikova na linkove.',
  'seo.devices': 'Uređaji',
  'seo.noReferrers': 'Još nema referrera.',
  'seo.noPages': 'Još nema stranica.',
  'seo.noDevices': 'Još nema podataka o uređajima.',
  'seo.demoNote': 'Uzorak podataka — demo režim ne beleži stvarni saobraćaj.',
  'seo.noData': 'Nema saobraćaja za izabrani period.',
  'seo.upgradesTitle': 'Registar SEO unapređenja',
  'seo.upgradesBlurb':
    'Pratite završene i planirane SEO zadatke. Dodajte red u src/seo/registry.ts pri svakom unapređenju.',
  'seo.upgradeDone': '{n} završeno',
  'seo.upgradePending': '{n} na čekanju',
  'seo.upgradePlanned': '{n} planirano',
  'seo.targetsTitle': 'Ciljne ključne reči',
  'seo.targetsBlurb': 'Prioritetne fraze povezane sa javnim stranicama i sekcijama portfolia.',
  'seo.contentTitle': 'Inventar sadržaja',
  'seo.contentBlurb':
    'Sekcije početne strane — ažurirajte src/data/projects.ts i rebuild za osvežavanje sitemap-a.',
  'seo.projects': 'projekata',

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

  'notes.kicker': 'Istraživačke beleške',
  'notes.create': '+ Nova beleška',
  'notes.newPlaceholder': 'Naslov beleške…',
  'notes.titlePlaceholder': 'Naslov beleške',
  'notes.bodyPlaceholder':
    'Koristite ## Naslov sekcije za skokove u Pregledu. Ime u jednom redu + URL u sledećem, ili slobodan tekst…',
  'notes.editHint': 'Koristite ## Naslov sekcije za skokove · Izmene se automatski čuvaju',
  'notes.previewHint': 'Kliknite Proširi za pregled · Sekcije se skupljaju unutar pregleda',
  'notes.tocLabel': 'Na ovoj stranici',
  'notes.tocCount': '{count} sekcija',
  'notes.tocAria': 'Sekcije beleške',
  'notes.linkLead': 'Poveži sa leadom',
  'notes.linkProject': 'Poveži sa projektom',
  'notes.noLead': 'Bez leada',
  'notes.noProject': 'Bez projekta',
  'notes.loading': 'Učitavanje beleški…',
  'notes.empty':
    'Još nema istraživačkih beleški. Kreirajte za liste umetnika, istraživanje tržišta ili ideje za follow-up.',
  'notes.select': 'Izaberite belešku ili kreirajte novu.',
  'notes.loadFailed': 'Učitavanje beleški nije uspelo.',
  'notes.createFailed': 'Kreiranje beleške nije uspelo.',
  'notes.saveFailed': 'Čuvanje beleške nije uspelo.',
  'notes.deleteFailed': 'Brisanje beleške nije uspelo.',
  'notes.untitled': 'Beleška bez naziva',
  'notes.noBody': 'Prazna beleška',
  'notes.deleteConfirm': 'Obrisati belešku „{name}”?',
  'notes.edit': 'Izmena',
  'notes.preview': 'Pregled',
  'notes.saving': 'Čuvanje…',
  'notes.saved': 'Sačuvano',
  'notes.autosaveHint': 'Izmene se automatski čuvaju',
  'notes.schemaMissing':
    'Tabela za istraživačke beleške nedostaje. U Supabase → SQL Editor nalepite i pokrenite crm_research_notes_migration.sql, zatim hard-refresh.',

  'blog.schemaMissing':
    'Blog tabele nedostaju. U Supabase → SQL Editor nalepite i pokrenite blog_migration.sql, zatim hard-refresh.',
  'blog.loadFailed': 'Učitavanje bloga nije uspelo.',
  'blog.saveFailed': 'Čuvanje članka nije uspelo.',
  'blog.saveOk': 'Članak sačuvan.',
  'blog.deleteFailed': 'Brisanje članka nije uspelo.',
  'blog.moderationFailed': 'Ažuriranje komentara nije uspelo.',
  'blog.audienceFailed': 'Ažuriranje email liste nije uspelo.',
  'blog.loading': 'Učitavanje bloga…',
  'blog.tabPending': 'Na pregledu',
  'blog.tabPosts': 'Članci',
  'blog.tabComments': 'Komentari',
  'blog.tabEmails': 'Emailovi',
  'blog.pendingHint':
    'Pregledajte katalog članaka ovde. Objavi za javni /blog (kad je BLOG_PUBLIC_ENABLED uključen). Sakrij sklanja članak sa liste bez brisanja.',
  'blog.postsHint':
    'Nacrti, objavljeni i skriveni članci. Poništi objavu vraća članak u Na pregledu. Javni /blog prikazuje samo objavljene.',
  'blog.newPost': '+ Novi članak',
  'blog.importCatalog': 'Uvezi katalog ({count})',
  'blog.importCatalogDone': 'Sinhronizuj katalog',
  'blog.importing': 'Uvoz…',
  'blog.importResult':
    'Katalog: {created} novih, {updated} ažuriranih ({skipped} bez izmene).',
  'blog.importFailed': 'Uvoz kataloga nije uspeo.',
  'blog.statusFailed': 'Ažuriranje statusa nije uspelo.',
  'blog.publish': 'Objavi',
  'blog.unpublish': 'Poništi objavu',
  'blog.hide': 'Sakrij',
  'blog.restoreReview': 'Vrati na pregled',
  'blog.preview': 'Pregled',
  'blog.noPending': 'Nema na pregledu — obrađeni su pod Članci.',
  'blog.noPendingImport': 'Nema članaka na pregledu. Uvezite katalog da popunite listu.',
  'blog.demoComment': 'Dodaj demo komentar',
  'blog.untitled': 'Bez naslova',
  'blog.noPosts': 'Još nema članaka.',
  'blog.viewLive': 'Javno',
  'blog.edit': 'Izmeni',
  'blog.delete': 'Obriši',
  'blog.deleteConfirm': 'Obrisati ovaj članak i komentare?',
  'blog.backList': '← Nazad',
  'blog.save': 'Sačuvaj',
  'blog.saving': 'Čuvanje…',
  'blog.editorTip':
    'Obavezno: naslov + izvod. Markdown. Uključite interne linkove ka demou ili /#contact.',
  'blog.markdownHint':
    'Slike: ![Opis](/assets/blog/slug/hero.jpg) u posebnom redu. Linkovi: [tekst](/demos/…) ili https://… Naslovna: /assets/blog/<slug>/cover.jpg. Screenshot iz Snimača: nalepite Kopiraj trajni URL slike u Priložene slike. Video iz Snimača: nalepite /r/… share link u tekst.',
  'blog.coverHint':
    'Preferirajte assete pod /assets/blog/<slug>/ — ili trajni URL iz Snimač → Screenshot (Sačuvaj online → Kopiraj trajni URL slike). Upload još nije dostupan.',
  'blog.attachTitle': 'Priložene slike',
  'blog.attachHint':
    'Naslovna + slike iz Markdown tela. Zamenite preko URL-a, ili Upload image (živi CRM → Cloudflare R2 trajni link). Save čuva i Replace URL bez Apply. Izbegavajte privremene r2.cloudflarestorage.com linkove.',
  'blog.attachEmpty': 'Još nema slika. Dodajte URL naslovne, ili ubacite slot za sliku u tekstu.',
  'blog.attachCover': 'Naslovna',
  'blog.attachBody': 'Slika u tekstu {n}',
  'blog.attachReplace': 'Zameni',
  'blog.attachBust': 'Osveži keš',
  'blog.attachBustTitle':
    'Dodaje novi ?v= da pregledači učitaju novi fajl (samo site asseti / trajni media URL-ovi)',
  'blog.attachBustOk': 'Keš osvežen. Sačuvajte post kad ste spremni.',
  'blog.attachBustSigned':
    'Ovo je privremeni Cloudflare R2 potpisani URL — Osveži keš ga ne može popraviti (dodatni ?v= kvari potpis). Zamenite sa Snimač → Screenshot → Kopiraj trajni URL slike (/api/crm-recorder?action=media&slug=…).',
  'blog.attachSignedWarn':
    'Jedna ili više slika koristi privremene R2 potpisane linkove (ističu / pucaju ako se menjaju). Zamenite svaku sa Snimač → Kopiraj trajni URL slike.',
  'blog.previewInCrmHint':
    'Neobjavljeni postovi se pregledaju ovde u CRM-u (Preview u editoru) — nisu na javnom /blog sajtu dok ne budu Published.',
  'blog.attachNewUrl': 'URL slike',
  'blog.attachPathHint': 'Fajl na disku: {path}',
  'blog.attachApply': 'Primeni',
  'blog.attachCancel': 'Otkaži',
  'blog.attachPickFile': 'Ime fajla…',
  'blog.attachUploadFile': 'Upload slike…',
  'blog.attachUploading': 'Upload slike…',
  'blog.attachUploaded': 'Slika uploadovana na Cloudflare R2. Sačuvajte post da ostane.',
  'blog.attachUploadFailed': 'Upload slike nije uspeo.',
  'blog.attachUploadNeedAuth': 'Prijavite se u živi CRM da uploadujete slike.',
  'blog.attachUploadWait': 'Sačekajte da se upload završi, pa Sačuvaj.',
  'blog.attachFileHint':
    'URL postavljen iz imena fajla. Stavite fajl u {path}, pa Apply + Sačuvaj. (Demo nema cloud upload.)',
  'blog.attachAddCover': '+ Dodaj naslovnu',
  'blog.attachAddBody': '+ Ubaci sliku u tekst',
  'blog.attachBodyInserted':
    'Ubačena Markdown slika. Stavite fajl na {path} (ili promenite URL), pa Sačuvaj.',
  'blog.insertDemoCta': 'Ubaci demo CTA',
  'blog.bodyPane': 'Editor teksta',
  'blog.paneEdit': 'Izmena',
  'blog.panePreview': 'Pregled',
  'blog.previewEmpty': 'Još nema sadržaja za pregled.',
  'blog.fieldTitle': 'Naslov',
  'blog.fieldSlug': 'URL slug',
  'blog.fieldExcerpt': 'Izvod',
  'blog.fieldBody': 'Tekst (Markdown)',
  'blog.bodyPlaceholder':
    '## Naslov\n\nPasus sa [linkom](/demos/panorama-360/).\n\n![Pogled kamere](/assets/blog/volume-lighting/hero.jpg)',
  'blog.fieldCover': 'URL naslovne slike',
  'blog.fieldAuthor': 'Autor',
  'blog.fieldTags': 'Tagovi (zarez)',
  'blog.fieldSeoTitle': 'SEO naslov',
  'blog.fieldSeoDesc': 'SEO opis',
  'blog.fieldStatus': 'Status',
  'blog.statusDraft': 'Nacrt',
  'blog.statusPendingReview': 'Na pregledu',
  'blog.statusPublished': 'Objavljeno',
  'blog.statusHidden': 'Skriveno',
  'blog.titleRequired': 'Naslov je obavezan.',
  'blog.excerptRequired': 'Izvod je obavezan (lista + SEO).',
  'blog.filterStatus': 'Status',
  'blog.filterAll': 'Sve',
  'blog.statusPendingMod': 'Čeka moderaciju',
  'blog.statusPendingVerify': 'Čeka email verifikaciju',
  'blog.statusApproved': 'Odobreno',
  'blog.statusRejected': 'Odbijeno',
  'blog.statusSpam': 'Spam',
  'blog.approve': 'Odobri',
  'blog.reject': 'Odbij',
  'blog.spam': 'Spam',
  'blog.noComments': 'Nema komentara u ovom filteru.',
  'blog.optIn': 'marketing opt-in',
  'blog.optOut': 'bez marketinga',
  'blog.emailSearch': 'Pretraga emaila ili imena…',
  'blog.marketingOnly': 'Samo marketing opt-in',
  'blog.manualName': 'Ime',
  'blog.manualEmail': 'Email',
  'blog.addManual': 'Dodaj na listu',
  'blog.deleteAudienceConfirm': 'Ukloniti ovaj email sa liste?',
  'blog.notesPlaceholder': 'Interne beleške…',
  'blog.noEmails': 'Još nema blog emailova — pojavljuju se posle verifikacije komentara.',

  'notesChatgpt.title': 'ChatGPT pomoć za beleške',
  'notesChatgpt.blurb':
    'Kopirajte istraživački prompt u ChatGPT, nalepite JSON nazad i učitajte naslov + sekcije u ovu belešku.',
  'notesChatgpt.copyPrompt': 'Kopiraj ChatGPT prompt',
  'notesChatgpt.step1':
    'Kopirajte prompt i recite ChatGPT-u šta da istraži (npr. umetnici za praćenje, tržišna lista, lead ciljevi).',
  'notesChatgpt.step2': 'Zatražite samo JSON objekat kao odgovor.',
  'notesChatgpt.step3': 'Nalepite JSON ispod → Učitaj u belešku → prebacite na Pregled da proverite linkove i sekcije.',
  'notesChatgpt.pasteLabel': 'Nalepite ChatGPT JSON',
  'notesChatgpt.pastePlaceholder':
    'Nalepite JSON iz ChatGPT-a ovde (sa ili bez ```json ograda)…',
  'notesChatgpt.loadIntoNote': 'Učitaj u belešku',
  'notesChatgpt.loadSuccess': 'Beleška učitana — proverite u Pregledu; izmene se automatski čuvaju.',
  'notesChatgpt.copyFailed': 'Kopiranje prompta u clipboard nije uspelo.',
  'notesChatgpt.pasteEmpty': 'Prvo nalepite ChatGPT JSON.',
  'notesChatgpt.missingTitle': 'JSON mora sadržati title (naslov).',
  'notesChatgpt.missingBody': 'JSON mora sadržati body tekst ili niz sections.',
  'notesChatgpt.parseFailed': 'JSON nije parsiran — zatražite samo jedan JSON objekat.',
  'notesChatgpt.importFailed': 'Učitavanje beleške nije uspelo.',

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
  'outreach.showPreview': 'Pregled formatiranog emaila',
  'outreach.hidePreview': 'Sakrij pregled',
  'outreach.previewTitle': 'Kako će izgledati kada se pošalje',
  'outreach.markDrafted': 'Označi draft',
  'outreach.markSent': 'Označi kao poslat',
  'outreach.markNotSent': 'Označi kao nije poslat',
  'outreach.sendFromCrm': 'Pošalji iz CRM-a',
  'outreach.resend': 'Pošalji ponovo iz CRM-a',
  'outreach.composeAdditional': 'Napiši još jedan email',
  'outreach.additionalTitle': 'Dodatni email',
  'outreach.additionalSubjectHint': 'Naslov follow-up-a…',
  'outreach.sendAdditional': 'Pošalji dodatni email',
  'outreach.recipient': 'Pošalji na',
  'outreach.from': 'Pošalji sa',
  'outreach.noRecipient': 'Dodajte email adresu na lead da biste slali iz CRM-a.',
  'outreach.sending': 'Slanje…',
  'outreach.sendConfirm':
    'Poslati ovaj email sada na {email} sa {from}? Biće u IOM HTML šablonu i označen kao poslat.',
  'outreach.resendConfirm':
    'Ponovo poslati ovaj outreach na {email} sa {from}? Beleži se nova email aktivnost.',
  'outreach.additionalConfirm':
    'Poslati ovaj dodatni email na {email} sa {from}?',
  'outreach.sendDemoConfirm':
    'Simulirati slanje na {email} sa {from}? Nijedna prava poruka ne napušta ovaj pregledač — lead i aktivnosti se ažuriraju samo lažnim podacima.',
  'outreach.resendDemoConfirm':
    'Simulirati ponovno slanje na {email} sa {from}? Email se ne isporučuje — aktivnost se beleži samo u ovom demu.',
  'outreach.additionalDemoConfirm':
    'Simulirati slanje ovog dodatnog emaila na {email} sa {from}? Samo lažni podaci — ništa se ne isporučuje.',
  'outreach.demoSendNote':
    'Demo režim: Pošalji iz CRM-a simulira isporuku lažnim podacima. Ne koristi se Proton SMTP ni pravi sandučić.',
  'outreach.sendMissing': 'Primaoc, naslov i tekst su obavezni za slanje.',
  'outreach.sendFailed': 'Slanje emaila preko Proton-a nije uspelo.',
  'outreach.sendDemoBlocked': 'Slanje je isključeno u CRM demo režimu.',
  'outreach.sendLiveRequired': 'Prijavite se u live CRM da biste slali email.',
  'outreach.sentConfirm': 'Označiti inicijalni outreach kao poslat? Ovo beleži email aktivnost i prebacuje New leadove u Contacted.',
  'outreach.notSentConfirm':
    'Označiti inicijalni outreach kao nije poslat? Badge Email poslat se briše da možete poslati ponovo. Istorija aktivnosti ostaje.',
  'outreach.draftedAt': 'Označen draft',
  'outreach.sentAt': 'Označen poslat',
  'outreach.addDraft': 'Dodaj email draft',
  'outreach.saveDraft': 'Sačuvaj draft',
  'outreach.saveFailed': 'Čuvanje email drafta nije uspelo.',
  'outreach.markFailed': 'Ažuriranje outreach statusa nije uspelo.',
  'outreach.defaultActivitySubject': 'Inicijalni outreach email poslat',
  'outreach.sentActivityBody': 'Inicijalni outreach email označen kao poslat iz CRM-a.',
  'outreach.sentViaCrmActivityBody':
    'Inicijalni outreach email poslat iz CRM-a preko {from} (Proton SMTP).',
  'outreach.resendActivityBody':
    'Outreach email ponovo poslat iz CRM-a na {email} preko {from}.',
  'outreach.additionalActivityBody':
    'Dodatni email poslat iz CRM-a na {email} preko {from}.',

  'thread.title': 'Email konverzacija',
  'thread.blurb':
    'CRM slanja i ogledani odgovori klijenata (Proton keep-copy → Resend → CRM). Pravi sandučić ostaje u Protonu — ovo je ogledalo niti za lead.',
  'thread.loading': 'Učitavanje…',
  'thread.count': '{n} poruka',
  'thread.empty': 'Još nema poruka u ovoj niti. Pošaljite inicijalni outreach ili odgovor da počnete.',
  'thread.schemaMissing':
    'Tabela za email konverzaciju nedostaje. Pokrenite supabase/crm_lead_messages_migration.sql u Supabase-u, pa osvežite.',
  'thread.loadFailed': 'Učitavanje email konverzacije nije uspelo.',
  'thread.outbound': 'Poslato',
  'thread.inbound': 'Primljeno',
  'thread.noSubject': '(bez naslova)',
  'thread.composeReply': 'Napiši odgovor',
  'thread.replyTitle': 'Odgovor / follow-up',
  'thread.sendReply': 'Pošalji odgovor',
  'thread.logInbound': 'Zabeleži odgovor klijenta',
  'thread.logInboundFromHint': 'Email klijenta (From):',
  'thread.logInboundSubjectHint': 'Naslov:',
  'thread.logInboundBodyHint': 'Nalepi tekst odgovora klijenta:',
  'thread.inboundDefaultSubject': 'Odgovor klijenta',
  'thread.logInboundActivityBody': 'Odgovor klijenta od {email} zabeležen u CRM.',
  'thread.logFailed': 'Beleženje odgovora klijenta nije uspelo.',

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
    'Vaš privatni IOM radni prostor — leadovi i pipeline, table projekata u Monday stilu, praćenje vremena u Clockify stilu, mape uma, istraživačke beleške, Snimač (video + screenshot-ovi), javni Journal (Blog), zajednička biblioteka Linkova i SEO / analitika saobraćaja. U online režimu prijavljeni zaposleni dele iste podatke. Javni CRM demo koristi samo izmišljene uzorke.',
  'guide.what1':
    'Leadovi — firme za pitch, Vruć / Topao / Hladan, faze pipeline-a, Email konverzacija, dnevnik aktivnosti',
  'guide.what2': 'Projekti — kanban table sa kolonama i zadacima za isporuku',
  'guide.what3': 'Vreme — start/stop tajmeri, ručni unosi i izveštaji',
  'guide.what4': 'Ideje — mape uma samostalno ili povezane sa leadom / projektom',
  'guide.what5': 'Beleške — istraživačke liste (umetnici, tržišta, follow-up) sa sekcijama i linkovima',
  'guide.what6':
    'Demo — privatni demoi za klijente koji nisu na javnom sajtu (linkovi sa lozinkom za pitch)',
  'guide.what7':
    'Blog — Journal članci, moderacija komentara i privatna blog email lista (adrese se ne prikazuju javno)',
  'guide.what8':
    'Linkovi — kurirani YouTube kanali, veb stranice, forumi i blog postovi koje čuvamo za oboje',
  'guide.what9': 'SEO — inventar sajta, checklista unapređenja i analitika sa globusom posetilaca',
  'guide.what10':
    'Snimač — video ekrana i PNG screenshot-ovi, glas/avatar opcije, biblioteka sa share linkovima za blogove i klijente',
  'guide.navHeading': 'Navigacija',
  'guide.navText':
    'Kartice ispod zaglavlja: Leadovi | Projekti | Vreme | Ideje | Beleške | Snimač | Demo; Blog, Linkovi i SEO su desno (ispred muzičkog plejera).',
  'guide.nav1': 'Leadovi — CRM u Salesforce stilu za potencijalne klijente',
  'guide.nav2': 'Projekti — table u Monday stilu za rad na isporuci',
  'guide.nav3': 'Vreme — tajmeri, unosi i izveštaji u Clockify stilu',
  'guide.nav4': 'Ideje — mape uma u MindMeister stilu za brainstorming',
  'guide.nav5': 'Beleške — istraživački dokumenti sa sekcijama, linkovima i ChatGPT pomoći',
  'guide.nav6':
    'Snimač — Snimanje / Screenshot / Biblioteka: video ili PNG, glas i izgled, izmena (trim/blur/muzika), share na /r/…',
  'guide.nav7':
    'Demo — katalog privatnih demoa za klijente (npr. ICM) koji nisu na javnoj početnoj',
  'guide.nav8':
    'Blog — pisanje/objava Journal članaka, moderacija verifikovanih komentara, blog emailovi',
  'guide.nav9':
    'Linkovi — zajednička biblioteka korisnih kanala, stranica, foruma i postova (filter po tipu)',
  'guide.nav10':
    'SEO — inventar sadržaja, SEO unapređenja i analitika (živi saobraćaj kad ste prijavljeni; uzorak u demu)',
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
  'guide.start5':
    'ChatGPT pomoć za lead (+ Dodaj lead): kopiraj prompt → istraži u ChatGPT → nalepi JSON → Učitaj u formu',
  'guide.pipeHeading': 'Rad sa pipeline-om',
  'guide.pipe1': 'Izaberite lead u levoj listi da otvorite panel sa detaljima',
  'guide.pipe2':
    'Ažurirajte fazu kako napredujete: Novi → Kontaktiran → Kvalifikovan → Ponuda → Pregovori → Dobijen / Izgubljen',
  'guide.pipe3': 'Menjajte Vruć / Topao / Hladan kad god se interesovanje promeni',
  'guide.pipe4': 'Izmenite detalje, tekst ponude i beleške kako razgovori napreduju',
  'guide.pipe5':
    'Kopiraj kao tekst — izvezite ceo lead (kontakt, outreach, aktivnosti) za ChatGPT ili email draftove',
  'guide.outreachHeading': 'Outreach i email konverzacija',
  'guide.outreachText':
    'Pravi sandučić ostaje u Protonu. CRM piše, šalje i ogleda nit leada da možete da korespondirate bez napuštanja /client-login.',
  'guide.outreach1':
    'Inicijalni outreach: draft subject/telo na leadu (ili preko ChatGPT JSON), Pregled formatiranog emaila, zatim Pošalji iz CRM-a (Proton SMTP). Poruka se vidi i u Proton Sent',
  'guide.outreach2':
    'Email konverzacija (ispod): puna vremenska linija Poslato / Primljeno. Za follow-up koristite Napiši odgovor — pregled pokazuje samo taj odgovor, nikad greškom inicijalni draft',
  'guide.outreach3':
    'Odgovori klijenata: Proton čuva pravi Inbox. Keep-copy forward ka Resend ih automatski ogleda u CRM. Do tada (ili jednokratno) koristite Zabeleži odgovor klijenta',
  'guide.outreach4':
    'Povezivanje: CRM kači dolazni mail preko niti (In-Reply-To) ili po tome što se From poklapa sa email adresama leada',
  'guide.outreach5':
    'Kartice pokazuju Email na čekanju / Email poslat / Prioritet. Filter faze „Nije kontaktiran” prikazuje leadove bez poslatog inicijalnog emaila. Dnevnik aktivnosti i dalje beleži pozive, sastanke i beleške — email nit je izvor istine za korespondenciju',
  'guide.outreach6':
    'Prioritet na leadu ga stavlja u red za kontakt (ne ističe u ponoć). Kliknite pilulu Prioritet da fokusirate tu listu; briše se kad označite inicijalni email kao poslat, ili ponovo kliknete Prioritet. Greškom Označen poslat? Koristite Označi kao nije poslat na outreach panelu',
  'guide.outreachDemoText':
    'U javnom demu je slanje simulirano (nema Proton / Resend). Istražite fiktivnu Email konverzaciju i bezbedno probajte Napiši odgovor ili Zabeleži odgovor klijenta.',
  'guide.outreachDemo1':
    'Otvorite Copper Lantern Museums (pregovori) — već ima Poslato poruku i uzorak Primljenog odgovora klijenta',
  'guide.outreachDemo2':
    'Harbor & Pine je Prioritet + Email na čekanju — probajte pilulu Prioritet i filter faze Nije kontaktiran',
  'guide.outreachDemo3':
    'Inicijalni outreach: Pregled i Pošalji iz CRM-a ažuriraju lead i nit samo lažnim podacima — ništa se ne isporučuje',
  'guide.outreachDemo4':
    'Email konverzacija → Napiši odgovor: napišite follow-up; pregled pokazuje samo taj odgovor. Pošalji odgovor beleži još jednu odlaznu poruku u demo niti',
  'guide.outreachDemo5':
    'Zabeleži odgovor klijenta ili Resetuj uzorke (baner) da vratite originalne demo leadove i Copper Lantern nit',
  'guide.calendarHeading': 'Statistika i kalendar follow-up-a',
  'guide.calendarText':
    'Kompaktna statistika i sklopivi kalendar na kartici Leadovi pomažu fokusu na današnje zadatke.',
  'guide.calendar1':
    'Statističke pilule: Vidljivi, Otvoreni, Vrući i Prioritet (kliknite Prioritet da vidite samo red za kontakt)',
  'guide.calendar2':
    'Kalendar follow-up-a je skupljen — kliknite pilulu da proširite, izaberite datum da filtrirate leadove',
  'guide.calendar3':
    'Dani sa follow-up-ima imaju tačku; uklonite filter datuma da vidite sve leadove',
  'guide.commHeading': 'Dnevnik aktivnosti',
  'guide.commText':
    'Panel aktivnosti koristite za pozive, sastanke, beleške i zadatke. Pun tekst emailova je u Email konverzaciji iznad — ne samo kao kratke stavke aktivnosti.',
  'guide.comm1':
    'Na leadu zabeležite Poziv, Sastanak, Belešku ili Zadatak (i opcione Email beleške) u panelu aktivnosti',
  'guide.comm2': 'Dodajte kratak naslov i opcione detalje da vremenska linija ostane korisna',
  'guide.comm3': 'Pregledajte prošle aktivnosti na istom leadu pre sledećeg kontakta',
  'guide.findHeading': 'Pretraga i filteri',
  'guide.find1': 'Pretražujte po firmi, kontaktu ili emailu u gornjoj traci',
  'guide.find2':
    'Filtrirajte po fazi (uključujući Nije kontaktiran), temperaturi (Vruć / Topao / Hladan) i po tome ko je dodao lead',
  'guide.find3':
    'Sortirajte po poslednjoj izmeni, ko je dodao ili fazi; koristite statistiku i kalendar follow-up-a za filter po datumu',
  'guide.chatgptHeading': 'ChatGPT pomoć',
  'guide.chatgptText':
    'Ubrzajte istraživanje copy-paste ChatGPT tokom — nema API ključa u CRM-u; ChatGPT pokrećete vi sami.',
  'guide.chatgpt1':
    'Dodaj lead: ChatGPT pomoć popunjava firmu, kontakt, outreach email, Atlas ocene i više iz jednog JSON paste-a',
  'guide.chatgpt2':
    'Beleške (režim Izmena): ChatGPT pomoć generiše naslov + telo sa ## sekcijama za liste umetnika/leadova',
  'guide.chatgpt3':
    'Kopiraj kao tekst na leadu izvozi sve za paste u ChatGPT kad treba nova analiza',
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
  'guide.notesHeading': 'Beleške',
  'guide.notesText':
    'Istraživački notesi za liste koje pratite — umetnici, venue-i, konkurencija, tople veze.',
  'guide.notes1':
    'Kartica Beleške → + Nova beleška; opciono povežite sa leadom ili projektom',
  'guide.notes2':
    'Izmena / Pregled: URL-ovi su klikabilni; koristite ## Naslov sekcije za svaku osobu ili temu',
  'guide.notes3':
    'Pregled prikazuje indeks Na ovoj stranici kad imate 2+ sekcije — skok bez skrolovanja',
  'guide.notes4':
    'ChatGPT pomoć (Izmena): kopiraj prompt, nalepi JSON, Učitaj u belešku — proverite u Pregledu, autosave',
  'guide.notes5':
    'Format: uvod, zatim ## Ime, URL u sledećem redu, zatim beleške za praćenje po sekciji',
  'guide.recordingsHeading': 'Snimač',
  'guide.recordingsText':
    'Snimite video ekrana ili screenshot-ove, opciono sa mikrofonom, kamerom (PiP), glasovnim presetima / AI morfom i režimima izgleda — sačuvajte lokalno ili online i podelite lozinkom.',
  'guide.recordings1':
    'Kartica Snimanje → mikrofon/kamera, glas, izgled, lokalno vs online → Počni, izaberite ekran, Pauza da promenite tab/ekran, pa Zaustavi',
  'guide.recordings2':
    'Kartica Screenshot → naslov + Sačuvaj u → Uhvati screenshot (tab/prozor/ekran) → PNG ide u Biblioteku',
  'guide.recordings3':
    'Biblioteka → Izmena videa (trim, blur, jačina, IOM muzika ili upload) · screenshot-ovi nemaju video editor',
  'guide.recordings4':
    'Kopirajte trajni URL slike za blog naslovne/Markdown, ili /r/… share link / embed za video; opciona lozinka',
  'guide.recordings5':
    'Online fajlovi ostaju na Cloudflare R2 dok ih ne obrišete — trajni URL slike i /r/… share stranice i dalje rade',
  'guide.recordingsDemoText':
    'U javnom demu Snimanje i Screenshot rade samo u ovom pregledaču. Online čuvanje, share linkovi i trajne /r/… stranice zahtevaju live CRM.',
  'guide.recordingsDemo1':
    'Probajte Snimanje i Screenshot — fajlovi su u Biblioteci (lokalno) i preuzimaju se na uređaj',
  'guide.recordingsDemo2':
    'Pauzirajte snimanje da promenite ekran/tab, pa Nastavi — isto kao u live CRM-u',
  'guide.recordingsDemo3':
    'Izmenite lokalne video snimke (trim / blur / IOM muzika). Online čuvanje je isključeno u demu',
  'guide.recordingsDemo4':
    'Prijavite se na /client-login za online Biblioteku, share linkove i slike za blogove',
  'guide.demosHeading': 'Demo (privatni klijentski sajtovi)',
  'guide.demosText':
    'Kratak katalog demoa za klijente koji ostaju van javnog portfolija — otvorite linkove, delite lozinke, pratite status pitch-a.',
  'guide.demos1':
    'ICM je prvi unos: https://iobjectm.com/demo/icm (lozinka je na kartici)',
  'guide.demos2':
    'Otvori demo za živi URL; Otvori na ovom sajtu za isti path na trenutnom hostu',
  'guide.demos3':
    'Dodajte nove klijentske demoe ovde kako ih gradite — ne treba da budu u javnoj listi Experiments',
  'guide.blogHeading': 'Blog (IOM Journal)',
  'guide.blogText':
    'Pišite javne Journal članke iz CRM-a, moderišite komentare koji zahtevaju verifikovan email (nikad na sajtu) i vodite posebnu Blog email listu — nije isto što i Leadovi za prodaju.',
  'guide.blog1':
    'Članci — nacrt ili objava Markdown tekstova sa slugom, izvodom, SEO naslovom/opisom, tagovima i cover URL-om',
  'guide.blog2':
    'Linkujte na demo i /#contact zbog SEO-a; obavezan izvod ide u liste i meta',
  'guide.blog3':
    'Komentari — čitaoci potvrđuju email magic linkom; prvi komentari čekaju Odobri / Odbij / Spam',
  'guide.blog4':
    'Emailovi — verifikovani komentatori idu ovde; marketing opt-in samo ako su čekirali polje',
  'guide.blog5':
    'Javni /blog ostaje Coming soon dok ne postavite BLOG_PUBLIC_ENABLED = true u src/blog/publicFlags.ts i ponovo deploy-ujete',
  'guide.blogDemoText':
    'U ovom demu Blog koristi samo izmišljene članke, komentare i emailove. Reset uzoraka ih vraća. Ništa se ne objavljuje na živom Journal-u.',
  'guide.blogDemo1':
    'Otvorite Blog → Članci: uzorak objavljenih tekstova plus nacrt (WebGPU particles)',
  'guide.blogDemo2':
    'Kartica Komentari: Odobri na Čeka moderaciju; filter Spam / Čeka email verifikaciju',
  'guide.blogDemo3':
    'Kartica Emailovi: lista komentatora + ručno dodat press kontakt; beleške se menjaju',
  'guide.blogDemo4':
    'Dodaj demo komentar kreira novu stavku na čekanju na objavljenom članku',
  'guide.blogDemo5':
    'Pogledaj otvara /blog/… lokalno; produkcijski Journal ostaje Coming soon dok staff ne uključi',
  'guide.linksHeading': 'Linkovi (zajednička biblioteka)',
  'guide.linksText':
    'Privatna polica bookmarkova za oboje — YouTube kanali, veb stranice, forumi i zanimljivi blog postovi, grupisani po tipu sa kratkom napomenom zašto čuvamo link.',
  'guide.links1':
    'Otvorite Linkovi (desna grupa alata, između Blog i SEO) da pregledate zajedničku biblioteku',
  'guide.links2':
    'Filtrirajte po tipu: YouTube, Veb stranica, Forum, Blog post — ili pretražite naslov, napomenu i tagove',
  'guide.links3':
    'Koristite + Dodaj link za naslov, URL, tip i opcionu napomenu; Kopiraj / Otvori / Ukloni na svakom redu',
  'guide.links4':
    'Držite malo kategorija i kratke napomene — zajedničko čuvanje ide preko Supabase kad je tabela instalirana, inače ovaj pregledač',
  'guide.linksDemoText':
    'U ovom demu Linkovi počinju sa uzorkom bookmarkova. Možete slobodno dodavati i uklanjati; Reset uzoraka vraća originalnu listu.',
  'guide.linksDemo1':
    'Otvorite Linkovi — uzorak YouTube, veb, forum i blog bookmarkova je već popunjen',
  'guide.linksDemo2':
    'Isprobajte + Dodaj link, zatim filtere i pretragu; Ukloni briše red posle potvrde',
  'guide.linksDemo3':
    'Kopirajte ili otvorite bilo koji link — prave javne stranice se otvaraju u novom tabu',
  'guide.linksDemo4':
    'Reset uzoraka vraća originalnu listu Linkova (vaša demo dodavanja/uklanjanja se brišu)',
  'guide.seoHeading': 'SEO i analitika',
  'guide.seoText':
    'Kartica SEO prati spremnost sadržaja sajta i saobraćaj posetilaca — isti alati koje zaposleni koriste posle prijave.',
  'guide.seo1':
    'Pregledajte SEO ciljeve, checklistu unapređenja i inventar sadržaja javnog sajta',
  'guide.seo2':
    'Analitika: pregledi, izvori, ključne reči, uređaji, zemlje i globus gradova posetilaca',
  'guide.seo3':
    'Prijavljeni CRM koristi živu analitiku sajta; javni demo prikazuje samo realistične lažne uzorke saobraćaja',
  'guide.seoDemoText':
    'U ovom demu SEO prikazuje samo uzorak inventara sadržaja i lažni saobraćaj — ne živu analitiku iobjectm.com.',
  'guide.seoDemo1':
    'Pregledajte SEO ciljeve, checklistu i inventar sa uzorkom spremnosti',
  'guide.seoDemo2':
    'Analitika: uzorak pregleda, izvora, ključnih reči, uređaja, zemalja i globusa posetilaca',
  'guide.seoDemo3':
    'Reset uzoraka vraća lažni saobraćaj; prijavljeni CRM koristi živu analitiku',
  'guide.photoHeading': 'Profilna fotografija',
  'guide.photo1': 'Kliknite avatar ili email u gornjoj traci da otvorite meni fotografije',
  'guide.photo2':
    'Isecite u krug, komprimujte, pa otpremite, promenite ili uklonite svoju profilnu sliku',
  'guide.photo3':
    'Vaša fotografija se prikazuje pored leadova koje dodate; ažuriranje osvežava i postojeće leadove',
  'guide.uiHeading': 'Pomoć i jezik',
  'guide.ui1':
    'Pomoć (zaglavlje, pored Odjava) ponovo otvara ovaj vodič bilo kada',
  'guide.ui2':
    'Zastava: staff CRM prebacuje Engleski ↔ Srpski; javni demo nudi EN · DE · NL · FR · IT',
  'guide.hint':
    'Kartice: Leadovi · Projekti · Vreme · Ideje · Beleške · Demo — Blog · Linkovi · SEO desno. Pomoć ponovo otvara vodič. Zastava menja jezik.',
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
