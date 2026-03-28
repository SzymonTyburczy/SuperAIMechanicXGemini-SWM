"use client";

import { useRef, useState, useEffect, Suspense, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  useGLTF,
  Html,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";

/* ─── Damage point data ─── */
/*
 * Marker positions are RELATIVE to the model's bounding box [0..1].
 * X: 0=left, 1=right  |  Y: 0=bottom, 1=top  |  Z: 0=rear, 1=front
 * Actual world positions are computed after model loads.
 */
const DAMAGE_POINTS = [
  {
    id: "door-dent",
    label: "Front right door",
    description: "20×12 cm dent with paint scratching",
    relPosition: [0.95, 0.45, 0.6] as [number, number, number],
    dealerPrice: 3800,
    marketplacePrice: 890,
    severity: "high" as const,
  },
  {
    id: "bumper-scratch",
    label: "Front bumper",
    description: "Surface scratches, minor paint chips",
    relPosition: [0.5, 0.25, 0.97] as [number, number, number],
    dealerPrice: 2200,
    marketplacePrice: 450,
    severity: "medium" as const,
  },
  {
    id: "underbody-corrosion",
    label: "Underbody — corrosion",
    description: "Rust spots on sill reinforcements",
    relPosition: [0.1, 0.1, 0.45] as [number, number, number],
    dealerPrice: 1800,
    marketplacePrice: 0,
    severity: "medium" as const,
  },
  {
    id: "rear-light",
    label: "Rear light — cracked",
    description: "Left tail light housing cracked",
    relPosition: [0.15, 0.4, 0.05] as [number, number, number],
    dealerPrice: 3200,
    marketplacePrice: 1400,
    severity: "high" as const,
  },
  {
    id: "tires",
    label: "Tires (2 pcs)",
    description: "Tread depth < 2mm, insufficient pressure",
    relPosition: [0.9, 0.18, 0.25] as [number, number, number],
    dealerPrice: 1600,
    marketplacePrice: 1100,
    severity: "low" as const,
  },
];

/* ─── Map Gemini bbox_hint → relative 3D position ─── */
const BBOX_TO_RELPOSITION: Record<string, [number, number, number]> = {
  // Polish hints (from Gemini prompt)
  "przód":       [0.5,  0.30, 0.97],
  "lewy-przód":  [0.10, 0.35, 0.85],
  "prawy-przód": [0.90, 0.35, 0.85],
  "lewy-bok":    [0.05, 0.40, 0.50],
  "prawy-bok":   [0.95, 0.40, 0.50],
  "lewy-tył":    [0.10, 0.40, 0.10],
  "prawy-tył":   [0.90, 0.40, 0.10],
  "tył":         [0.5,  0.35, 0.03],
  "dach":        [0.5,  0.95, 0.50],
  "podwozie":    [0.5,  0.05, 0.50],
  // English equivalents
  "front":       [0.5,  0.30, 0.97],
  "front-left":  [0.10, 0.35, 0.85],
  "front-right": [0.90, 0.35, 0.85],
  "left-side":   [0.05, 0.40, 0.50],
  "right-side":  [0.95, 0.40, 0.50],
  "rear-left":   [0.10, 0.40, 0.10],
  "rear-right":  [0.90, 0.40, 0.10],
  "rear":        [0.5,  0.35, 0.03],
  "roof":        [0.5,  0.95, 0.50],
  "underbody":   [0.5,  0.05, 0.50],
};

/* ─── Types ─── */
export interface ScanDamage {
  part: string;
  type: string;
  severity: "low" | "medium" | "high";
  repair_cost_pln: number;
  replace_cost_asm: number;
  can_repair: boolean;
  bbox_hint: string;
}

function scanDamageToDamagePoint(dmg: ScanDamage, index: number): DamagePoint {
  const relPos = BBOX_TO_RELPOSITION[dmg.bbox_hint];
  // Add small random offset to avoid overlapping markers
  const offset = index * 0.04;
  return {
    id: `scan-${index}-${dmg.part}`,
    label: dmg.part,
    description: dmg.type,
    relPosition: relPos
      ? [relPos[0] + offset * 0.1, relPos[1], relPos[2]] as [number, number, number]
      : [0.5, 0.4, 0.5] as [number, number, number],
    dealerPrice: dmg.replace_cost_asm,
    marketplacePrice: dmg.repair_cost_pln,
    severity: dmg.severity,
  };
}

type DamagePoint = (typeof DAMAGE_POINTS)[number];
type DamagePointWithWorldPos = DamagePoint & {
  position: [number, number, number];
};

/* ─── Loading indicator ─── */
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div
        style={{
          color: "#fff",
          fontSize: 14,
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 120,
            height: 2,
            background: "rgba(255,255,255,0.1)",
            borderRadius: 1,
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "#fff",
              borderRadius: 1,
              transition: "width 0.3s",
            }}
          />
        </div>
        <span style={{ fontSize: 11, opacity: 0.4 }}>Loading 3D model…</span>
      </div>
    </Html>
  );
}

/* ─── Studio floor ─── */
function StudioFloor() {
  return (
    <group>
      {/* Reflective floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          color="#2a2a2c"
          roughness={0.12}
          metalness={0.85}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Center spotlight pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial
          color="#333336"
          roughness={0.06}
          metalness={0.9}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

/* ─── Auto-fitting car model — normalize any GLB to standard size ─── */
function CarModel({
  onBoundsReady,
}: {
  onBoundsReady?: (box: THREE.Box3) => void;
}) {
  const { scene } = useGLTF("/car.glb");
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    // Reset transforms first (idempotent for strict mode double-execution)
    scene.scale.set(1, 1, 1);
    scene.position.set(0, 0, 0);
    scene.rotation.set(0, 0, 0);

    // Compute original bounding box
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());

    // Normalize: scale so the longest axis = 5 units (car-sized)
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 5;
    const scale = maxDim > 0 ? targetSize / maxDim : 1;

    scene.scale.setScalar(scale);
    scene.updateMatrixWorld(true);

    // Re-compute after scaling
    const scaledBox = new THREE.Box3().setFromObject(scene);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    const scaledSize = scaledBox.getSize(new THREE.Vector3());

    // Position: center horizontally, sit on ground (y=0)
    scene.position.x = -scaledCenter.x;
    scene.position.z = -scaledCenter.z;
    scene.position.y = -scaledBox.min.y; // bottom of car at y=0

    scene.updateMatrixWorld(true);

    // Setup shadows and enhance materials
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          mats.forEach((mat) => {
            if (
              mat instanceof THREE.MeshStandardMaterial ||
              mat instanceof THREE.MeshPhysicalMaterial
            ) {
              mat.envMapIntensity = 2.0;
              mat.needsUpdate = true;
            }
          });
        }
      }
    });

    // Report final world-space bounding box
    const finalBox = new THREE.Box3().setFromObject(scene);
    console.log(
      `[CarModel] final bounds: min=(${finalBox.min.x.toFixed(2)},${finalBox.min.y.toFixed(2)},${finalBox.min.z.toFixed(2)}) max=(${finalBox.max.x.toFixed(2)},${finalBox.max.y.toFixed(2)},${finalBox.max.z.toFixed(2)})`,
    );
    onBoundsReady?.(finalBox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  return <primitive ref={groupRef} object={scene} />;
}

/* ─── Interactive damage marker (3D) ─── */
function DamageMarker3D({
  point,
  isSelected,
  onSelect,
}: {
  point: DamagePointWithWorldPos;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const markerRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const severityColor = {
    high: "#e54d4d",
    medium: "#d4a346",
    low: "#4caf78",
  }[point.severity];

  useFrame((state) => {
    if (markerRef.current) {
      markerRef.current.position.y =
        point.position[1] +
        Math.sin(state.clock.elapsedTime * 2 + point.position[0]) * 0.03;
    }
    if (ringRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.15 + 1;
      ringRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group ref={markerRef} position={point.position}>
      {/* Outer glow ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.14, 32]} />
        <meshBasicMaterial
          color={severityColor}
          transparent
          opacity={isSelected ? 0.7 : hovered ? 0.5 : 0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center dot — clickable */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(point.id);
        }}
      >
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          color={isSelected || hovered ? "#fff" : severityColor}
          emissive={severityColor}
          emissiveIntensity={isSelected ? 2 : hovered ? 1.5 : 0.8}
        />
      </mesh>

      {/* Point light glow */}
      <pointLight
        color={severityColor}
        intensity={isSelected ? 0.5 : 0.2}
        distance={1.5}
      />

      {/* Label tooltip */}
      {(hovered || isSelected) && (
        <Html
          position={[0, 0.25, 0]}
          center
          style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.85)",
              border: `1px solid ${severityColor}40`,
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 600,
              color: "#fff",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {point.label}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ─── Scene ─── */
function Scene({
  hasBodyDamage,
  showDamageMarkers,
  selectedDamage,
  onSelectDamage,
  damagePoints,
}: {
  hasBodyDamage: boolean;
  showDamageMarkers: boolean;
  selectedDamage: string | null;
  onSelectDamage: (id: string) => void;
  damagePoints: DamagePoint[];
}) {
  const [carBounds, setCarBounds] = useState<THREE.Box3 | null>(null);

  const handleBoundsReady = useCallback((box: THREE.Box3) => {
    setCarBounds(box.clone());
  }, []);

  // Compute world positions from relative [0..1] coords + bounding box
  const markersWithWorldPos: DamagePointWithWorldPos[] = carBounds
    ? damagePoints.map((pt) => ({
        ...pt,
        position: [
          carBounds.min.x +
            pt.relPosition[0] * (carBounds.max.x - carBounds.min.x),
          carBounds.min.y +
            pt.relPosition[1] * (carBounds.max.y - carBounds.min.y),
          carBounds.min.z +
            pt.relPosition[2] * (carBounds.max.z - carBounds.min.z),
        ] as [number, number, number],
      }))
    : [];

  return (
    <>
      {/* Ambient — very bright so the car is clearly visible */}
      <ambientLight intensity={1.0} color="#e8ecf8" />

      {/* KEY light — top softbox */}
      <spotLight
        position={[0, 12, 4]}
        intensity={10}
        angle={0.5}
        penumbra={0.8}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      />

      {/* RIM light — left, cool */}
      <directionalLight
        position={[-10, 6, -5]}
        intensity={3.0}
        color="#c0d0f0"
      />

      {/* FILL light — right, warm */}
      <directionalLight position={[8, 5, 6]} intensity={2.5} color="#f0e8d0" />

      {/* Front fill — so the nose is visible */}
      <directionalLight position={[0, 4, 10]} intensity={2.0} color="#e8ecf4" />

      {/* Back accent — subtle blue */}
      <pointLight
        position={[0, 2, -10]}
        intensity={1.5}
        color="#4488cc"
        distance={20}
      />

      {/* Under-car fill light */}
      <pointLight
        position={[0, -1, 0]}
        intensity={0.5}
        color="#ffffff"
        distance={8}
      />

      {/* Environment — studio HDRI as background */}
      <Environment preset="studio" background environmentIntensity={1.0} />

      <StudioFloor />

      <CarModel onBoundsReady={handleBoundsReady} />

      {/* Interactive damage markers — only after bounds ready */}
      {showDamageMarkers &&
        hasBodyDamage &&
        carBounds &&
        markersWithWorldPos.map((point) => (
          <DamageMarker3D
            key={point.id}
            point={point}
            isSelected={selectedDamage === point.id}
            onSelect={onSelectDamage}
          />
        ))}

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.4}
        scale={20}
        blur={2}
        far={5}
        color="#000000"
      />
    </>
  );
}

/* ─── Price comparison popup ─── */
function DamageInfoPanel({
  point,
  onClose,
}: {
  point: DamagePoint;
  onClose: () => void;
}) {
  const severityColor = {
    high: "#e54d4d",
    medium: "#d4a346",
    low: "#4caf78",
  }[point.severity];

  const severityLabel = {
    high: "Severe",
    medium: "Moderate",
    low: "Minor",
  }[point.severity];

  const savings = point.dealerPrice - point.marketplacePrice;

  return (
    <div className="damage-popup" style={{ maxWidth: 300 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: severityColor }}
          />
          <h4 className="font-semibold text-sm text-white">{point.label}</h4>
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Severity */}
      <span
        className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-3"
        style={{
          color: severityColor,
          background: `${severityColor}15`,
          border: `1px solid ${severityColor}30`,
        }}
      >
        {severityLabel}
      </span>

      {/* Description */}
      <p className="text-xs text-white/50 mb-4 leading-relaxed">
        {point.description}
      </p>

      {/* Prices */}
      <div className="space-y-2">
        <div
          className="flex items-center justify-between p-3 rounded-lg"
          style={{
            background: "rgba(229, 77, 77, 0.06)",
            border: "1px solid rgba(229, 77, 77, 0.12)",
          }}
        >
          <div>
            <p className="text-[10px] text-white/35 mb-0.5">
              Authorized dealer
            </p>
            <p className="text-sm font-semibold text-[#e54d4d]">
              {point.dealerPrice.toLocaleString("en-US")} zł
            </p>
          </div>
          <span className="text-[10px] text-white/20 uppercase tracking-wider">
            OEM
          </span>
        </div>

        {point.marketplacePrice > 0 ? (
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{
              background: "rgba(76, 175, 120, 0.06)",
              border: "1px solid rgba(76, 175, 120, 0.12)",
            }}
          >
            <div>
              <p className="text-[10px] text-white/35 mb-0.5">Marketplace</p>
              <p className="text-sm font-semibold text-[#4caf78]">
                {point.marketplacePrice.toLocaleString("en-US")} zł
              </p>
            </div>
            <span className="text-[10px] text-[#4caf78]/60 font-medium">
              −{savings.toLocaleString("en-US")} zł
            </span>
          </div>
        ) : (
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div>
              <p className="text-[10px] text-white/35 mb-0.5">Marketplace</p>
              <p className="text-xs text-white/40">
                Service work only — no parts needed
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Viewer3D component ─── */
export default function Viewer3D({
  hasBodyDamage = true,
  scanDamages,
}: {
  hasBodyDamage?: boolean;
  scanDamages?: ScanDamage[];
}) {
  // If scan damages are provided, convert them to DamagePoint format
  const activeDamagePoints: DamagePoint[] =
    scanDamages && scanDamages.length > 0
      ? scanDamages.map((d, i) => scanDamageToDamagePoint(d, i))
      : DAMAGE_POINTS;
  const [showMarkers, setShowMarkers] = useState(true);
  const [selectedDamage, setSelectedDamage] = useState<string | null>(null);

  const handleSelectDamage = useCallback((id: string) => {
    setSelectedDamage((prev) => (prev === id ? null : id));
  }, []);

  const selectedPoint =
    activeDamagePoints.find((p) => p.id === selectedDamage) || null;

  return (
    <div className="relative w-full h-[420px] sm:h-[560px] lg:h-[760px] xl:h-[860px]">
      {/* Canvas */}
      <div className="absolute inset-0 viewer-3d rounded-2xl overflow-hidden">
        <Canvas
          shadows
          camera={{ position: [3.6, 0.85, 4.2], fov: 38, near: 0.1, far: 200 }}
          gl={{
            antialias: true,
            alpha: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.6,
          }}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            background: "#2a2a2e",
          }}
        >
          <Suspense fallback={<Loader />}>
            <Scene
              hasBodyDamage={hasBodyDamage}
              showDamageMarkers={showMarkers}
              selectedDamage={selectedDamage}
              onSelectDamage={handleSelectDamage}
              damagePoints={activeDamagePoints}
            />
            <OrbitControls
              enablePan={false}
              minPolarAngle={0.2}
              maxPolarAngle={Math.PI / 2 - 0.05}
              minDistance={1.8}
              maxDistance={9}
              autoRotate
              autoRotateSpeed={0.4}
              target={[0, 0.35, 0]}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Top overlay — car info + controls */}
      <div className="absolute top-4 left-5 right-5 flex items-start justify-between pointer-events-none z-10">
        <div className="pointer-events-auto">
          <p className="text-xs font-medium text-white/80 tracking-wide">
            {scanDamages && scanDamages.length > 0
              ? `${scanDamages.length} damages from scan`
              : "Audi A5 Sportback · 2022"}
          </p>
          <p className="text-[10px] text-white/35 mt-0.5">
            Click damage markers for price details
          </p>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button
            id="toggle-markers-btn"
            onClick={() => {
              setShowMarkers((v) => !v);
              if (showMarkers) setSelectedDamage(null);
            }}
            className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all"
            style={{
              background: showMarkers
                ? "rgba(229, 77, 77, 0.18)"
                : "rgba(255,255,255,0.08)",
              border: showMarkers
                ? "1px solid rgba(229, 77, 77, 0.35)"
                : "1px solid rgba(255,255,255,0.15)",
              color: showMarkers ? "#e54d4d" : "rgba(255,255,255,0.6)",
            }}
          >
            {showMarkers ? "● Damage" : "○ Damage"}
          </button>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
        <p className="text-[10px] text-white/30 tracking-wide">
          Drag to rotate · Scroll to zoom
        </p>
      </div>

      {/* Damage list sidebar — bottom left */}
      {showMarkers && hasBodyDamage && (
        <div className="absolute bottom-8 left-5 z-10 pointer-events-auto">
          <p className="text-[10px] font-medium text-white/45 uppercase tracking-wider mb-2">
            Detected damage ({activeDamagePoints.length})
          </p>
          {activeDamagePoints.map((point) => {
            const severityColor = {
              high: "#e54d4d",
              medium: "#d4a346",
              low: "#4caf78",
            }[point.severity];
            const isActive = selectedDamage === point.id;
            return (
              <button
                key={point.id}
                onClick={() => handleSelectDamage(point.id)}
                className="flex items-center gap-2 mb-1 last:mb-0 w-full text-left transition-all rounded px-1.5 py-0.5 -ml-1.5"
                style={{
                  background: isActive
                    ? "rgba(255,255,255,0.08)"
                    : "transparent",
                }}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: severityColor }}
                />
                <span
                  className="text-[11px] transition-colors"
                  style={{
                    color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
                  }}
                >
                  {point.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Price popup — bottom right */}
      {selectedPoint && (
        <div className="absolute bottom-8 right-5 z-20">
          <DamageInfoPanel
            point={selectedPoint}
            onClose={() => setSelectedDamage(null)}
          />
        </div>
      )}
    </div>
  );
}

useGLTF.preload("/car.glb");
