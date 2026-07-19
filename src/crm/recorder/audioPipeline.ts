import type { VoicePreset } from './types'

export interface AudioPipeline {
  stream: MediaStream
  context: AudioContext
  stop: () => void
}

/**
 * Mic → Web Audio effects → MediaStream destination.
 * Live presets only; AI morph is applied post-record via /api/crm-voice-morph.
 */
export async function createAudioPipeline(
  voice: VoicePreset,
): Promise<AudioPipeline> {
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  })

  const context = new AudioContext()
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

/** Probe whether the server has ElevenLabs configured. */
export async function probeAiVoiceAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/crm-voice-morph', { method: 'OPTIONS' })
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
}

export async function listAiVoices(): Promise<{
  voices: ElevenLabsVoiceOption[]
  defaultVoiceId: string | null
}> {
  const res = await fetch('/api/crm-voice-list')
  if (!res.ok) {
    return { voices: [], defaultVoiceId: null }
  }
  const data = (await res.json()) as {
    voices?: ElevenLabsVoiceOption[]
    defaultVoiceId?: string | null
  }
  return {
    voices: Array.isArray(data.voices) ? data.voices : [],
    defaultVoiceId: data.defaultVoiceId ?? null,
  }
}

export async function morphVoiceWithAi(
  videoBlob: Blob,
  voiceId?: string,
): Promise<Blob> {
  const buffer = await videoBlob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const audioBase64 = btoa(binary)

  const res = await fetch('/api/crm-voice-morph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64,
      voiceId: voiceId || undefined,
      mimeType: videoBlob.type || 'video/webm',
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Voice morph failed')
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
    if (!ctx) return videoBlob

    const vStream = canvas.captureStream(30)
    const audioCtx = new AudioContext()
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

    const done = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime }))
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
      window.setTimeout(finish, (video.duration || 60) * 1000 + 2000)
    })

    cancelAnimationFrame(raf)
    recorder.stop()
    video.pause()
    audio.pause()
    void audioCtx.close()
    vStream.getTracks().forEach((t) => t.stop())
    return await done
  } catch {
    return videoBlob
  } finally {
    URL.revokeObjectURL(videoUrl)
    URL.revokeObjectURL(audioUrl)
  }
}
