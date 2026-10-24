import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useThemeColors } from '../useThemeColors'

/*
 * Mobot — the app's guide, as a small 3D robot. Built from primitives (no
 * model file to download). It floats, blinks, follows the pointer with its
 * head, and acts out a `mood`:
 *   wave  — hand up, waving hello
 *   think — head tilted, eyes narrowed
 *   happy — eyes wide, little bounce
 * Bump `hop` (any changing number) to make it jump, e.g. when the user picks
 * something. Its eyes and antenna glow in the visitor's accent colour.
 */

const REDUCED =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Mobot({ mood = 'wave', hop = 0, size = 132 }) {
  const colors = useThemeColors()
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0.15, 4.2], fov: 35 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={colors.dark ? 0.55 : 0.8} />
        <directionalLight position={[2, 3, 4]} intensity={1.6} />
        <pointLight position={[-2, 0.5, 2]} intensity={6} color={colors.accent} distance={6} />
        <Bot mood={mood} hop={hop} colors={colors} />
      </Canvas>
    </div>
  )
}

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

function Bot({ mood, hop, colors }) {
  const root = useRef()
  const head = useRef()
  const eyes = [useRef(), useRef()]
  const hand = useRef()
  const otherHand = useRef()
  const bulb = useRef()
  const pointer = usePointer()
  const hopAt = useRef(-10)
  const blink = useRef({ next: 2, t: -1 })

  // Shell and visor materials are shared between meshes and follow the theme.
  const mats = useMemo(
    () => ({
      shell: new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.15 }),
      visor: new THREE.MeshStandardMaterial({ color: '#03141f', roughness: 0.15, metalness: 0.6 }),
      glow: new THREE.MeshStandardMaterial({ toneMapped: false }),
      trim: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }),
    }),
    [],
  )
  useEffect(() => {
    mats.shell.color.set(colors.dark ? '#e8f4f8' : '#ffffff')
    mats.glow.color.set(colors.accent)
    mats.glow.emissive.set(colors.accent)
    mats.glow.emissiveIntensity = 1.6
    mats.trim.color.set(colors.accent2)
  }, [mats, colors])

  useEffect(() => {
    hopAt.current = performance.now() / 1000
  }, [hop])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const now = performance.now() / 1000
    const k = 1 - Math.exp(-dt * 6)

    // Float, plus a hop that decays over half a second.
    const sinceHop = now - hopAt.current
    const jump = sinceHop < 0.5 ? Math.sin((sinceHop / 0.5) * Math.PI) * 0.35 : 0
    const bounce = mood === 'happy' && !REDUCED ? Math.abs(Math.sin(t * 4)) * 0.06 : 0
    root.current.position.y = (REDUCED ? 0 : Math.sin(t * 1.6) * 0.06) + jump + bounce
    root.current.rotation.y = sinceHop < 0.5 ? (sinceHop / 0.5) * Math.PI * 2 : 0

    // Head follows the pointer; "think" adds a curious tilt.
    const tiltZ = mood === 'think' ? 0.22 : 0
    head.current.rotation.y += (pointer.current.x * 0.5 - head.current.rotation.y) * k
    head.current.rotation.x += (-pointer.current.y * 0.3 - head.current.rotation.x) * k
    head.current.rotation.z += (tiltZ - head.current.rotation.z) * k

    // Blink every few seconds; mood sets the resting eye shape.
    const b = blink.current
    if (t > b.next) {
      b.t = t
      b.next = t + 2.5 + Math.random() * 2.5
    }
    const blinking = t - b.t < 0.14
    const open = mood === 'think' ? 0.45 : mood === 'happy' ? 1.25 : 1
    for (const e of eyes) {
      const goal = blinking ? 0.08 : open
      e.current.scale.y += (goal - e.current.scale.y) * (blinking ? 1 : k)
    }

    // Waving arm.
    const wave = mood === 'wave' && !REDUCED
    hand.current.position.y += ((wave ? 0.15 : -0.55) - hand.current.position.y) * k
    hand.current.rotation.z = wave ? Math.sin(t * 9) * 0.5 : 0
    otherHand.current.position.y = -0.55 + (REDUCED ? 0 : Math.sin(t * 1.6 + 1) * 0.03)

    bulb.current.scale.setScalar(1 + Math.sin(t * 3) * 0.12)
  })

  return (
    <group ref={root}>
      <group ref={head} position={[0, 0.25, 0]}>
        {/* Head shell */}
        <mesh material={mats.shell} scale={[1, 0.82, 0.88]}>
          <sphereGeometry args={[0.72, 48, 48]} />
        </mesh>
        {/* Visor */}
        <mesh material={mats.visor} position={[0, -0.02, 0.36]} scale={[0.82, 0.52, 0.5]}>
          <sphereGeometry args={[0.62, 48, 48]} />
        </mesh>
        {/* Eyes */}
        {[-0.2, 0.2].map((x, i) => (
          <mesh key={x} ref={eyes[i]} material={mats.glow} position={[x, 0.0, 0.66]}>
            <capsuleGeometry args={[0.065, 0.1, 6, 16]} />
          </mesh>
        ))}
        {/* Ears */}
        {[-0.74, 0.74].map((x) => (
          <mesh key={x} material={mats.trim} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.15, 0.15, 0.12, 24]} />
          </mesh>
        ))}
        {/* Antenna */}
        <mesh material={mats.trim} position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.28, 8]} />
        </mesh>
        <mesh ref={bulb} material={mats.glow} position={[0, 0.88, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
        </mesh>
      </group>

      {/* Body */}
      <mesh material={mats.shell} position={[0, -0.72, 0]} scale={[1, 0.8, 0.85]}>
        <sphereGeometry args={[0.42, 32, 32]} />
      </mesh>
      <mesh material={mats.glow} position={[0, -0.62, 0.34]}>
        <circleGeometry args={[0.07, 24]} />
      </mesh>

      {/* Floating hands */}
      <mesh ref={hand} material={mats.trim} position={[0.6, -0.55, 0.1]}>
        <sphereGeometry args={[0.12, 20, 20]} />
      </mesh>
      <mesh ref={otherHand} material={mats.trim} position={[-0.6, -0.55, 0.1]}>
        <sphereGeometry args={[0.12, 20, 20]} />
      </mesh>
    </group>
  )
}
