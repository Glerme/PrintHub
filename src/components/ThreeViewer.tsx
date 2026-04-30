import { Suspense } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls, Bounds, Center, Environment } from '@react-three/drei'
import { STLLoader } from 'three-stdlib'
import * as THREE from 'three'

// ── STL scene (useLoader suspends — boundary inside Canvas handles this) ──────

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
}

export default function ThreeViewer({ filePath, fileExt }: Props) {
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
      gl={{ antialias: true }}
      className="w-full h-full"
    >
      {/*
        Inner Suspense: R3F uses its own reconciler — useLoader suspension
        must be caught by a boundary INSIDE the Canvas tree to avoid
        "no boundary found" errors in the R3F reconciler context.
        Outer Suspense in FileDetail handles the React.lazy import.
      */}
      <Suspense fallback={null}>
        <STLScene url={src} />
      </Suspense>

      <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
      <Environment preset="studio" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, -5, -5]} intensity={0.2} />
    </Canvas>
  )
}
