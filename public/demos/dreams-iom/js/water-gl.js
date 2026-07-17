/**
 * WebGL water/caustics hero (GentleRain-style).
 * Mobile: single canvas, no antialias, cheaper noise — faster load + lower GPU cost.
 */
import * as THREE from 'three'

;(function () {
  'use strict'

  var isMobile =
    window.matchMedia('(max-width: 640px)').matches ||
    window.matchMedia('(pointer: coarse)').matches

  var vertex = [
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}',
  ].join('\n')

  function buildFragment(octaves) {
    return [
      'precision mediump float;',
      'varying vec2 vUv;',
      'uniform float uTime;',
      'uniform vec2 uPointer;',
      'uniform float uPointerDown;',
      'uniform vec2 uRes;',
      'uniform float uOverlay;',
      'float hash(vec2 p){',
      '  p = fract(p*vec2(123.34, 456.21));',
      '  p += dot(p, p+45.32);',
      '  return fract(p.x*p.y);',
      '}',
      'float noise(vec2 p){',
      '  vec2 i = floor(p);',
      '  vec2 f = fract(p);',
      '  float a = hash(i);',
      '  float b = hash(i+vec2(1,0));',
      '  float c = hash(i+vec2(0,1));',
      '  float d = hash(i+vec2(1,1));',
      '  vec2 u = f*f*(3.0-2.0*f);',
      '  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;',
      '}',
      'float fbm(vec2 p){',
      '  float v = 0.0;',
      '  float a = 0.5;',
      '  for(int i=0;i<' + octaves + ';i++){',
      '    v += a*noise(p);',
      '    p *= 2.02;',
      '    a *= 0.5;',
      '  }',
      '  return v;',
      '}',
      'float caustics(vec2 uv, float t){',
      '  vec2 p = uv * 4.0;',
      '  p += vec2(fbm(p + t*0.15), fbm(p - t*0.13)) * 0.75;',
      '  float c = fbm(p*2.0 + t*0.3);',
      '  c = pow(smoothstep(0.35, 0.95, c), 2.5);',
      '  c += pow(smoothstep(0.65, 1.0, fbm(p*4.0 - t*0.2)), 6.0) * 0.65;',
      '  return c;',
      '}',
      'void main(){',
      '  vec2 uv = vUv;',
      '  float aspect = uRes.x / max(uRes.y, 1.0);',
      '  vec2 uva = vec2((uv.x - 0.5)*aspect + 0.5, uv.y);',
      '  float t = uTime;',
      '  vec2 flow = vec2(',
      '    fbm(uva*2.0 + vec2(t*0.05, 0.0)),',
      '    fbm(uva*2.0 + vec2(0.0, -t*0.04))',
      '  ) - 0.5;',
      '  float d = distance(uv, uPointer);',
      '  float ripple = uPointerDown * exp(-d*20.0) * sin(18.0*d - t*6.0);',
      '  vec2 duv = uv + flow*0.02 + ripple*0.02;',
      '  float c = caustics(duv, t);',
      '  vec3 sky = vec3(0.082, 0.118, 0.157);',
      '  vec3 horizon = vec3(0.102, 0.145, 0.188);',
      '  vec3 deepWater = vec3(0.031, 0.047, 0.063);',
      '  vec3 abyssWater = vec3(0.020, 0.031, 0.063);',
      '  vec3 base = mix(sky, horizon, smoothstep(0.0, 0.25, uv.y));',
      '  base = mix(base, deepWater, smoothstep(0.2, 0.55, uv.y));',
      '  base = mix(base, abyssWater, smoothstep(0.5, 1.0, uv.y));',
      '  float cloudNoise = fbm(uva * 3.0 + t * 0.02) * 0.3;',
      '  base += vec3(0.02, 0.025, 0.03) * cloudNoise * (1.0 - smoothstep(0.0, 0.35, uv.y));',
      '  vec3 col = base;',
      '  vec3 coolHighlight = vec3(0.35, 0.42, 0.50);',
      '  vec3 tealAccent = vec3(0.15, 0.45, 0.45);',
      '  vec3 reflectionColor = mix(coolHighlight, tealAccent, 0.15);',
      '  col += c * reflectionColor * 0.25;',
      '  float vig = smoothstep(0.9, 0.25, distance(uv, vec2(0.5, 0.5)));',
      '  col *= mix(0.85, 1.0, vig);',
      '  float g = hash(uv * uRes + fract(t));',
      '  col += (g - 0.5) * 0.025;',
      '  if (uOverlay > 0.5) {',
      '    float causticIntensity = pow(c, 0.55) * 2.6;',
      '    float a = clamp(causticIntensity, 0.0, 1.0);',
      '    vec3 waterTint = vec3(0.55, 0.88, 0.98);',
      '    vec3 highlight = waterTint * causticIntensity;',
      '    gl_FragColor = vec4(highlight, a);',
      '  } else {',
      '    gl_FragColor = vec4(col, 1.0);',
      '  }',
      '}',
    ].join('\n')
  }

  var fragment = buildFragment(isMobile ? 3 : 5)

  function initWaterGL() {
    var canvasBg = document.getElementById('waterCanvas')
    var canvasOverlay = document.getElementById('waterCanvasOverlay')
    var section = document.querySelector('.chapter--intro')
    if (!canvasBg || !section) return

    var dpr = 1
    var shared = {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uPointerDown: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
    }

    var renderer = new THREE.WebGLRenderer({
      canvas: canvasBg,
      alpha: false,
      antialias: !isMobile,
      powerPreference: isMobile ? 'low-power' : 'default',
    })
    renderer.setClearColor(0x050810, 1)
    renderer.setPixelRatio(dpr)
    var aspect = 1
    var cam = new THREE.OrthographicCamera(-0.5 * aspect, 0.5 * aspect, 0.5, -0.5, 0.1, 10)
    cam.position.z = 1
    var uniformsBg = {
      uTime: shared.uTime,
      uPointer: shared.uPointer,
      uPointerDown: shared.uPointerDown,
      uRes: shared.uRes,
      uOverlay: { value: 0 },
    }
    var quadBg = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: uniformsBg,
        depthWrite: false,
      }),
    )
    var sceneBg = new THREE.Scene()
    sceneBg.add(quadBg)

    var overlayScene = null
    var overlayCam = null
    var overlayRenderer = null
    // Skip second WebGL context on phones — big win for battery + startup.
    if (canvasOverlay && !isMobile) {
      overlayRenderer = new THREE.WebGLRenderer({
        canvas: canvasOverlay,
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
      })
      overlayRenderer.setPixelRatio(dpr)
      overlayRenderer.setClearColor(0x000000, 0)
      overlayCam = new THREE.OrthographicCamera(-0.5 * aspect, 0.5 * aspect, 0.5, -0.5, 0.1, 10)
      overlayCam.position.z = 1
      var uniformsOverlay = {
        uTime: shared.uTime,
        uPointer: shared.uPointer,
        uPointerDown: shared.uPointerDown,
        uRes: shared.uRes,
        uOverlay: { value: 1 },
      }
      var quadOverlay = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          vertexShader: vertex,
          fragmentShader: fragment,
          uniforms: uniformsOverlay,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      )
      overlayScene = new THREE.Scene()
      overlayScene.add(quadOverlay)
    } else if (canvasOverlay) {
      canvasOverlay.style.display = 'none'
    }

    function setSize() {
      var cssW = Math.max(1, Math.floor(window.innerWidth))
      var cssH = Math.max(1, Math.floor(window.innerHeight))
      aspect = cssW / cssH
      cam.left = -0.5 * aspect
      cam.right = 0.5 * aspect
      cam.top = 0.5
      cam.bottom = -0.5
      cam.updateProjectionMatrix()
      renderer.setPixelRatio(dpr)
      renderer.setSize(cssW, cssH, true)
      var bufW = renderer.domElement.width
      var bufH = renderer.domElement.height
      renderer.setViewport(0, 0, bufW, bufH)
      shared.uRes.value.set(bufW, bufH)
      canvasBg.style.position = 'fixed'
      canvasBg.style.left = '0'
      canvasBg.style.top = '0'
      canvasBg.style.margin = '0'

      if (overlayRenderer && canvasOverlay && overlayCam) {
        overlayCam.left = -0.5 * aspect
        overlayCam.right = 0.5 * aspect
        overlayCam.top = 0.5
        overlayCam.bottom = -0.5
        overlayCam.updateProjectionMatrix()
        overlayRenderer.setPixelRatio(dpr)
        overlayRenderer.setSize(cssW, cssH, true)
        canvasOverlay.style.position = 'fixed'
        canvasOverlay.style.left = '0'
        canvasOverlay.style.top = '0'
        canvasOverlay.style.margin = '0'
      }
    }

    function getPointerUV(e) {
      var vw = window.visualViewport ? window.visualViewport.width : window.innerWidth
      var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight
      var x =
        e.clientX != null
          ? e.clientX
          : e.touches && e.touches[0]
            ? e.touches[0].clientX
            : vw * 0.5
      var y =
        e.clientY != null
          ? e.clientY
          : e.touches && e.touches[0]
            ? e.touches[0].clientY
            : vh * 0.5
      shared.uPointer.value.set(x / vw, 1.0 - y / vh)
    }

    function onDown(e) {
      shared.uPointerDown.value = 1
      getPointerUV(e)
    }
    function onUp() {
      shared.uPointerDown.value = 0
    }
    var lastMove = 0
    function onMove(e) {
      if (Date.now() - lastMove < (isMobile ? 50 : 40)) return
      lastMove = Date.now()
      getPointerUV(e)
    }

    // Pointer Events cover touch — avoid preventDefault that blocks future scroll chapters.
    section.addEventListener('pointermove', onMove)
    section.addEventListener('pointerdown', onDown)
    section.addEventListener('pointerup', onUp)
    section.addEventListener('pointerleave', onUp)
    section.addEventListener('pointercancel', onUp)

    window.addEventListener('resize', setSize)
    if (window.visualViewport) window.visualViewport.addEventListener('resize', setSize)
    setSize()

    var firstFrame = true
    function animate(time) {
      requestAnimationFrame(animate)
      if (firstFrame) {
        firstFrame = false
        setSize()
      }
      shared.uTime.value = time * 0.001
      renderer.render(sceneBg, cam)
      if (overlayRenderer && overlayScene && overlayCam) {
        overlayRenderer.clear()
        overlayRenderer.render(overlayScene, overlayCam)
      }
    }
    requestAnimationFrame(animate)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWaterGL)
  } else {
    initWaterGL()
  }
})()
