"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { BufferGeometry, Group, Mesh, MeshStandardMaterial } from "three";

/** A mesh whose material type is known, so it can be animated without a cast. */
type LitMesh = Mesh<BufferGeometry, MeshStandardMaterial>;

import { PALETTE } from "../palette.ts";

/**
 * The four things that can stand in the world. Each is authored facing +z, so
 * a spot's `rotation` in the database points it wherever it needs to face.
 *
 * Note on radial geometry: a cylinder's axis is already Y, so a short one is
 * a disc lying flat. Only a `planeGeometry` needs the -PI/2 to lie down.
 */

const SCREEN = "#8fd6ff";

export function ArcadeCabinet({ lit }: { lit: boolean }) {
  const screen = useRef<LitMesh>(null);

  useFrame((state) => {
    if (!screen.current) return;
    // A slow flicker, so an idle cabinet still reads as switched on.
    const t = state.clock.elapsedTime;
    screen.current.material.emissiveIntensity =
      1.1 + Math.sin(t * 2.3) * 0.12 + Math.sin(t * 7) * 0.04;
  });

  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.92, 1.7, 0.72]} />
        <meshStandardMaterial color="#42314a" roughness={0.7} />
      </mesh>

      {/* Marquee across the top, lit from inside. */}
      <mesh position={[0, 1.76, 0.06]} castShadow>
        <boxGeometry args={[0.98, 0.26, 0.62]} />
        <meshStandardMaterial
          color={PALETTE.blossom[1]}
          emissive={PALETTE.blossom[0]}
          emissiveIntensity={0.9}
          roughness={0.5}
        />
      </mesh>

      {/* Screen, tilted back the way a cabinet's is. */}
      <mesh ref={screen} position={[0, 1.29, 0.3]} rotation={[-0.22, 0, 0]}>
        <boxGeometry args={[0.7, 0.52, 0.06]} />
        <meshStandardMaterial
          color={SCREEN}
          emissive={SCREEN}
          emissiveIntensity={1.1}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, 1.29, 0.28]} rotation={[-0.22, 0, 0]}>
        <boxGeometry args={[0.82, 0.64, 0.05]} />
        <meshStandardMaterial color="#2b1f31" roughness={0.8} />
      </mesh>

      {/* Control panel */}
      <mesh position={[0, 0.98, 0.42]} rotation={[0.55, 0, 0]} castShadow>
        <boxGeometry args={[0.86, 0.34, 0.08]} />
        <meshStandardMaterial color="#33253a" roughness={0.75} />
      </mesh>
      {/* Joystick */}
      <mesh position={[-0.18, 1.12, 0.47]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.16, 8]} />
        <meshStandardMaterial color="#241a2a" roughness={0.6} />
      </mesh>
      <mesh position={[-0.18, 1.2, 0.48]}>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial color={PALETTE.blossom[0]} roughness={0.4} />
      </mesh>
      {/* Buttons */}
      {[0.06, 0.17, 0.28].map((x, i) => (
        <mesh
          key={x}
          position={[x, 1.11, 0.47]}
          // Lay the disc flat into the panel, matching its tilt.
          rotation={[0.55 + Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.035, 0.035, 0.02, 12]} />
          <meshStandardMaterial
            color={[PALETTE.blossom[0], PALETTE.lampLit, SCREEN][i]}
            emissive={[PALETTE.blossom[0], PALETTE.lampLit, SCREEN][i]}
            emissiveIntensity={0.5}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* Prize window near the floor, glowing when there is still one inside. */}
      <mesh position={[0, 0.4, 0.37]}>
        <boxGeometry args={[0.62, 0.44, 0.04]} />
        <meshStandardMaterial
          color={lit ? PALETTE.lampLit : "#3a2c42"}
          emissive={lit ? PALETTE.lampLit : "#000000"}
          emissiveIntensity={lit ? 0.8 : 0}
          roughness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>

      <pointLight position={[0, 1.3, 0.7]} color={SCREEN} intensity={3} distance={4} />
    </group>
  );
}

export function PhotoFrame({ tint = 0 }: { tint?: number }) {
  const colours = [PALETTE.blossom[1], PALETTE.lampLit, "#cfe4f0", PALETTE.blossom[3]];
  const photo = colours[tint % colours.length];
  const w = 0.72;
  const h = 0.56;
  const bar = 0.07;

  return (
    <group>
      {/* Post */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 1, 8]} />
        <meshStandardMaterial color={PALETTE.timber} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.06, 10]} />
        <meshStandardMaterial color={PALETTE.stone} roughness={1} flatShading />
      </mesh>

      {/* The photo itself, a touch emissive so it reads at dusk. */}
      <mesh position={[0, 1.24, 0.02]}>
        <boxGeometry args={[w, h, 0.03]} />
        <meshStandardMaterial
          color={photo}
          emissive={photo}
          emissiveIntensity={0.35}
          roughness={0.5}
        />
      </mesh>

      {/* Frame: four bars around the photo, not a slab behind it. */}
      {[
        { p: [0, 1.24 + h / 2 + bar / 2, 0], s: [w + bar * 2, bar, 0.08] },
        { p: [0, 1.24 - h / 2 - bar / 2, 0], s: [w + bar * 2, bar, 0.08] },
        { p: [-w / 2 - bar / 2, 1.24, 0], s: [bar, h + bar * 2, 0.08] },
        { p: [w / 2 + bar / 2, 1.24, 0], s: [bar, h + bar * 2, 0.08] },
      ].map((b, i) => (
        <mesh key={i} position={b.p as [number, number, number]} castShadow>
          <boxGeometry args={b.s as [number, number, number]} />
          <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function LetterNote() {
  const paper = useRef<Group>(null);

  useFrame((state) => {
    if (!paper.current) return;
    // A corner lifting in the breeze.
    paper.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.4) * 0.05;
  });

  return (
    <group>
      {/* A stone holding it down. */}
      <mesh position={[0.16, 0.05, -0.1]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial color={PALETTE.stone} roughness={1} flatShading />
      </mesh>

      <group ref={paper} position={[0, 0.02, 0.04]} rotation={[-1.24, 0, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.44, 0.012]} />
          <meshStandardMaterial color="#fff6ea" roughness={0.85} />
        </mesh>
        {/* Folded flap, so it reads as a note rather than a card. */}
        <mesh position={[0, -0.14, 0.012]} rotation={[0.22, 0, 0]} castShadow>
          <boxGeometry args={[0.34, 0.17, 0.01]} />
          <meshStandardMaterial color="#fdeedd" roughness={0.85} />
        </mesh>
        {/* A little wax seal. */}
        <mesh position={[0, -0.02, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.012, 12]} />
          <meshStandardMaterial color={PALETTE.blossom[0]} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

export function Keepsake({ found }: { found: boolean }) {
  const gem = useRef<Group>(null);

  useFrame((state) => {
    if (!gem.current) return;
    const t = state.clock.elapsedTime;
    gem.current.rotation.y = t * 0.6;
    // Once found it settles onto its stand instead of hovering.
    gem.current.position.y = found ? 0.24 : 0.32 + Math.sin(t * 1.7) * 0.05;
  });

  return (
    <group>
      {/* Little plinth */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.2, 0.1, 8]} />
        <meshStandardMaterial color={PALETTE.stone} roughness={1} flatShading />
      </mesh>

      <group ref={gem} position={[0, 0.32, 0]}>
        <mesh castShadow>
          <octahedronGeometry args={[0.13, 0]} />
          <meshStandardMaterial
            color={PALETTE.blossom[3]}
            emissive={PALETTE.blossom[3]}
            emissiveIntensity={found ? 0.35 : 1}
            roughness={0.25}
            metalness={0.25}
            flatShading
          />
        </mesh>
      </group>

      {!found && (
        <pointLight
          position={[0, 0.4, 0]}
          color={PALETTE.blossom[3]}
          intensity={3}
          distance={2.6}
        />
      )}
    </group>
  );
}
