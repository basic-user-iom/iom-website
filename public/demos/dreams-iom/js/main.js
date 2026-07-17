(function () {
  'use strict'

  const introSection = document.querySelector('.chapter--intro')
  const introText = document.querySelector('.intro-text')
  const introVideo = document.querySelector('.intro-video')
  const introAudio = document.querySelector('.intro-audio')
  let introStarted = false

  const isCoarse =
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(max-width: 640px)').matches)

  function runIntroSequence() {
    if (!introSection || !introText || !introVideo || introStarted) return
    introStarted = true
    setTimeout(function () {
      introText.classList.remove('intro-text--hidden')
    }, 0)
  }

  if (introSection) {
    const introObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !introStarted) runIntroSequence()
        })
      },
      { root: null, rootMargin: '0px', threshold: 0.5 },
    )
    introObserver.observe(introSection)
  }

  function startIntroMusic() {
    if (!introAudio || introAudio.dataset.started) return
    introAudio.dataset.started = '1'
    introAudio.play().catch(function () {})
    if (introText) introText.classList.add('intro-text--hidden')
    if (introSection) introSection.classList.add('intro--playing')
    document.body.classList.add('dream--video-playing')
    if (introVideo) {
      // Start network fetch only on play — faster first paint.
      if (introVideo.preload !== 'auto') introVideo.preload = 'auto'
      introVideo.classList.add('intro-video--visible')
      introVideo.play().catch(function () {})
    }
    var controlsEl = document.querySelector('.intro-controls')
    if (controlsEl) controlsEl.removeAttribute('hidden')
    var btn = document.querySelector('.intro-play-btn')
    if (btn) {
      btn.disabled = true
      btn.classList.add('intro-play-btn--played')
    }
    // Never auto-fullscreen on phones — iOS often rejects it and it feels broken.
    // Desktop may still use the Fullscreen control explicitly.
  }

  var introPlayBtnEl = document.querySelector('.intro-play-btn')
  if (introPlayBtnEl) introPlayBtnEl.addEventListener('click', startIntroMusic)

  // Play button only — avoid accidental fullscreen / play from random taps.
  if (introSection) {
    introSection.addEventListener('click', function (e) {
      if (introAudio && introAudio.dataset.started) return
      if (e.target.closest('.intro-play-btn')) return
      if (e.target.closest('.intro-controls')) return
      if (e.target.closest('.intro-logo-link')) return
      if (e.target.closest('.dream-back-link')) return
      // Large play hit area around center (mobile-friendly), without auto-fullscreen.
      var rect = introSection.getBoundingClientRect()
      var y = (e.clientY - rect.top) / rect.height
      var x = (e.clientX - rect.left) / rect.width
      var hitPad = isCoarse ? 0.2 : 0.12
      if (y >= 0.5 - hitPad && y <= 0.5 + hitPad && x >= 0.5 - hitPad && x <= 0.5 + hitPad) {
        startIntroMusic()
      }
    })
  }

  function resetToFirstScreen() {
    document.body.classList.remove('dream--video-playing')
    if (introSection) introSection.classList.remove('intro--playing')
    if (introVideo) {
      introVideo.pause()
      introVideo.currentTime = 0
      introVideo.classList.remove('intro-video--visible')
    }
    if (introAudio) {
      introAudio.pause()
      introAudio.currentTime = 0
      delete introAudio.dataset.started
    }
    if (introText) introText.classList.remove('intro-text--hidden')
    var btn = document.querySelector('.intro-play-btn')
    if (btn) {
      btn.disabled = false
      btn.classList.remove('intro-play-btn--played')
    }
    var controlsEl = document.querySelector('.intro-controls')
    if (controlsEl) controlsEl.setAttribute('hidden', '')
    var el = document.documentElement
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen()
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
    }
  }
  if (introAudio) introAudio.addEventListener('ended', resetToFirstScreen)

  var introPauseBtn = document.querySelector('.intro-pause-btn')
  var introAudioBtn = document.querySelector('.intro-audio-btn')
  if (introPauseBtn && introVideo && introAudio) {
    introPauseBtn.addEventListener('click', function () {
      var state = introPauseBtn.getAttribute('data-state')
      if (state === 'playing') {
        introVideo.pause()
        introAudio.pause()
        introPauseBtn.setAttribute('data-state', 'paused')
        introPauseBtn.setAttribute('aria-label', 'Play')
        introPauseBtn.textContent = 'Play'
      } else {
        introVideo.play().catch(function () {})
        introAudio.play().catch(function () {})
        introPauseBtn.setAttribute('data-state', 'playing')
        introPauseBtn.setAttribute('aria-label', 'Pause')
        introPauseBtn.textContent = 'Pause'
      }
    })
  }
  if (introAudioBtn && introAudio) {
    introAudioBtn.addEventListener('click', function () {
      introAudio.muted = !introAudio.muted
      var on = !introAudio.muted
      introAudioBtn.setAttribute('data-state', on ? 'on' : 'off')
      introAudioBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off')
      introAudioBtn.textContent = on ? 'Sound on' : 'Sound off'
    })
  }

  var introVolumeEl = document.getElementById('intro-volume')
  if (introVolumeEl && introAudio) {
    introVolumeEl.addEventListener('input', function () {
      introAudio.volume = parseInt(introVolumeEl.value, 10) / 100
    })
  }

  var introFullscreenBtn = document.querySelector('.intro-fullscreen-btn')
  if (introFullscreenBtn) {
    function updateFullscreenLabel() {
      var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement)
      introFullscreenBtn.setAttribute('aria-label', isFs ? 'Exit fullscreen' : 'Fullscreen')
      introFullscreenBtn.textContent = isFs ? 'Exit fullscreen' : 'Fullscreen'
    }
    introFullscreenBtn.addEventListener('click', function () {
      var el = document.documentElement
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen()
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
      } else {
        if (el.requestFullscreen) el.requestFullscreen()
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
        else if (el.msRequestFullscreen) el.msRequestFullscreen()
      }
    })
    document.addEventListener('fullscreenchange', updateFullscreenLabel)
    document.addEventListener('webkitfullscreenchange', updateFullscreenLabel)
    updateFullscreenLabel()
  }
})()
