import { Suspense, useEffect, useRef } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Canvas, useLoader, useThree } from '@react-three/fiber'
import { OrbitControls, Bounds, Center, Environment } from '@react-three/drei'
import { STLLoader } from 'three-stdlib'
import * as THREE from 'three'
import { saveStlThumbnail } from '../lib/commands'

// ── Thumbnail capture (runs inside Canvas, fires once after first render) ─────

const THUMB_SIZE = 256

function ThumbnailCapture({ fileId }: { fileId: number }) {
  const { gl } = useThree()
  const captured = useRef(false)

  useEffect(() => {
    if (captured.current) return

    // Two RAF frames: React commit → R3F render → canvas is populated
    let raf1: number, raf2: number
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        try {
          // Resize to THUMB_SIZE × THUMB_SIZE off-screen
          const offscreen = document.createElement('canvas')
          offscreen.width = THUMB_SIZE
          offscreen.height = THUMB_SIZE
          const ctx = offscreen.getContext('2d')
          if (!ctx) return
          ctx.drawImage(gl.domElement, 0, 0, THUMB_SIZE, THUMB_SIZE)
          const data = offscreen.toDataURL('image/png')
          const b64 = data.replace(/^data:image\/png;base64,/, '')
          // Mark captured only after backend confirms save — allows retry on failure
          saveStlThumbnail(fileId, b64)
            .then(() => { captured.current = true })
            .catch(console.warn)
        } catch (e) {
          console.warn('thumbnail capture failed:', e)
        }
      })
    })

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [gl, fileId])

  return null
}

// ── STL scene ─────────────────────────────────────────────────────────────────

function STLScene({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url)
  return (
    <Bounds fit clip observe>
      <Center>
        <mesh geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color="#7c3aed"
            roughness={0.45}
            metalness={0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Center>
    </Bounds>
  )
}

// ── Main component (lazy-loaded by FileDetail) ────────────────────────────────

interface Props {
  filePath: string
  fileExt: 'stl' | '3mf'
  /** If provided and hasThumbnail=false, auto-generates and caches the thumbnail */
  fileId?: number
  hasThumbnail?: boolean
}

export default function ThreeViewer({ filePath, fileExt, fileId, hasThumbnail }: Props) {
  const shouldCapture = fileExt === 'stl' && fileId !== undefined && !hasThumbnail

  if (fileExt !== 'stl') {
    return (
      <div className="flex items-center justify-center h-full text-center px-8">
        <p className="text-zinc-500 text-sm leading-relaxed">
          Viewer 3D para arquivos <span className="text-emerald-400 font-mono">.3mf</span> em
          desenvolvimento.<br />
          O thumbnail foi extraído automaticamente do arquivo.
        </p>
      </div>
    )
  }

  const src = convertFileSrc(filePath)

  return (
    <Canvas
      shadows
      camera={{ position: [3, 3, 3], fov: 50 }}
      // preserveDrawingBuffer required for toDataURL() to work
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      className="w-full h-full"
    >
      {/*
        Inner Suspense: R3F uses its own reconciler — useLoader suspension
        must be caught by a boundary INSIDE the Canvas tree.
        Outer Suspense in FileDetail handles the React.lazy import.
      */}
      <Suspense fallback={null}>
        <STLScene url={src} />
        {shouldCapture && <ThumbnailCapture fileId={fileId} />}
      </Suspense>

      <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
      <Environment preset="studio" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, -5, -5]} intensity={0.2} />
    </Canvas>
  )
}
