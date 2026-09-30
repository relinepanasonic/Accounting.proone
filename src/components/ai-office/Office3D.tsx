'use client';

// 3D office: a night-time building cut open at the front, one storey per floor, with hooded-visor robots.
// Robots sit at their desks while working (or queued) and wander to the pantry / lounge when idle.
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';

export type RobotState = 'idle' | 'working' | 'waiting';

export interface RobotView {
  id: string;
  name: string;
  title: string;
  floor: number; // 1 doers, 2 specialists, 3 boss office
  kind: 'planner' | 'qc' | 'worker';
  state: RobotState;
  task: string | null;
  brain: string;
}

const FLOOR_H = 3.6;
const W = 16;
const D = 5;
const floorY = (f: number) => (f - 1) * FLOOR_H + 0.11; // top surface of each slab

const PALETTE: Record<number, { hood: string; eye: string; shoe: string; accent: string; name: string }> = {
  3: { hood: '#c99a2e', eye: '#fff2c2', shoe: '#f5d77f', accent: '#ffcf5a', name: 'FLOOR 3 · BOSS OFFICE' },
  2: { hood: '#6b7280', eye: '#ffb4c0', shoe: '#fbcfd6', accent: '#ff8fa3', name: 'FLOOR 2 · SPECIALISTS' },
  1: { hood: '#d63030', eye: '#5fd0ff', shoe: '#ff5a4d', accent: '#5fd0ff', name: 'FLOOR 1 · WORKSPACE & PANTRY' },
};

const DESK_X: Record<number, number[]> = { 1: [-6.4, -4.2, -2.0, 0.2, 2.4], 2: [-5.2, -2.6, 0], 3: [-3.4, 2.2] };
const LOUNGE_X: Record<number, number[]> = { 1: [4.6, 5.5, 6.4, 7.1, 5.0], 2: [4.6, 5.6, 6.6, 5.1], 3: [5.4, 6.6] };
const DESK_Z = -1.35;

/** Canvas texture: night skyline with lit windows, used as the "view" behind the glass. */
function useCityTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 640;
    const g = c.getContext('2d')!;
    const sky = g.createLinearGradient(0, 0, 0, c.height);
    sky.addColorStop(0, '#120a2e');
    sky.addColorStop(0.55, '#3a1f5c');
    sky.addColorStop(1, '#7a3d6b');
    g.fillStyle = sky;
    g.fillRect(0, 0, c.width, c.height);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let layer = 0; layer < 2; layer++) {
      let x = -10;
      while (x < c.width) {
        const w = 40 + rnd() * 70;
        const h = (layer === 0 ? 150 : 90) + rnd() * (layer === 0 ? 300 : 170);
        g.fillStyle = layer === 0 ? '#181233' : '#0e0a22';
        g.fillRect(x, c.height - h, w, h);
        for (let wy = c.height - h + 10; wy < c.height - 8; wy += 13) {
          for (let wx = x + 6; wx < x + w - 8; wx += 11) {
            if (rnd() > 0.55) {
              g.fillStyle = rnd() > 0.85 ? '#7fd4ff' : rnd() > 0.5 ? '#ffd78a' : '#ffb35c';
              g.fillRect(wx, wy, 4, 6);
            }
          }
        }
        x += w + 4 + rnd() * 10;
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/** Draws text onto a canvas so labels live inside the 3D scene (no DOM overlays). */
function useLabelTexture(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number, key: string) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, w, h]);
  React.useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function Slab({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[W + 0.7, 0.22, D + 0.7]} />
        <meshStandardMaterial color="#1a1c28" roughness={0.55} metalness={0.3} />
      </mesh>
      {/* glowing front edge, like the strip lights in the reference */}
      <mesh position={[0, 0.02, D / 2 + 0.35]}>
        <boxGeometry args={[W + 0.7, 0.07, 0.05]} />
        <meshBasicMaterial color="#ff9d2e" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Desk({ x, floor, lit }: { x: number; floor: number; lit: boolean }) {
  const y = floorY(floor);
  const p = PALETTE[floor];
  return (
    <group position={[x, y, DESK_Z + 0.95]}>
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[2.0, 0.08, 0.9]} />
        <meshStandardMaterial color="#2b2f42" roughness={0.5} />
      </mesh>
      {[-0.9, 0.9].map((lx) => (
        <mesh key={lx} position={[lx, 0.4, 0]}>
          <boxGeometry args={[0.08, 0.8, 0.8]} />
          <meshStandardMaterial color="#14161f" />
        </mesh>
      ))}
      {/* laptop: back of the lid faces the viewer and glows when its robot works */}
      <mesh position={[0, 0.88, 0.05]}>
        <boxGeometry args={[0.7, 0.03, 0.5]} />
        <meshStandardMaterial color="#20232f" />
      </mesh>
      <group position={[0, 1.13, -0.16]} rotation={[-0.18, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.7, 0.48, 0.03]} />
          <meshStandardMaterial color="#1b1e2a" />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <circleGeometry args={[0.07, 24]} />
          <meshBasicMaterial color={lit ? p.accent : '#3a3f55'} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, y, D / 2 - 0.3]}>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.2, 0.16, 0.44, 12]} />
        <meshStandardMaterial color="#262a3a" />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <icosahedronGeometry args={[0.36, 1]} />
        <meshStandardMaterial color="#2f8f4e" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Sign({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const tex = useLabelTexture((g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(g, 4, 4, w - 8, h - 8, 14);
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = color;
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  }, 640, 96, text + color);
  return (
    <mesh position={[x, y, -D / 2 + 0.15]}>
      <planeGeometry args={[3.6, 0.54]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

function Building({ litDesks }: { litDesks: Set<string> }) {
  const city = useCityTexture();
  const H = 3 * FLOOR_H;
  return (
    <group>
      {/* city view behind the glass */}
      <mesh position={[0, H / 2, -D / 2 - 0.02]}>
        <planeGeometry args={[W + 0.7, H]} />
        <meshBasicMaterial map={city} toneMapped={false} />
      </mesh>
      {/* window mullions */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[-8 + i * 2, H / 2, -D / 2 + 0.02]}>
          <boxGeometry args={[0.07, H, 0.06]} />
          <meshStandardMaterial color="#0d0f18" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* side walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 + 0.3), H / 2, 0]}>
          <boxGeometry args={[0.25, H + 0.2, D + 0.7]} />
          <meshStandardMaterial color="#12141d" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Slab key={i} y={i * FLOOR_H} />
      ))}

      {[1, 2, 3].map((f) => {
        const y = floorY(f);
        const p = PALETTE[f];
        return (
          <group key={f}>
            {[-5.5, -1.8, 1.9, 5.6].map((lx) => (
              <mesh key={lx} position={[lx, y + FLOOR_H - 0.3, 0.2]}>
                <boxGeometry args={[1.8, 0.05, 0.55]} />
                <meshBasicMaterial color="#fff1d0" toneMapped={false} />
              </mesh>
            ))}
            <pointLight position={[-4.5, y + 2.6, 1.2]} intensity={34} distance={12} decay={2} color="#ffb060" />
            <pointLight position={[4.5, y + 2.6, 1.2]} intensity={34} distance={12} decay={2} color="#ffb060" />
            <Sign x={-6.4} y={y + FLOOR_H - 0.75} text={p.name} color={p.accent} />
            <Plant x={-7.5} y={y} />
            <Plant x={7.6} y={y} />
            {DESK_X[f].map((dx) => (
              <Desk key={dx} x={dx} floor={f} lit={litDesks.has(`${f}:${dx}`)} />
            ))}
          </group>
        );
      })}

      {/* floor 1: pantry */}
      <group position={[5.6, floorY(1), -1.9]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[3.4, 0.9, 0.7]} />
          <meshStandardMaterial color="#2b2f42" roughness={0.4} />
        </mesh>
        <mesh position={[-1.0, 1.1, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.4]} />
          <meshStandardMaterial color="#c3c7d6" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[-1.0, 1.15, 0.21]}>
          <circleGeometry args={[0.06, 16]} />
          <meshBasicMaterial color="#ff5a4d" toneMapped={false} />
        </mesh>
      </group>
      <Sign x={5.6} y={floorY(1) + 2.55} text="PANTRY" color="#ffcf5a" />

      {/* floor 2: lounge sofa */}
      <group position={[5.6, floorY(2), -1.7]}>
        <RoundedBox args={[3.0, 0.55, 0.95]} radius={0.12} position={[0, 0.3, 0]}>
          <meshStandardMaterial color="#3a3f66" roughness={0.7} />
        </RoundedBox>
        <RoundedBox args={[3.0, 0.7, 0.28]} radius={0.1} position={[0, 0.72, -0.42]}>
          <meshStandardMaterial color="#3a3f66" roughness={0.7} />
        </RoundedBox>
      </group>
      <Sign x={5.6} y={floorY(2) + 2.55} text="LOUNGE" color="#ff8fa3" />

      {/* floor 3: wall screens behind the boss desks */}
      {[-3.4, 2.2].map((sx) => (
        <mesh key={sx} position={[sx, floorY(3) + 1.9, -D / 2 + 0.12]}>
          <planeGeometry args={[2.6, 1.2]} />
          <meshBasicMaterial color="#1c3b63" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[5.6, floorY(3) + 0.5, -1.9]}>
        <boxGeometry args={[2.6, 1.0, 0.7]} />
        <meshStandardMaterial color="#2b2f42" roughness={0.4} />
      </mesh>
    </group>
  );
}

function RobotTag({ robot, onSelect }: { robot: RobotView; onSelect: (id: string) => void }) {
  const showTask = robot.state === 'working' && Boolean(robot.task);
  const task = robot.task ? (robot.task.length > 26 ? robot.task.slice(0, 25) + '…' : robot.task) : '';
  const tex = useLabelTexture((g, w, h) => {
    const dot = robot.state === 'working' ? '#34d399' : robot.state === 'waiting' ? '#fbbf24' : '#71717a';
    g.font = 'bold 40px sans-serif';
    const nameW = g.measureText(robot.name).width + 78;
    const nx = (w - nameW) / 2;
    g.fillStyle = 'rgba(0,0,0,0.78)';
    roundRect(g, nx, 8, nameW, 62, 31);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = dot;
    g.beginPath();
    g.arc(nx + 30, 39, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText(robot.name, nx + 50, 41);
    if (showTask) {
      g.font = 'bold 30px sans-serif';
      const tw = g.measureText(task).width + 36;
      g.fillStyle = 'rgba(212,175,55,0.95)';
      roundRect(g, (w - tw) / 2, 82, tw, 50, 14);
      g.fill();
      g.fillStyle = '#000000';
      g.textAlign = 'center';
      g.fillText(task, w / 2, 108);
    }
  }, 640, 144, robot.name + robot.state + task);
  return (
    <sprite position={[0, 2.85, 0]} scale={[2.9, 0.65, 1]} onClick={(e) => { e.stopPropagation(); onSelect(robot.id); }}>
      <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

function Robot({
  robot, deskX, loungeX, loungeZ, selected, onSelect,
}: {
  robot: RobotView; deskX: number; loungeX: number; loungeZ: number; selected: boolean; onSelect: (id: string) => void;
}) {
  const p = PALETTE[robot.floor];
  const y = floorY(robot.floor);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const eyeMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const seed = useMemo(() => Math.random() * 10, []);
  const start = useRef(false);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const t = state.clock.elapsedTime + seed;
    const atDesk = robot.state !== 'idle';
    const tx = atDesk ? deskX : loungeX;
    const tz = atDesk ? DESK_Z : loungeZ;

    if (!start.current) {
      g.position.set(tx, y, tz);
      start.current = true;
    }

    const dx = tx - g.position.x;
    const dz = tz - g.position.z;
    const dist = Math.hypot(dx, dz);
    const walking = dist > 0.05;
    if (walking) {
      const step = Math.min(dist, 1.7 * delta);
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
      const face = Math.atan2(dx, dz);
      let diff = face - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, delta * 9);
    } else {
      const target = atDesk ? 0 : Math.sin(t * 0.25) * 0.5; // idle robots glance around
      let diff = target - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, delta * 5);
    }

    const swing = walking ? Math.sin(t * 10) * 0.6 : 0;
    if (legL.current && legR.current) {
      legL.current.rotation.x = swing;
      legR.current.rotation.x = -swing;
    }
    if (armL.current && armR.current) {
      if (walking) {
        armL.current.rotation.x = -swing * 0.8;
        armR.current.rotation.x = swing * 0.8;
      } else if (robot.state === 'working') {
        armL.current.rotation.x = -1.05 + Math.sin(t * 14) * 0.16;
        armR.current.rotation.x = -1.05 + Math.sin(t * 14 + 1.7) * 0.16;
      } else if (robot.state === 'waiting') {
        armL.current.rotation.x = -0.2 + Math.sin(t * 2) * 0.05;
        armR.current.rotation.x = -0.2;
      } else {
        armL.current.rotation.x = Math.sin(t * 1.5) * 0.06;
        armR.current.rotation.x = -Math.sin(t * 1.5) * 0.06;
      }
    }
    if (body.current) {
      body.current.position.y = walking ? Math.abs(Math.sin(t * 10)) * 0.06 : Math.sin(t * 2) * 0.015;
    }
    if (head.current) {
      head.current.rotation.z = robot.state === 'waiting' ? Math.sin(t * 1.4) * 0.12 : 0;
      head.current.rotation.x = robot.state === 'working' && !walking ? -0.12 + Math.sin(t * 3) * 0.03 : 0;
    }

    const eyeColor = robot.state === 'waiting' ? '#fbbf24' : p.eye;
    const bright = robot.state === 'working' ? 1 : robot.state === 'waiting' ? 0.85 : 0.5 + Math.sin(t * 0.9) * 0.08;
    const blink = Math.sin(t * 0.7) > 0.985 ? 0.15 : 1;
    eyeMats.current.forEach((m) => {
      if (!m) return;
      m.color.set(eyeColor).multiplyScalar(bright);
    });
    if (head.current) head.current.scale.y = blink;
  });

  const setEye = (i: number) => (m: THREE.MeshBasicMaterial | null) => {
    if (m) eyeMats.current[i] = m;
  };

  return (
    <group ref={root} onClick={(e) => { e.stopPropagation(); onSelect(robot.id); }}>
      <group ref={body}>
        {/* legs */}
        <group ref={legL} position={[-0.15, 0.6, 0]}>
          <mesh position={[0, -0.26, 0]}><boxGeometry args={[0.17, 0.5, 0.19]} /><meshStandardMaterial color="#14161f" /></mesh>
          <mesh position={[0, -0.55, 0.04]}><boxGeometry args={[0.22, 0.1, 0.32]} /><meshStandardMaterial color={p.shoe} roughness={0.5} /></mesh>
        </group>
        <group ref={legR} position={[0.15, 0.6, 0]}>
          <mesh position={[0, -0.26, 0]}><boxGeometry args={[0.17, 0.5, 0.19]} /><meshStandardMaterial color="#14161f" /></mesh>
          <mesh position={[0, -0.55, 0.04]}><boxGeometry args={[0.22, 0.1, 0.32]} /><meshStandardMaterial color={p.shoe} roughness={0.5} /></mesh>
        </group>
        {/* torso + hoodie strings */}
        <RoundedBox args={[0.66, 0.62, 0.44]} radius={0.12} smoothness={3} position={[0, 0.92, 0]}>
          <meshStandardMaterial color={p.hood} roughness={0.85} />
        </RoundedBox>
        {[-0.07, 0.07].map((sx) => (
          <mesh key={sx} position={[sx, 0.92, 0.225]}><boxGeometry args={[0.025, 0.24, 0.015]} /><meshBasicMaterial color={p.eye} toneMapped={false} /></mesh>
        ))}
        {/* arms */}
        <group ref={armL} position={[-0.42, 1.14, 0]}>
          <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.15, 0.5, 0.16]} /><meshStandardMaterial color={p.hood} roughness={0.85} /></mesh>
          <mesh position={[0, -0.53, 0]}><sphereGeometry args={[0.09, 12, 12]} /><meshStandardMaterial color="#0d0e14" /></mesh>
        </group>
        <group ref={armR} position={[0.42, 1.14, 0]}>
          <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.15, 0.5, 0.16]} /><meshStandardMaterial color={p.hood} roughness={0.85} /></mesh>
          <mesh position={[0, -0.53, 0]}><sphereGeometry args={[0.09, 12, 12]} /><meshStandardMaterial color="#0d0e14" /></mesh>
        </group>
        {/* head: hood + dark glossy visor + glowing eyes */}
        <group ref={head} position={[0, 1.66, 0]}>
          <mesh scale={[1, 1.05, 0.95]}><sphereGeometry args={[0.52, 28, 24]} /><meshStandardMaterial color={p.hood} roughness={0.9} /></mesh>
          <mesh position={[0, -0.02, 0.3]} scale={[0.95, 0.85, 0.78]}><sphereGeometry args={[0.44, 28, 24]} /><meshStandardMaterial color="#07080c" metalness={0.7} roughness={0.2} /></mesh>
          {[-0.15, 0.15].map((ex, i) => (
            <mesh key={ex} position={[ex, 0.02, 0.63]}>
              <boxGeometry args={[0.09, 0.19, 0.03]} />
              <meshBasicMaterial ref={setEye(i)} color={p.eye} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>

      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.68, 32]} />
          <meshBasicMaterial color="#ffd166" toneMapped={false} />
        </mesh>
      )}

      <RobotTag robot={robot} onSelect={onSelect} />
    </group>
  );
}

export function Office3D({
  robots, selectedId, onSelect,
}: {
  robots: RobotView[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  // Give every robot a desk and a lounge spot on its floor, in a stable order.
  const placed = useMemo(() => {
    const counters: Record<number, number> = {};
    return robots
      .slice()
      .sort((a, b) => b.floor - a.floor || (a.kind === 'planner' ? -1 : 0) - (b.kind === 'planner' ? -1 : 0) || a.name.localeCompare(b.name))
      .map((r) => {
        const i = (counters[r.floor] = (counters[r.floor] ?? -1) + 1);
        const desks = DESK_X[r.floor] || DESK_X[1];
        const lounge = LOUNGE_X[r.floor] || LOUNGE_X[1];
        return {
          robot: r,
          deskX: desks[i % desks.length],
          loungeX: lounge[i % lounge.length],
          loungeZ: 0.5 + ((i * 0.6) % 1.4),
        };
      });
  }, [robots]);

  const litDesks = useMemo(() => {
    const s = new Set<string>();
    placed.forEach((p) => {
      if (p.robot.state === 'working') s.add(`${p.robot.floor}:${p.deskX}`);
    });
    return s;
  }, [placed]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 6.2, 19.5], fov: 42, near: 0.1, far: 120 }}
      gl={{ antialias: true }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={['#07080d']} />
      <fog attach="fog" args={['#07080d', 34, 70]} />
      <ambientLight intensity={1.15} color="#b9a8ff" />
      <hemisphereLight args={['#8fa2ff', '#1a1020', 0.55]} />
      <directionalLight position={[6, 12, 14]} intensity={0.6} color="#ffd9b0" />

      <Building litDesks={litDesks} />
      {placed.map((p) => (
        <Robot
          key={p.robot.id}
          robot={p.robot}
          deskX={p.deskX}
          loungeX={p.loungeX}
          loungeZ={p.loungeZ}
          selected={selectedId === p.robot.id}
          onSelect={onSelect}
        />
      ))}

      {/* ground */}
      <mesh position={[0, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#0a0b12" roughness={0.9} />
      </mesh>

      <OrbitControls
        target={[0, 5.4, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={9}
        maxDistance={32}
        minPolarAngle={0.85}
        maxPolarAngle={1.78}
        minAzimuthAngle={-1.05}
        maxAzimuthAngle={1.05}
      />
    </Canvas>
  );
}

export default Office3D;
