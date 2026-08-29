const IconReset = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.5 12a7.5 7.5 0 1 1 2.1 5.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4.5 16.5v-4.2H8.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconShare = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="18" cy="5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="6" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="18" cy="19" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 12.8 16 18.2M16 5.8 8 11.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const IconFullscreen = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const IconInfo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 11v5.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="8" r="0.9" fill="currentColor" />
  </svg>
)

const IconClose = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const IconCamera = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.5 8.5h3.1l1.2-2h6.4l1.2 2h3.1v10H4.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="12" cy="13.2" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

export const Icons = {
  Reset: IconReset,
  Share: IconShare,
  Fullscreen: IconFullscreen,
  Info: IconInfo,
  Close: IconClose,
  Camera: IconCamera,
}
