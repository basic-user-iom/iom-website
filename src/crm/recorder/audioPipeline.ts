import { getSupabase } from '../supabaseClient'
import type { VoicePreset } from './types'

export interface AudioPipeline {
  stream: MediaStream
  context: AudioContext
  stop: () => void
}

/** Keep under Vercel ~4.5MB JSON body after base64. */
const MAX_MORPH_AUDIO_BYTES = 3 * 1024 * 1024

/**
 * Mic → Web Audio effects → MediaStream destination.
 * Live presets only; AI morph is applied post-record via /api/crm-recorder?action=morph.
 */
export async function createAudioPipeline(
  voice: VoicePreset,
  options?: { noiseSuppression?: boolean },
): Promise<AudioPipeline> {
  const noiseSuppression = options?.noiseSuppression !== false
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression,
      autoGainControl: true,
    },
    video: false,
  })

  const context = new AudioContext()
  if (context.state === 'suspended') {
    await context.resume().catch(() => undefined)
  }
  const source = context.createMediaStreamSource(mic)
  const destination = context.createMediaStreamDestination()

  if (voice === 'deep' || voice === 'high') {
    const low = context.createBiquadFilter()
    low.type = 'lowshelf'
    low.frequency.value = 200
    low.gain.value = voice === 'deep' ? 6 : -4

    const high = context.createBiquadFilter()
    high.type = 'highshelf'
    high.frequency.value = 3000
    high.gain.value = voice === 'deep' ? -6 : 5

    const pitch = context.createBiquadFilter()
    pitch.type = 'peaking'
    pitch.frequency.value = voice === 'deep' ? 180 : 1200
    pitch.Q.value = 0.8
    pitch.gain.value = voice === 'deep' ? 8 : 6

    source.connect(low)
    low.connect(high)
    high.connect(pitch)
    pitch.connect(destination)
  } else if (voice === 'robot') {
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1000
    filter.Q.value = 2

    const distortion = context.createWaveShaper()
    distortion.curve = makeDistortionCurve(40)
    distortion.oversample = '2x'

    const delay = context.createDelay(0.05)
    delay.delayTime.value = 0.02
    const feedback = context.createGain()
    feedback.gain.value = 0.35

    source.connect(filter)
    filter.connect(distortion)
    distortion.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(destination)
    distortion.connect(destination)
  } else {
    // natural / ai — pass-through (ai morph after stop)
    source.connect(destination)
  }

  return {
    stream: destination.stream,
    context,
    stop: () => {
      try {
        source.disconnect()
      } catch {
        /* ignore */
      }
      mic.getTracks().forEach((t) => t.stop())
      void context.close()
    },
  }
}

function makeDistortionCurve(amount: number): Float32Array {
  const n = 44100
  const curve = new Float32Array(n)
  const deg = Math.PI / 180
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
  }
  return curve
}

async function crmAccessToken(): Promise<string> {
  const sb = getSupabase()
  if (!sb) throw new Error('Sign in to use AI voice morph')
  const { data } = await sb.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in to use AI voice morph')
  return token
}

/** Probe whether the server has ElevenLabs configured. */
export async function probeAiVoiceAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/crm-recorder?action=morph', { method: 'OPTIONS' })
    return res.headers.get('x-voice-morph-available') === '1'
  } catch {
    return false
  }
}

export interface ElevenLabsVoiceOption {
  id: string
  name: string
  category: string | null
  description: string | null
  previewUrl: string | null
  /** Premade / voice-library — blocked for STS on free ElevenLabs plans. */
  library?: boolean
}

export async function listAiVoices(): Promise<{
  voices: ElevenLabsVoiceOption[]
  defaultVoiceId: string | null
  ownedCount: number
}> {
  let token: string
  try {
    token = await crmAccessToken()
  } catch {
    return { voices: [], defaultVoiceId: null, ownedCount: 0 }
  }
  const res = await fetch('/api/crm-recorder?action=voices', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    return { voices: [], defaultVoiceId: null, ownedCount: 0 }
  }
  const data = (await res.json()) as {
    voices?: ElevenLabsVoiceOption[]
    defaultVoiceId?: string | null
    ownedCount?: number
  }
  const voices = Array.isArray(data.voices) ? data.voices : []
  return {
    voices,
    defaultVoiceId: data.defaultVoiceId ?? null,
    ownedCount:
      typeof data.ownedCount === 'number'
        ? data.ownedCount
        : voices.filter((v) => !v.library).length,
  }
}

/**
 * Pull audio-only from a recorded video.
 * Prefer Web Audio MediaElementSource (works with muted video in Chromium).
 */
async function extractAudioBlob(videoBlob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(
    videoBlob.type.startsWith('video/') || videoBlob.type.startsWith('audio/')
      ? videoBlob
      : new Blob([videoBlob], { type: 'video/webm' }),
  )
  let audioCtx: AudioContext | null = null
  try {
    const video = document.createElement('video')
    video.src = url
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Could not read recording audio'))
    })

    audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => undefined)
    }
    const elSource = audioCtx.createMediaElementSource(video)
    const dest = audioCtx.createMediaStreamDestination()
    elSource.connect(dest)
    // Keep graph alive without audible playback in the tab.
    const silent = audioCtx.createGain()
    silent.gain.value = 0
    elSource.connect(silent)
    silent.connect(audioCtx.destination)

    const tracks = dest.stream.getAudioTracks()
    if (!tracks.length) {
      throw new Error('No microphone audio in this recording to morph')
    }

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'
    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(dest.stream, { mimeType: mime })
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime })
        if (blob.size < 100) reject(new Error('Extracted audio was empty'))
        else resolve(blob)
      }
      recorder.onerror = () => reject(new Error('Audio extract failed'))
    })

    recorder.start(200)
    video.currentTime = 0
    await video.play()
    await new Promise<void>((resolve) => {
      const finish = () => {
        video.removeEventListener('ended', finish)
        resolve()
      }
      video.addEventListener('ended', finish)
      const ms = Number.isFinite(video.duration)
        ? video.duration * 1000
        : 120_000
      window.setTimeout(finish, ms + 1500)
    })
    video.pause()
    if (recorder.state !== 'inactive') recorder.stop()
    tracks.forEach((t) => t.stop())
    return await done
  } finally {
    if (audioCtx) void audioCtx.close()
    URL.revokeObjectURL(url)
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const i = dataUrl.indexOf(',')
      resolve(i >= 0 ? dataUrl.slice(i + 1) : dataUrl)
    }
    reader.onerror = () => reject(new Error('Could not encode audio'))
    reader.readAsDataURL(blob)
  })
}

export async function morphVoiceWithAi(
  videoBlob: Blob,
  voiceId?: string,
): Promise<Blob> {
  const token = await crmAccessToken()
  const audioOnly = await extractAudioBlob(videoBlob)
  if (audioOnly.size > MAX_MORPH_AUDIO_BYTES) {
    throw new Error('Audio too long for AI morph (try a shorter clip)')
  }
  const audioBase64 = await blobToBase64(audioOnly)

  const res = await fetch('/api/crm-recorder?action=morph', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      audioBase64,
      voiceId: voiceId || undefined,
      mimeType: audioOnly.type || 'audio/webm',
    }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string
      detail?: string
    }
    throw new Error(err.error || 'Voice morph failed')
  }
  const audioBlob = await res.blob()
  return remuxVideoWithAudio(videoBlob, audioBlob)
}

async function remuxVideoWithAudio(
  videoBlob: Blob,
  audioBlob: Blob,
): Promise<Blob> {
  const videoUrl = URL.createObjectURL(videoBlob)
  const audioUrl = URL.createObjectURL(audioBlob)

  try {
    const video = document.createElement('video')
    video.src = videoUrl
    video.muted = true
    video.playsInline = true
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('Video load failed'))
    })

    const audio = document.createElement('audio')
    audio.src = audioUrl
    await new Promise<void>((resolve, reject) => {
      audio.onloadeddata = () => resolve()
      audio.onerror = () => reject(new Error('Audio load failed'))
    })

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable for voice remux')

    const vStream = canvas.captureStream(30)
    const audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => undefined)
    }
    const audioSource = audioCtx.createMediaElementSource(audio)
    const dest = audioCtx.createMediaStreamDestination()
    audioSource.connect(dest)

    const combined = new MediaStream([
      ...vStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ])

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'
    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(combined, { mimeType: mime })

    const done = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime })
        if (blob.size < 1000) reject(new Error('Voice remux produced an empty file'))
        else resolve(blob)
      }
      recorder.onerror = () => reject(new Error('Voice remux failed'))
    })

    let raf = 0
    const paint = () => {
      if (!video.paused && !video.ended) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        raf = requestAnimationFrame(paint)
      }
    }

    recorder.start(250)
    video.currentTime = 0
    await Promise.all([video.play(), audio.play()])
    paint()

    await new Promise<void>((resolve) => {
      const finish = () => {
        video.removeEventListener('ended', finish)
        resolve()
      }
      video.addEventListener('ended', finish)
      const ms = Number.isFinite(video.duration)
        ? video.duration * 1000
        : 60_000
      window.setTimeout(finish, ms + 2000)
    })

    cancelAnimationFrame(raf)
    if (recorder.state !== 'inactive') recorder.stop()
    video.pause()
    audio.pause()
    void audioCtx.close()
    vStream.getTracks().forEach((t) => t.stop())
    return await done
  } finally {
    URL.revokeObjectURL(videoUrl)
    URL.revokeObjectURL(audioUrl)
  }
}
