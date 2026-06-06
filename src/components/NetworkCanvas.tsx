'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function FloatingNodes() {
  const count = 40;
  const meshRef = useRef<THREE.Group>(null);

  // Generate random particles (nodes)
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 15;
      const y = (Math.random() - 0.5) * 15;
      const z = (Math.random() - 0.5) * 15;
      const vx = (Math.random() - 0.5) * 0.015;
      const vy = (Math.random() - 0.5) * 0.015;
      const vz = (Math.random() - 0.5) * 0.015;
      temp.push({ pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(vx, vy, vz) });
    }
    return temp;
  }, []);

  // Update positions and float them
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (meshRef.current) {
      // Slow overall rotation
      meshRef.current.rotation.y = time * 0.05;
      meshRef.current.rotation.x = time * 0.02;
    }

    particles.forEach((p) => {
      p.pos.add(p.vel);
      // Bounce boundaries
      if (Math.abs(p.pos.x) > 8) p.vel.x *= -1;
      if (Math.abs(p.pos.y) > 8) p.vel.y *= -1;
      if (Math.abs(p.pos.z) > 8) p.vel.z *= -1;
    });
  });

  return (
    <group ref={meshRef}>
      {/* Node Spheres */}
      {particles.map((p, i) => (
        <mesh key={i} position={p.pos}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#f472b6" />
        </mesh>
      ))}

      {/* Connective Lines - Render lines between close nodes */}
      {particles.map((p1, i) => {
        return particles.slice(i + 1).map((p2, j) => {
          const dist = p1.pos.distanceTo(p2.pos);
          if (dist < 4.0) {
            // Line points
            const points = [p1.pos, p2.pos];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            return (
              <line key={`${i}-${j}`} {...({ geometry: lineGeometry } as any)}>
                <lineBasicMaterial
                  color="#38bdf8"
                  transparent
                  opacity={Math.max(0, 1 - dist / 4.0) * 0.4}
                />
              </line>
            );
          }
          return null;
        });
      })}
    </group>
  );
}

export default function NetworkCanvas() {
  return (
    <div className="w-full h-full absolute inset-0 z-0 pointer-events-none opacity-40">
      <Canvas camera={{ position: [0, 0, 12], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <FloatingNodes />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
