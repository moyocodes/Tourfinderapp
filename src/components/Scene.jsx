import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mesh } from 'topojson-client'
import land from 'world-atlas/land-110m.json'
import { latLngToVec3, shortestAngle } from '../lib/geo'
import { useThemeColors } from '../useThemeColors'

/*
 * The 3D layer behind the chat: a drifting star field that parallaxes with the
 * pointer, and a coastline globe that flies to whatever the conversation is
 * about. It never takes pointer events itself — dragging is handled by the
 * <GlobeStage> div in the layout, which writes into `drag`.
 */

const DEG = Math.PI / 180
const REDUCED =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Scene({ stageRef, calloutRef, drag, focus, home, markers, highlight, raised }) {
  const colors = useThemeColors()
  return (
    <Canvas
      // Raised above the full-screen reveal overlay; otherwise behind everything.
      style={{ position: 'fixed', inset: 0, zIndex: raised ? 35 : 0, pointerEvents: 'none' }}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 10], fov: 45 }}
      gl={{ alpha: true, antialias: true }}
    >
      <Stars colors={colors} />
      <Globe
        stageRef={stageRef}
        calloutRef={calloutRef}
        drag={drag}
        focus={focus}
        home={home}
        markers={markers}
        highlight={highlight}
        colors={colors}
      />
    </Canvas>
  )
}

/** Normalised pointer position (-1..1), tracked on window so the canvas can stay inert. */
function usePointer() {
  const p = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const move = (e) => {
      p.current.x = (e.clientX / window.innerWidth) * 2 - 1
      p.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])
  return p
}

/** Soft round sprite, so points read as specks of light rather than squares. */
function useDotTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.6)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  }, [])
}

/** Random points in a slab around and behind the globe. */
function starGeometry(n) {
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30
    pos[i * 3 + 1] = (Math.random() - 0.5) * 20
    pos[i * 3 + 2] = -Math.random() * 22 + 4
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3))
}

function Stars({ colors }) {
  const ref = useRef()
  const pointer = usePointer()
  const dot = useDotTexture()

  const geometry = useMemo(() => starGeometry(1400), [])

  useFrame((state, dt) => {
    if (!REDUCED) ref.current.rotation.y += dt * 0.008
    // Camera drifts toward the pointer; near stars move more than far ones,
    // which is where the depth comes from.
    const k = 1 - Math.exp(-dt * 2)
    const cam = state.camera
    cam.position.x += (pointer.current.x * 0.5 - cam.position.x) * k
    cam.position.y += (pointer.current.y * 0.35 - cam.position.y) * k
    cam.lookAt(0, 0, 0)
  })

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        map={dot}
        size={colors.dark ? 0.09 : 0.07}
        sizeAttenuation
        color={colors.accent}
        transparent
        opacity={colors.dark ? 0.75 : 0.3}
        depthWrite={false}
        blending={colors.dark ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  )
}

/** Coastlines from Natural Earth (110m) as line segments on the unit sphere. */
function coastlineGeometry() {
  const lines = mesh(land, land.objects.land).coordinates
  const pts = []
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      pts.push(...latLngToVec3(line[i][1], line[i][0], 1.002))
      pts.push(...latLngToVec3(line[i + 1][1], line[i + 1][0], 1.002))
    }
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
}

/** Parallels and meridians every 30°. */
function graticuleGeometry() {
  const pts = []
  const step = 4
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lng = -180; lng < 180; lng += step) {
      pts.push(...latLngToVec3(lat, lng, 1.001), ...latLngToVec3(lat, lng + step, 1.001))
    }
  }
  for (let lng = -180; lng < 180; lng += 30) {
    for (let lat = -90; lat < 90; lat += step) {
      pts.push(...latLngToVec3(lat, lng, 1.001), ...latLngToVec3(lat + step, lng, 1.001))
    }
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
}

const atmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec3 vNormal;
    void main() {
      float rim = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
      gl_FragColor = vec4(uColor, clamp(rim, 0.0, 1.0) * uOpacity);
    }`,
}

/**
 * Where the globe should sit, in world units. Over the stage div when it's
 * visible (wide screens); otherwise centred and faded, as ambience behind the chat.
 */
function useLayout(stageRef) {
  const { size, camera } = useThree()
  const layout = useRef({ x: 0, y: 0, r: 1, ambient: true })

  useEffect(() => {
    const measure = () => {
      const visibleH = 2 * camera.position.z * Math.tan((camera.fov / 2) * DEG)
      const px = visibleH / size.height
      const rect = stageRef.current?.getBoundingClientRect()
      if (rect && rect.width > 0) {
        layout.current = {
          x: (rect.left + rect.width / 2 - size.width / 2) * px,
          y: -(rect.top + rect.height / 2 - size.height / 2) * px,
          r: Math.min(rect.width * 0.4, rect.height * 0.3) * px,
          ambient: false,
        }
      } else {
        layout.current = {
          x: 0,
          y: -size.height * 0.08 * px,
          r: Math.min(size.width, size.height) * 0.46 * px,
          ambient: true,
        }
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (stageRef.current) ro.observe(stageRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [stageRef, size, camera])

  return layout
}

function Globe({ stageRef, calloutRef, drag, focus, home, markers, highlight, colors }) {
  const group = useRef()
  const { camera, size } = useThree()
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), c: new THREE.Vector3(), n: new THREE.Vector3() }), [])
  const spin = useRef()
  const fade = useRef(1)
  const layout = useLayout(stageRef)
  // Where the globe is looking now, and where it's heading (null = idle spin).
  const view = useRef({ lat: 18, lng: home?.lng ?? 10 })
  const target = useRef(null)

  const coast = useMemo(() => coastlineGeometry(), [])
  const grid = useMemo(() => graticuleGeometry(), [])
  const mats = useRef({})

  useEffect(() => {
    // A new focus overrides wherever the user had dragged to.
    target.current = focus ? { lat: Math.max(-55, Math.min(55, focus.lat)), lng: focus.lng } : null
    if (focus && REDUCED) view.current = { ...target.current }
  }, [focus?.lat, focus?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const d = drag.current
    if (d.dx || d.dy) {
      view.current.lng -= d.dx * 0.35
      view.current.lat = Math.max(-70, Math.min(70, view.current.lat + d.dy * 0.35))
      d.dx = d.dy = 0
      target.current = null
    }

    const k = 1 - Math.exp(-dt * 2.2)
    if (target.current) {
      view.current.lat += (target.current.lat - view.current.lat) * k
      view.current.lng += shortestAngle(view.current.lng, target.current.lng) * k
    } else if (!REDUCED && !d.active && performance.now() - d.last > 2500) {
      view.current.lng += dt * 5
    }
    spin.current.rotation.set(view.current.lat * DEG, -view.current.lng * DEG, 0)

    // Ease position and size, so the globe glides when the layout changes.
    const L = layout.current
    const g = group.current
    const m = 1 - Math.exp(-dt * 4)
    g.position.x += (L.x - g.position.x) * m
    g.position.y += (L.y - g.position.y) * m
    g.scale.setScalar(g.scale.x + (L.r - g.scale.x) * m)
    fade.current += ((L.ambient ? 0.35 : 1) - fade.current) * m

    const f = fade.current
    if (mats.current.body) mats.current.body.opacity = (colors.dark ? 0.92 : 0.8) * f
    if (mats.current.coast) mats.current.coast.opacity = 0.85 * f
    if (mats.current.grid) mats.current.grid.opacity = 0.18 * f
    if (mats.current.atmo) mats.current.atmo.uniforms.uOpacity.value = (colors.dark ? 0.42 : 0.25) * f

    // Pin the HTML callout to the focus point; hide it when that point turns
    // to the far side, or when the globe is only ambience behind the chat.
    const el = calloutRef.current
    if (el) {
      if (!focus || L.ambient) {
        el.style.opacity = '0'
      } else {
        g.updateMatrixWorld(true)
        const p = tmp.p.set(...latLngToVec3(focus.lat, focus.lng, 1.0))
        spin.current.localToWorld(p)
        tmp.c.setFromMatrixPosition(g.matrixWorld)
        const facing = tmp.n.copy(p).sub(tmp.c).normalize().dot(tmp.c.copy(camera.position).sub(p).normalize())
        p.project(camera)
        const x = ((p.x + 1) / 2) * size.width
        const y = ((1 - p.y) / 2) * size.height
        el.style.transform = `translate(${x}px, ${y}px)`
        el.style.opacity = facing > 0.2 ? '1' : '0'
      }
    }
  })

  const atmoUniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color() }, uOpacity: { value: 1 } }),
    [],
  )
  // The halo takes the visitor's accent, so their colour choice shows on the world.
  atmoUniforms.uColor.value.set(colors.accent)

  return (
    <group ref={group}>
      {/* Halo — a back-faced shell, so it rims the globe without covering it. */}
      <mesh scale={1.18} renderOrder={0}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          ref={(m) => (mats.current.atmo = m)}
          {...atmosphereShader}
          uniforms={atmoUniforms}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          blending={colors.dark ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </mesh>

      <group ref={spin}>
        {/* Body is drawn first and writes depth, so far-side lines are hidden. */}
        <mesh renderOrder={1}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshBasicMaterial ref={(m) => (mats.current.body = m)} color={colors.ground2} transparent />
        </mesh>
        <lineSegments geometry={grid} renderOrder={2}>
          <lineBasicMaterial ref={(m) => (mats.current.grid = m)} color={colors.faint} transparent />
        </lineSegments>
        <lineSegments geometry={coast} renderOrder={3}>
          <lineBasicMaterial ref={(m) => (mats.current.coast = m)} color={colors.sand} transparent />
        </lineSegments>

        {markers.map((p, i) => (
          <Marker
            key={`${p.lat},${p.lng},${i}`}
            point={p}
            color={colors.accent}
            active={highlight && highlight.lat === p.lat && highlight.lng === p.lng}
          />
        ))}
        {home && <HomePin point={home} color={colors.geo} />}
        {focus && !(home && focus.lat === home.lat && focus.lng === home.lng) && (
          <Beacon point={focus} color={colors.accent} />
        )}
        {home && focus && <Arc from={home} to={focus} color={colors.accent} />}
      </group>
    </group>
  )
}

function Marker({ point, color, active }) {
  const ref = useRef()
  const pos = useMemo(() => latLngToVec3(point.lat, point.lng, 1.012), [point.lat, point.lng])
  useFrame((_, dt) => {
    const s = ref.current.scale.x
    const goal = active ? 2.2 : 1
    ref.current.scale.setScalar(s + (goal - s) * (1 - Math.exp(-dt * 10)))
  })
  return (
    <mesh ref={ref} position={pos} renderOrder={4}>
      <sphereGeometry args={[0.016, 12, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

/** The place being talked about: a beam of light standing out of the surface. */
function Beacon({ point, color }) {
  const ref = useRef()
  const beamMat = useRef()
  const pos = useMemo(() => new THREE.Vector3(...latLngToVec3(point.lat, point.lng, 1)), [point.lat, point.lng])

  useEffect(() => {
    // Orient +y (the cylinder's axis) along the surface normal.
    ref.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize())
    ref.current.scale.set(1, REDUCED ? 1 : 0.01, 1)
  }, [pos])

  useFrame(({ clock }, dt) => {
    const s = ref.current.scale
    s.y += (1 - s.y) * (1 - Math.exp(-dt * 5))
    beamMat.current.opacity = 0.55 + Math.sin(clock.elapsedTime * 3) * 0.2
  })

  return (
    <group ref={ref} position={pos}>
      <mesh position={[0, 0.14, 0]} renderOrder={5}>
        <cylinderGeometry args={[0.004, 0.012, 0.28, 8, 1, true]} />
        <meshBasicMaterial ref={beamMat} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <ringGeometry args={[0.02, 0.034, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** The user's own position: a dot with a ring pulsing outward from it. */
function HomePin({ point, color }) {
  const ring = useRef()
  const ringMat = useRef()
  const pos = useMemo(() => new THREE.Vector3(...latLngToVec3(point.lat, point.lng, 1.006)), [point.lat, point.lng])

  useEffect(() => {
    // Face the ring outward along the surface normal.
    ring.current.lookAt(pos.clone().multiplyScalar(2))
  }, [pos])

  useFrame(({ clock }) => {
    const t = REDUCED ? 0.4 : (clock.elapsedTime * 0.6) % 1
    ring.current.scale.setScalar(1 + t * 2.5)
    ringMat.current.opacity = 0.9 * (1 - t)
  })

  return (
    <>
      <mesh position={pos} renderOrder={4}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ring} position={pos} renderOrder={4}>
        <ringGeometry args={[0.025, 0.032, 32]} />
        <meshBasicMaterial ref={ringMat} color={color} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </>
  )
}

/** Great-circle-ish arc from home to the current focus, drawn on over ~1s. */
function Arc({ from, to, color }) {
  const line = useMemo(() => {
    const a = new THREE.Vector3(...latLngToVec3(from.lat, from.lng, 1.005))
    const b = new THREE.Vector3(...latLngToVec3(to.lat, to.lng, 1.005))
    const dist = a.distanceTo(b)
    const mid = a.clone().add(b).normalize().multiplyScalar(1 + dist * 0.45)
    const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(80)
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    geo.setDrawRange(0, REDUCED ? pts.length : 0)
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
    const l = new THREE.Line(geo, mat)
    l.renderOrder = 4
    l.userData = { dist, total: pts.length, drawn: REDUCED ? pts.length : 0 }
    return l
  }, [from.lat, from.lng, to.lat, to.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    line.material.color.set(color)
  }, [line, color])
  useEffect(() => () => line.geometry.dispose(), [line])

  useFrame((_, dt) => {
    const u = line.userData
    if (u.drawn < u.total) {
      u.drawn = Math.min(u.total, u.drawn + dt * u.total * 0.9)
      line.geometry.setDrawRange(0, Math.floor(u.drawn))
    }
  })

  // Home and focus in the same spot — nothing to connect.
  if (line.userData.dist < 0.01) return null
  return <primitive object={line} />
}
