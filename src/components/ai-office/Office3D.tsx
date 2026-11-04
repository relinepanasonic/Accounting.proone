'use client';

// 3D office in the sky: every team owns a hexagonal island with a glowing border, a tiled floor, one dome pod per
// agent, a command hub in the middle and some cargo. Islands sit side by side like a honeycomb, floating above the
// clouds, with a day / night cycle. Robots sit at their pod while working (or queued). When idle they leave the working space:
// the leaders go to the Bar, every other agent to a bed in the Bunker, over modern bridges.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import { Clock3, Moon, Sun } from 'lucide-react';

export type RobotState = 'idle' | 'working' | 'waiting';

export interface RobotView {
  id: string;
  teamId: string | null;
  name: string;
  title: string;
  floor: number; // 1 doers, 2 specialists, 3 boss office (colours the robot)
  kind: 'planner' | 'qc' | 'worker' | 'researcher' | 'installer';
  state: RobotState;
  task: string | null;
  brain: string;
}

export interface TeamView {
  id: string;
  name: string;
}

const HEX_R = 6.5; // island radius (corner to centre)
const APOTHEM = HEX_R * Math.sqrt(3) / 2;
const SURFACE_Y = 0.3; // top of an island
const GAP = 2.4; // empty sky between two islands
const SPACING = APOTHEM * 2 + GAP;
const TEAM_COLORS = ['#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#f87171'];
const NO_TEAM = '__none__';

const PALETTE: Record<number, { hood: string; eye: string; shoe: string; accent: string }> = {
  3: { hood: '#c99a2e', eye: '#fff2c2', shoe: '#f5d77f', accent: '#ffcf5a' },
  2: { hood: '#6b7280', eye: '#ffb4c0', shoe: '#fbcfd6', accent: '#ff8fa3' },
  1: { hood: '#d63030', eye: '#5fd0ff', shoe: '#ff5a4d', accent: '#5fd0ff' },
};
const paletteOf = (floor: number) => PALETTE[floor] || PALETTE[1];

/** Day amount shared with every part of the scene: 1 = full day, 0 = full night. Read inside useFrame. */
const DayCtx = createContext<React.MutableRefObject<number>>({ current: 1 });

// ---------------------------------------------------------------- layout
/** Island centres: team 0 in the middle, the next six around it (edge to edge), then a second ring. */
function teamCenter(i: number): [number, number] {
  if (i === 0) return [0, 0];
  const ring = i <= 6 ? 1 : 2;
  const k = i <= 6 ? i - 1 : i - 7;
  const count = ring === 1 ? 6 : 12;
  const phi = ((30 + (360 / count) * k) * Math.PI) / 180; // 30 degrees: neighbours meet along a flat edge
  const d = SPACING * ring * (ring === 2 ? 0.95 : 1);
  return [Math.sin(phi) * d, Math.cos(phi) * d];
}

interface Station {
  robot: RobotView;
  x: number;
  z: number;
  face: number; // y rotation so the robot looks at the hub
  idleX: number;
  idleZ: number;
}

/** Where each agent of a team sits (a ring around the hub, boss at the back) and where it waits when idle. */
function layoutTeam(robots: RobotView[]): { stations: Station[]; ring: number } {
  const sorted = robots
    .slice()
    .sort((a, b) => (a.kind === 'planner' ? -1 : 0) - (b.kind === 'planner' ? -1 : 0) || b.floor - a.floor || a.name.localeCompare(b.name));
  const n = Math.max(sorted.length, 1);
  const ring = Math.min(3.3, Math.max(3.0, 1.9 + 0.5 * n));
  const stations = sorted.map((robot, i) => {
    const a = Math.PI + (i * 2 * Math.PI) / n;
    const x = Math.sin(a) * ring;
    const z = Math.cos(a) * ring;
    const ia = (i * 2 * Math.PI) / n + 0.6;
    return { robot, x, z, face: Math.atan2(-x, -z), idleX: Math.sin(ia) * 1.2, idleZ: Math.cos(ia) * 1.2 };
  });
  return { stations, ring };
}

// ---------------------------------------------------------------- textures
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
  useEffect(() => () => tex.dispose(), [tex]);
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

/** Square metal floor tiles; the hexagon cap of the island samples this as a disc, so the grid stays continuous. */
function useTileTexture() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    const n = 12;
    const s = 512 / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const shade = 70 + ((x * 7 + y * 13) % 5) * 3;
        g.fillStyle = `rgb(${shade},${shade + 4},${shade + 14})`;
        g.fillRect(x * s, y * s, s, s);
      }
    }
    g.strokeStyle = 'rgba(190,205,235,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * s, 0);
      g.lineTo(i * s, 512);
      g.moveTo(0, i * s);
      g.lineTo(512, i * s);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

// ---------------------------------------------------------------- sky
const SKY = {
  top: [new THREE.Color('#050719'), new THREE.Color('#2a6fe0')],
  horizon: [new THREE.Color('#222a63'), new THREE.Color('#9fcdf7')],
  bottom: [new THREE.Color('#0a0c22'), new THREE.Color('#6fa8e8')],
};

function SkyDome() {
  const day = useContext(DayCtx);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } }),
    []
  );
  useFrame(() => {
    const d = day.current;
    uniforms.top.value.lerpColors(SKY.top[0], SKY.top[1], d);
    uniforms.horizon.value.lerpColors(SKY.horizon[0], SKY.horizon[1], d);
    uniforms.bottom.value.lerpColors(SKY.bottom[0], SKY.bottom[1], d);
  });
  return (
    <mesh renderOrder={-10}>
      <sphereGeometry args={[420, 32, 20]} />
      <shaderMaterial
        ref={mat}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP;
          void main(){
            float h = vP.y;
            vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.5)) : mix(horizon, bottom, pow(-h, 0.55));
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`}
      />
    </mesh>
  );
}

function SunMoon() {
  const day = useContext(DayCtx);
  const sun = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Group>(null);
  useFrame(() => {
    const d = day.current;
    if (sun.current) {
      sun.current.scale.setScalar(Math.max(0.001, d));
      sun.current.position.y = 70 + (1 - d) * -50;
    }
    if (moon.current) {
      moon.current.scale.setScalar(Math.max(0.001, 1 - d));
      moon.current.position.y = 62 + d * -50;
    }
  });
  return (
    <>
      <group ref={sun} position={[-120, 70, -260]}>
        <mesh><sphereGeometry args={[16, 24, 24]} /><meshBasicMaterial color="#fff4c4" fog={false} toneMapped={false} /></mesh>
        <mesh><sphereGeometry args={[30, 24, 24]} /><meshBasicMaterial color="#ffe9a0" transparent opacity={0.22} fog={false} depthWrite={false} toneMapped={false} /></mesh>
      </group>
      <group ref={moon} position={[130, 62, -250]}>
        <mesh><sphereGeometry args={[12, 24, 24]} /><meshBasicMaterial color="#eef2ff" fog={false} toneMapped={false} /></mesh>
        <mesh position={[-3, 2, 11]}><circleGeometry args={[2.6, 20]} /><meshBasicMaterial color="#cdd5f0" fog={false} toneMapped={false} /></mesh>
        <mesh position={[4, -3, 11.2]}><circleGeometry args={[1.8, 20]} /><meshBasicMaterial color="#cdd5f0" fog={false} toneMapped={false} /></mesh>
        <mesh><sphereGeometry args={[22, 24, 24]} /><meshBasicMaterial color="#b6c4ff" transparent opacity={0.16} fog={false} depthWrite={false} toneMapped={false} /></mesh>
      </group>
    </>
  );
}

function Stars() {
  const day = useContext(DayCtx);
  const mat = useRef<THREE.PointsMaterial>(null);
  const positions = useMemo(() => {
    const n = 650;
    const arr = new Float32Array(n * 3);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const u = rnd();
      const v = rnd();
      const theta = 2 * Math.PI * u;
      const y = 0.12 + v * 0.88; // upper sky only
      const r = Math.sqrt(1 - y * y);
      arr[i * 3] = Math.cos(theta) * r * 380;
      arr[i * 3 + 1] = y * 380;
      arr[i * 3 + 2] = Math.sin(theta) * r * 380;
    }
    return arr;
  }, []);
  useFrame((state) => {
    if (mat.current) mat.current.opacity = Math.max(0, 1 - day.current * 1.6) * (0.85 + Math.sin(state.clock.elapsedTime * 1.3) * 0.15);
  });
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={mat} color="#ffffff" size={2.2} sizeAttenuation={false} transparent opacity={0} depthWrite={false} fog={false} />
    </points>
  );
}

const CLOUD_DAY = new THREE.Color('#ffffff');
const CLOUD_NIGHT = new THREE.Color('#5d679e');

function Clouds() {
  const day = useContext(DayCtx);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.94 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const clouds = useMemo(() => {
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 22 }).map((_, i) => {
      const low = i % 3 !== 0; // most clouds drift below the islands, like a sea of clouds
      return {
        x: (rnd() - 0.5) * 220,
        y: low ? -14 - rnd() * 18 : 16 + rnd() * 22,
        z: (rnd() - 0.5) * 160 - 10,
        s: low ? 5 + rnd() * 6 : 3 + rnd() * 3,
        v: 0.25 + rnd() * 0.7,
        puffs: [0, 1, 2, 3].map((p) => ({ x: (p - 1.5) * 0.9 + (rnd() - 0.5) * 0.4, y: (rnd() - 0.4) * 0.5, r: 0.8 + rnd() * 0.5 })),
      };
    });
  }, []);
  useFrame((_, delta) => {
    mat.color.lerpColors(CLOUD_NIGHT, CLOUD_DAY, day.current);
    groups.current.forEach((g, i) => {
      if (!g) return;
      g.position.x += clouds[i].v * delta;
      if (g.position.x > 120) g.position.x = -120;
    });
  });
  return (
    <>
      {clouds.map((c, i) => (
        <group key={i} ref={(el) => { groups.current[i] = el; }} position={[c.x, c.y, c.z]} scale={c.s}>
          {c.puffs.map((p, k) => (
            <mesh key={k} position={[p.x, p.y, 0]} scale={[p.r * 1.5, p.r * 0.75, p.r * 1.1]} material={mat}>
              <sphereGeometry args={[1, 14, 12]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** Small rocks drifting in the sky around the islands. */
function FloatingRocks() {
  const rocks = useMemo(() => {
    let seed = 21;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 16 }).map(() => {
      const a = rnd() * Math.PI * 2;
      const r = 28 + rnd() * 34;
      return { x: Math.sin(a) * r, y: -8 + rnd() * 30, z: Math.cos(a) * r, s: 0.5 + rnd() * 1.3, p: rnd() * 6, rot: [rnd() * 3, rnd() * 3, rnd() * 3] as [number, number, number] };
    });
  }, []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((state) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const t = state.clock.elapsedTime + rocks[i].p;
      m.position.y = rocks[i].y + Math.sin(t * 0.4) * 0.8;
      m.rotation.x += 0.0025;
      m.rotation.y += 0.004;
    });
  });
  return (
    <>
      {rocks.map((r, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} position={[r.x, r.y, r.z]} scale={r.s} rotation={r.rot}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#6c6358" roughness={0.95} flatShading />
        </mesh>
      ))}
    </>
  );
}

const AMB = { night: new THREE.Color('#6f7bd0'), day: new THREE.Color('#ffffff') };
const SUNLIGHT = { night: new THREE.Color('#9db4ff'), day: new THREE.Color('#fff0d2') };
const HEMI_SKY = { night: new THREE.Color('#3b4a9a'), day: new THREE.Color('#bcdcff') };
const HEMI_GROUND = { night: new THREE.Color('#10121f'), day: new THREE.Color('#8b8f9a') };

/** Moves the day amount toward the wanted value and lights / fogs the scene to match. */
function SceneRig({ isDay }: { isDay: boolean }) {
  const day = useContext(DayCtx);
  const { scene } = useThree();
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    scene.fog = new THREE.Fog('#c9e6ff', 70, 300);
    scene.background = new THREE.Color('#c9e6ff');
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene]);

  useFrame((_, delta) => {
    const target = isDay ? 1 : 0;
    day.current += (target - day.current) * Math.min(1, delta * 1.1);
    if (Math.abs(target - day.current) < 0.002) day.current = target;
    const d = day.current;
    if (amb.current) {
      amb.current.color.lerpColors(AMB.night, AMB.day, d);
      amb.current.intensity = 0.7 + d * 0.5;
    }
    if (hemi.current) {
      hemi.current.color.lerpColors(HEMI_SKY.night, HEMI_SKY.day, d);
      hemi.current.groundColor.lerpColors(HEMI_GROUND.night, HEMI_GROUND.day, d);
      hemi.current.intensity = 0.45 + d * 0.35;
    }
    if (sun.current) {
      sun.current.color.lerpColors(SUNLIGHT.night, SUNLIGHT.day, d);
      sun.current.intensity = 0.55 + d * 1.5;
    }
    if (scene.fog && scene.background instanceof THREE.Color) {
      const c = scene.background;
      c.lerpColors(SKY.horizon[0], SKY.horizon[1], d);
      (scene.fog as THREE.Fog).color.copy(c);
    }
  });

  return (
    <>
      <ambientLight ref={amb} intensity={1} />
      <hemisphereLight ref={hemi} args={['#bcdcff', '#8b8f9a', 0.7]} />
      <directionalLight ref={sun} position={[-30, 55, 40]} intensity={1.6} />
    </>
  );
}

// ---------------------------------------------------------------- island pieces
function Pod({ x, z, face, floor, lit }: { x: number; z: number; face: number; floor: number; lit: boolean }) {
  const p = paletteOf(floor);
  const day = useContext(DayCtx);
  const win = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (win.current) win.current.color.set(lit ? p.accent : '#2c3350').multiplyScalar(lit ? 1 : 0.7 + (1 - day.current) * 0.8);
  });
  return (
    <group position={[x, SURFACE_Y, z]} rotation={[0, face, 0]}>
      {/* the pod sits behind the robot (local -z), the console in front of it (local +z) */}
      <group position={[0, 0, -1.35]}>
        <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.92, 1.0, 0.6, 20]} /><meshStandardMaterial color="#d7e4fb" roughness={0.45} /></mesh>
        <mesh position={[0, 0.62, 0]}><cylinderGeometry args={[0.95, 0.95, 0.1, 20]} /><meshStandardMaterial color={p.accent} roughness={0.5} emissive={p.accent} emissiveIntensity={0.25} /></mesh>
        <mesh position={[0, 0.67, 0]}><sphereGeometry args={[0.86, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#eef4ff" roughness={0.35} /></mesh>
        <mesh position={[0, 0.98, 0.62]} rotation={[-0.35, 0, 0]}>
          <planeGeometry args={[0.56, 0.3]} />
          <meshBasicMaterial ref={win} color="#2c3350" toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.45, 1.5, -0.15]}><cylinderGeometry args={[0.025, 0.025, 0.7, 6]} /><meshStandardMaterial color="#9aa5bd" /></mesh>
        <mesh position={[0.45, 1.88, -0.15]}><sphereGeometry args={[0.07, 10, 10]} /><meshBasicMaterial color={p.accent} toneMapped={false} /></mesh>
      </group>
      {/* console */}
      <group position={[0, 0, 0.95]} scale={[0.85, 1, 1]}>
        <mesh position={[0, 0.82, 0]}><boxGeometry args={[2.0, 0.08, 0.9]} /><meshStandardMaterial color="#2b2f42" roughness={0.5} /></mesh>
        {[-0.9, 0.9].map((lx) => (
          <mesh key={lx} position={[lx, 0.4, 0]}><boxGeometry args={[0.08, 0.8, 0.8]} /><meshStandardMaterial color="#14161f" /></mesh>
        ))}
        <group position={[0, 1.13, -0.16]} rotation={[-0.18, 0, 0]}>
          <mesh><boxGeometry args={[0.7, 0.48, 0.03]} /><meshStandardMaterial color="#1b1e2a" /></mesh>
          <mesh position={[0, 0, 0.02]}><circleGeometry args={[0.07, 24]} /><meshBasicMaterial color={lit ? p.accent : '#3a3f55'} toneMapped={false} /></mesh>
        </group>
      </group>
    </group>
  );
}

function Crates({ x, z, rot }: { x: number; z: number; rot: number }) {
  const spots: [number, number, number][] = [[0, 0, 0], [0.7, 0, 0.1], [0.3, 0, 0.7], [0.35, 0.5, 0.3], [-0.45, 0, 0.5]];
  return (
    <group position={[x, SURFACE_Y, z]} rotation={[0, rot, 0]}>
      {spots.map(([cx, cy, cz], i) => (
        <mesh key={i} position={[cx, cy + 0.25, cz]} rotation={[0, i * 0.4, 0]}>
          <boxGeometry args={[0.55, 0.5, 0.55]} />
          <meshStandardMaterial color={i % 2 ? '#e0524a' : '#c9423b'} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Solar({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, SURFACE_Y, z]} rotation={[0, rot, 0]}>
      {[-0.55, 0.55].map((sx) => (
        <group key={sx} position={[sx, 0, 0]}>
          <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.04, 0.04, 0.6, 6]} /><meshStandardMaterial color="#9aa5bd" /></mesh>
          <mesh position={[0, 0.68, 0]} rotation={[-0.6, 0, 0]}>
            <boxGeometry args={[0.8, 0.05, 0.6]} />
            <meshStandardMaterial color="#1e4fa8" metalness={0.5} roughness={0.25} emissive="#17389a" emissiveIntensity={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Tank({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, SURFACE_Y, z]}>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.5, 0.5, 1.0, 16]} /><meshStandardMaterial color="#c7d3ea" roughness={0.4} metalness={0.3} /></mesh>
      <mesh position={[0, 1.02, 0]}><sphereGeometry args={[0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#c7d3ea" roughness={0.4} metalness={0.3} /></mesh>
      <mesh position={[0, 0.6, 0.5]}><boxGeometry args={[0.5, 0.12, 0.02]} /><meshBasicMaterial color="#ffb347" toneMapped={false} /></mesh>
    </group>
  );
}

/** The command hub in the middle of an island. */
function Hub({ color }: { color: string }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ring.current) ring.current.rotation.z = state.clock.elapsedTime * 0.8;
  });
  return (
    <group position={[0, SURFACE_Y, 0]}>
      <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.62, 0.7, 0.24, 6]} /><meshStandardMaterial color="#2b3045" roughness={0.5} /></mesh>
      <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.08, 0.08, 1.0, 8]} /><meshStandardMaterial color="#9aa5bd" /></mesh>
      <mesh position={[0, 1.35, 0]}><sphereGeometry args={[0.32, 18, 14]} /><meshStandardMaterial color="#c97f4a" roughness={0.4} metalness={0.3} emissive={color} emissiveIntensity={0.18} /></mesh>
      <mesh ref={ring} position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.025, 8, 36]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Lamp({ x, z, color }: { x: number; z: number; color: string }) {
  const day = useContext(DayCtx);
  const bulb = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (bulb.current) bulb.current.color.set(color).multiplyScalar(0.55 + (1 - day.current) * 0.9);
  });
  return (
    <group position={[x, SURFACE_Y, z]}>
      <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.04, 0.05, 1.4, 6]} /><meshStandardMaterial color="#8d98b3" /></mesh>
      <mesh position={[0, 1.45, 0]}><sphereGeometry args={[0.13, 12, 12]} /><meshBasicMaterial ref={bulb} color={color} toneMapped={false} /></mesh>
    </group>
  );
}

function TeamLabel({ name, color, agents, working }: { name: string; color: string; agents: number; working: number }) {
  const tex = useLabelTexture((g, w, h) => {
    g.fillStyle = 'rgba(8,10,18,0.78)';
    roundRect(g, 6, 6, w - 12, h - 12, 28);
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = 'bold 54px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const shown = name.length > 22 ? name.slice(0, 21) + '…' : name;
    g.fillText(shown, w / 2, 62);
    g.font = '600 30px sans-serif';
    g.fillStyle = working > 0 ? '#34d399' : '#a1a1aa';
    g.fillText(agents ? `${agents} agent${agents === 1 ? '' : 's'}${working ? ` · ${working} working` : ' · idle'}` : 'no agents yet', w / 2, 112);
  }, 720, 150, `${name}|${color}|${agents}|${working}`);
  return (
    <sprite position={[0, 7.2, 0]} scale={[7.2, 1.5, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

function Island({
  index, team, robots, selectedId, onSelect, onFocusTeam, plan,
}: {
  plan: LoungePlan;
  index: number;
  team: TeamView;
  robots: RobotView[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFocusTeam: (teamId: string) => void;
}) {
  const [cx, cz] = teamCenter(index);
  const color = TEAM_COLORS[index % TEAM_COLORS.length];
  const tiles = useTileTexture();
  const day = useContext(DayCtx);
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const rimMat = useRef<THREE.MeshBasicMaterial>(null);
  const { stations } = useMemo(() => layoutTeam(robots), [robots]);
  const seed = useMemo(() => index * 1.7, [index]);
  // Where each robot goes when idle (island-local): its spot in the Bar or the Bunker, and both ends of the bridge to it.
  const lounges = useMemo(() => {
    const out = new Map<string, RobotLounge>();
    for (const s of stations) {
      const as = plan.assign.get(s.robot.id);
      if (!as) continue;
      const L = as.kind === 'bar' ? plan.bar : plan.bunker;
      const rt = routeBetween([cx, cz], HEX_R, L.c, L.r);
      out.set(s.robot.id, {
        spot: [L.c[0] + as.spot.x - cx, L.c[1] + as.spot.z - cz],
        face: as.spot.face,
        lie: as.spot.lie,
        a: [rt.a[0] - rt.u[0] * 0.6 - cx, rt.a[1] - rt.u[1] * 0.6 - cz],
        b: [rt.b[0] + rt.u[0] * 0.6 - cx, rt.b[1] + rt.u[1] * 0.6 - cz],
      });
    }
    return out;
  }, [stations, plan, cx, cz]);
  const working = robots.filter((r) => r.state === 'working').length;

  useFrame((state) => {
    if (group.current) group.current.position.y = Math.sin(state.clock.elapsedTime * 0.5 + seed) * 0.18;
    const night = 1 - day.current;
    if (light.current) light.current.intensity = night * 26;
    if (rimMat.current) rimMat.current.color.set(color).multiplyScalar(0.85 + night * 0.5);
  });

  // Decor goes on the island corners that no pod is close to.
  const decor = useMemo(() => {
    const out: { kind: number; x: number; z: number; rot: number }[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      const near = stations.some((s) => {
        const sa = Math.atan2(s.x, s.z);
        let d = Math.abs(sa - a) % (Math.PI * 2);
        if (d > Math.PI) d = Math.PI * 2 - d;
        return d < 0.55;
      });
      if (!near) out.push({ kind: k % 3, x: Math.sin(a) * 4.6, z: Math.cos(a) * 4.6, rot: a });
    }
    return out;
  }, [stations]);

  return (
    <group position={[cx, 0, cz]}>
      <group ref={group}>
        {/* body: slab + rock underneath */}
        <mesh
          onClick={(e) => { e.stopPropagation(); onFocusTeam(team.id); }}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = ''; }}
        >
          <cylinderGeometry args={[HEX_R, HEX_R, 0.6, 6]} />
          <meshStandardMaterial attach="material-0" color="#1b1f2e" roughness={0.6} metalness={0.4} />
          <meshStandardMaterial attach="material-1" map={tiles} roughness={0.75} metalness={0.15} />
          <meshStandardMaterial attach="material-2" color="#141726" />
        </mesh>
        <mesh position={[0, -2.6, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[HEX_R * 0.9, 4.6, 6]} />
          <meshStandardMaterial color="#4a4033" roughness={1} flatShading />
        </mesh>
        <mesh position={[HEX_R * 0.35, -4.9, -1]} rotation={[0.4, 0.6, 0.2]}><icosahedronGeometry args={[0.7, 0]} /><meshStandardMaterial color="#5a4e3f" flatShading roughness={1} /></mesh>
        <mesh position={[-HEX_R * 0.3, -5.6, 1.4]} rotation={[0.2, 1.0, 0.5]}><icosahedronGeometry args={[0.45, 0]} /><meshStandardMaterial color="#5a4e3f" flatShading roughness={1} /></mesh>

        {/* glowing team border */}
        <mesh position={[0, SURFACE_Y + 0.015, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
          <ringGeometry args={[HEX_R - 0.5, HEX_R - 0.08, 6]} />
          <meshBasicMaterial ref={rimMat} color={color} toneMapped={false} />
        </mesh>
        <mesh position={[0, SURFACE_Y + 0.012, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
          <ringGeometry args={[HEX_R - 0.62, HEX_R - 0.54, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.45} toneMapped={false} />
        </mesh>

        <pointLight ref={light} position={[0, 5.5, 0]} color="#ffc27a" distance={20} decay={2} intensity={0} />

        <Hub color={color} />
        {Array.from({ length: 6 }).map((_, k) => {
          const a = (k * Math.PI) / 3 + Math.PI / 6;
          return <Lamp key={k} x={Math.sin(a) * (APOTHEM - 0.35)} z={Math.cos(a) * (APOTHEM - 0.35)} color={color} />;
        })}
        {decor.map((d, i) =>
          d.kind === 0 ? <Crates key={i} x={d.x} z={d.z} rot={d.rot} /> : d.kind === 1 ? <Solar key={i} x={d.x} z={d.z} rot={d.rot} /> : <Tank key={i} x={d.x} z={d.z} />
        )}

        {stations.map((s) => (
          <Pod key={s.robot.id} x={s.x} z={s.z} face={s.face} floor={s.robot.floor} lit={s.robot.state === 'working'} />
        ))}
        {stations.map((s) => (
          <Robot key={s.robot.id} station={s} lounge={lounges.get(s.robot.id) || null} bobSeed={seed} selected={selectedId === s.robot.id} onSelect={onSelect} />
        ))}

        <TeamLabel name={team.name} color={color} agents={robots.length} working={working} />
        {robots.length === 0 && (
          <mesh position={[0, SURFACE_Y + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.2, 2.3, 48]} />
            <meshBasicMaterial color={color} transparent opacity={0.35} toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- lounges: the bar and the bunker
// An idle agent is not in the working space: the leaders (planners) go to the Bar, every other agent goes to a bed in the Bunker.
// Each team island is joined to both by a bridge, and the robots walk over it.
type V2 = [number, number];
const LOUNGE_GAP = 2.4; // sky between the cluster of islands and a lounge (like between two islands)
const BUNKER_R = HEX_R * 2; // the Bunker is twice as big as an island
const BAR_COLOR = '#f59e0b';
const BUNKER_COLOR = '#6366f1';

interface Spot { x: number; z: number; face: number; lie: boolean }
interface LoungePlan {
  bar: { c: V2; r: number };
  bunker: { c: V2; r: number };
  assign: Map<string, { kind: 'bar' | 'bunker'; spot: Spot }>;
  barCount: number;
  bedSpots: Spot[];
  bedCount: number;
}
/** What a robot needs to go to its lounge and back (island-local): the spot, and the two ends of the bridge as seen from its island. */
interface RobotLounge { spot: V2; face: number; lie: boolean; a: V2; b: V2 }

/** Distance from the middle of a hexagon (vertex at +z) to its edge, in the direction psi (radians from +z). */
function hexEdge(r: number, psi: number) {
  const sixty = Math.PI / 3;
  const m = ((psi % sixty) + sixty) % sixty;
  return (r * Math.sqrt(3)) / 2 / Math.cos(m - Math.PI / 6);
}

/** The straight bridge between two hexagons: its two ends on their edges, and the unit direction from the first to the second. */
function routeBetween(c1: V2, r1: number, c2: V2, r2: number) {
  const dx = c2[0] - c1[0];
  const dz = c2[1] - c1[1];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const e1 = hexEdge(r1, Math.atan2(ux, uz));
  const e2 = hexEdge(r2, Math.atan2(-ux, -uz));
  return { a: [c1[0] + ux * e1, c1[1] + uz * e1] as V2, b: [c2[0] - ux * e2, c2[1] - uz * e2] as V2, u: [ux, uz] as V2 };
}

/** Leaders mingle in groups of three that face each other, in front of the counter. */
const BAR_GROUPS: V2[] = [[-2.2, -0.7], [2.2, -0.7], [0, 1.6], [-3.7, 1.7], [3.7, 1.7], [0, 3.9]];
function barSlots(n: number): Spot[] {
  const out: Spot[] = [];
  for (let i = 0; i < Math.max(n, 1); i++) {
    const g = Math.floor(i / 3) % BAR_GROUPS.length;
    const j = i % 3;
    const ang = (j * 2 * Math.PI) / 3 + g * 0.9;
    const [cx, cz] = BAR_GROUPS[g];
    const x = cx + Math.sin(ang) * 0.8;
    const z = cz + Math.cos(ang) * 0.8;
    out.push({ x, z, face: Math.atan2(cx - x, cz - z), lie: false });
  }
  return out;
}

function bedSlots(need: number): Spot[] {
  const A = (BUNKER_R * Math.sqrt(3)) / 2;
  for (const [sz, sx] of [[3.6, 2.4], [3.1, 2.1], [2.7, 1.9]]) {
    const out: Spot[] = [];
    for (let z = -10; z <= 10; z += sz) {
      for (let x = -10; x <= 10; x += sx) {
        if (Math.abs(x) + 0.8 <= A - 0.6 && Math.abs(z) + 1.4 + Math.abs(x) / Math.sqrt(3) <= BUNKER_R - 0.6) out.push({ x, z, face: 0, lie: true });
      }
    }
    out.sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z));
    if (out.length >= need || sz === 2.7) return out;
  }
  return [];
}

function buildLounge(robots: RobotView[], islandCount: number): LoungePlan {
  const ring = islandCount <= 1 ? 0 : islandCount <= 7 ? 1 : 2;
  const extent = SPACING * ring * (ring === 2 ? 0.95 : 1) + HEX_R;
  const bar = { c: [-(extent + LOUNGE_GAP + HEX_R), 0] as V2, r: HEX_R };
  const bunker = { c: [extent + LOUNGE_GAP + BUNKER_R, 0] as V2, r: BUNKER_R };
  const sorted = robots.slice().sort((a, b) => a.id.localeCompare(b.id));
  const leaders = sorted.filter((r) => r.kind === 'planner');
  const others = sorted.filter((r) => r.kind !== 'planner');
  const barSpots = barSlots(leaders.length);
  const bedSpots = bedSlots(others.length);
  const assign: LoungePlan['assign'] = new Map();
  leaders.forEach((r, i) => assign.set(r.id, { kind: 'bar', spot: barSpots[i] }));
  others.forEach((r, i) => assign.set(r.id, { kind: 'bunker', spot: bedSpots[i % Math.max(bedSpots.length, 1)] || { x: 0, z: 0, face: 0, lie: true } }));
  return { bar, bunker, assign, barCount: leaders.length, bedSpots, bedCount: others.length };
}

/** A modern walkway: steel deck, glowing edges, glass rails. It reaches from one hexagon edge to the other. */
function Bridge({ a, b, color }: { a: V2; b: V2; color: string }) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) + 0.3;
  const posts = Math.max(2, Math.round(len / 2.4));
  return (
    <group position={[(a[0] + b[0]) / 2, SURFACE_Y - 0.06, (a[1] + b[1]) / 2]} rotation={[0, Math.atan2(dx, dz), 0]}>
      <mesh><boxGeometry args={[1.8, 0.14, len]} /><meshStandardMaterial color="#20263a" roughness={0.45} metalness={0.6} /></mesh>
      <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.5, 0.34, len]} /><meshStandardMaterial color="#12151f" roughness={0.6} metalness={0.5} /></mesh>
      {[-0.82, 0.82].map((x) => (
        <React.Fragment key={x}>
          <mesh position={[x, 0.08, 0]}><boxGeometry args={[0.06, 0.03, len]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
          <mesh position={[x * 1.07, 0.38, 0]}><boxGeometry args={[0.03, 0.55, len]} /><meshStandardMaterial color="#9fd8ff" transparent opacity={0.22} roughness={0.1} /></mesh>
          <mesh position={[x * 1.07, 0.67, 0]}><boxGeometry args={[0.06, 0.05, len]} /><meshStandardMaterial color="#aeb8cf" roughness={0.3} metalness={0.8} /></mesh>
        </React.Fragment>
      ))}
      {Array.from({ length: posts + 1 }).map((_, i) => {
        const z = -len / 2 + (len * i) / posts;
        return [-0.88, 0.88].map((x) => (
          <mesh key={`${i}${x}`} position={[x, 0.38, z]}><boxGeometry args={[0.06, 0.6, 0.06]} /><meshStandardMaterial color="#aeb8cf" roughness={0.3} metalness={0.8} /></mesh>
        ));
      })}
      {Array.from({ length: Math.floor(len / 1.6) }).map((_, i) => (
        <mesh key={i} position={[0, -0.12, -len / 2 + 0.8 + i * 1.6]}><boxGeometry args={[1.5, 0.05, 0.08]} /><meshStandardMaterial color="#0d0f16" /></mesh>
      ))}
    </group>
  );
}

function LoungeSign({ text, sub, color, y, width }: { text: string; sub: string; color: string; y: number; width: number }) {
  const tex = useLabelTexture((g, w, h) => {
    g.fillStyle = 'rgba(8,10,18,0.78)';
    roundRect(g, 6, 6, w - 12, h - 12, 28);
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = 'bold 60px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, 62);
    g.font = '600 30px sans-serif';
    g.fillStyle = '#a1a1aa';
    g.fillText(sub, w / 2, 112);
  }, 720, 150, `${text}|${sub}|${color}`);
  return (
    <sprite position={[0, y, 0]} scale={[width, width * (150 / 720), 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

/** The slab of a lounge: the same tiled hexagon as an island, but it stays still (the bridges are fixed to it). */
function LoungeBase({ c, r, color, children }: { c: V2; r: number; color: string; children: React.ReactNode }) {
  const tiles = useTileTexture();
  const day = useContext(DayCtx);
  const light = useRef<THREE.PointLight>(null);
  const rimMat = useRef<THREE.MeshBasicMaterial>(null);
  const k = r / HEX_R;
  useFrame(() => {
    const night = 1 - day.current;
    if (light.current) light.current.intensity = night * 26 * k;
    if (rimMat.current) rimMat.current.color.set(color).multiplyScalar(0.85 + night * 0.5);
  });
  return (
    <group position={[c[0], 0, c[1]]}>
      <mesh>
        <cylinderGeometry args={[r, r, 0.6, 6]} />
        <meshStandardMaterial attach="material-0" color="#1b1f2e" roughness={0.6} metalness={0.4} />
        <meshStandardMaterial attach="material-1" map={tiles} roughness={0.75} metalness={0.15} />
        <meshStandardMaterial attach="material-2" color="#141726" />
      </mesh>
      <mesh position={[0, -2.6 * k, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[r * 0.9, 4.6 * k, 6]} />
        <meshStandardMaterial color="#4a4033" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, SURFACE_Y + 0.015, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
        <ringGeometry args={[r - 0.5, r - 0.08, 6]} />
        <meshBasicMaterial ref={rimMat} color={color} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 5.5, 0]} color="#ffc27a" distance={20 * k} decay={2} intensity={0} />
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i * Math.PI) / 3 + Math.PI / 6;
        return <Lamp key={i} x={Math.sin(a) * (r * 0.866 - 0.35)} z={Math.cos(a) * (r * 0.866 - 0.35)} color={color} />;
      })}
      {children}
    </group>
  );
}

/** The bartender: a robot in a white apron behind the counter, wiping it and shaking a drink now and then. */
function Bartender() {
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const shake = Math.max(0, Math.sin(t * 0.5)); // every few seconds a drink is shaken
    if (armR.current) armR.current.rotation.x = -1.0 - shake * 0.5 + Math.sin(t * (shake > 0.2 ? 12 : 2.2)) * (shake > 0.2 ? 0.22 : 0.3);
    if (armL.current) armL.current.rotation.x = -0.9 + Math.sin(t * 2.2 + 1.4) * 0.3;
    if (head.current) head.current.rotation.y = Math.sin(t * 0.45) * 0.55;
    if (root.current) root.current.position.x = Math.sin(t * 0.3) * 1.4; // walks along the counter
  });
  const hood = '#e8ecf5';
  return (
    <group ref={root} position={[0, SURFACE_Y, -4.05]} rotation={[0, 0, 0]}>
      {[-0.15, 0.15].map((x) => (<mesh key={x} position={[x, 0.3, 0]}><boxGeometry args={[0.17, 0.6, 0.19]} /><meshStandardMaterial color="#14161f" /></mesh>))}
      <RoundedBox args={[0.66, 0.62, 0.44]} radius={0.12} smoothness={3} position={[0, 0.92, 0]}><meshStandardMaterial color={hood} roughness={0.85} /></RoundedBox>
      <mesh position={[0, 0.82, 0.24]}><boxGeometry args={[0.5, 0.5, 0.03]} /><meshStandardMaterial color="#ffffff" roughness={0.9} /></mesh>
      <mesh position={[0, 1.2, 0.24]}><boxGeometry args={[0.2, 0.07, 0.03]} /><meshBasicMaterial color={BAR_COLOR} toneMapped={false} /></mesh>
      <group ref={armL} position={[-0.42, 1.14, 0]}><mesh position={[0, -0.24, 0]}><boxGeometry args={[0.15, 0.5, 0.16]} /><meshStandardMaterial color={hood} roughness={0.85} /></mesh></group>
      <group ref={armR} position={[0.42, 1.14, 0]}>
        <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.15, 0.5, 0.16]} /><meshStandardMaterial color={hood} roughness={0.85} /></mesh>
        <mesh position={[0, -0.62, 0.05]}><cylinderGeometry args={[0.07, 0.05, 0.26, 10]} /><meshStandardMaterial color="#aeb8cf" metalness={0.8} roughness={0.25} /></mesh>
      </group>
      <group ref={head} position={[0, 1.66, 0]}>
        <mesh scale={[1, 1.05, 0.95]}><sphereGeometry args={[0.52, 28, 24]} /><meshStandardMaterial color={hood} roughness={0.9} /></mesh>
        <mesh position={[0, -0.02, 0.3]} scale={[0.95, 0.85, 0.78]}><sphereGeometry args={[0.44, 28, 24]} /><meshStandardMaterial color="#07080c" metalness={0.7} roughness={0.2} /></mesh>
        {[-0.15, 0.15].map((x) => (<mesh key={x} position={[x, 0.02, 0.63]}><boxGeometry args={[0.09, 0.19, 0.03]} /><meshBasicMaterial color={BAR_COLOR} toneMapped={false} /></mesh>))}
        <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.3, 0.34, 0.22, 20]} /><meshStandardMaterial color="#1b1e2a" roughness={0.6} /></mesh>
      </group>
    </group>
  );
}

function LoungeBar({ plan }: { plan: LoungePlan }) {
  const bottles = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#fb923c'];
  return (
    <LoungeBase c={plan.bar.c} r={plan.bar.r} color={BAR_COLOR}>
      {/* back shelf with glowing bottles */}
      <group position={[0, SURFACE_Y, -4.75]}>
        <mesh position={[0, 1.3, 0]}><boxGeometry args={[4.6, 2.6, 0.35]} /><meshStandardMaterial color="#181b28" roughness={0.5} metalness={0.4} /></mesh>
        {[0.95, 1.65].map((y) => (
          <mesh key={y} position={[0, y, 0.25]}><boxGeometry args={[4.3, 0.06, 0.3]} /><meshStandardMaterial color="#aeb8cf" metalness={0.8} roughness={0.3} /></mesh>
        ))}
        {[0.95, 1.65].map((y, ri) => bottles.map((col, i) => (
          <mesh key={`${y}${i}`} position={[-1.9 + i * 0.76, y + 0.2, 0.25]}><cylinderGeometry args={[0.09, 0.11, 0.34, 10]} /><meshBasicMaterial color={bottles[(i + ri * 2) % bottles.length]} toneMapped={false} /></mesh>
        )))}
        <mesh position={[0, 2.35, 0.2]}><boxGeometry args={[4.4, 0.06, 0.06]} /><meshBasicMaterial color={BAR_COLOR} toneMapped={false} /></mesh>
      </group>
      {/* counter */}
      <group position={[0, SURFACE_Y, -3.0]}>
        <mesh position={[0, 0.55, 0]}><boxGeometry args={[6.4, 1.1, 1.0]} /><meshStandardMaterial color="#232838" roughness={0.45} metalness={0.5} /></mesh>
        <mesh position={[0, 1.12, 0.05]}><boxGeometry args={[6.6, 0.1, 1.2]} /><meshStandardMaterial color="#e6ecf8" roughness={0.25} metalness={0.2} /></mesh>
        <mesh position={[0, 0.2, 0.51]}><boxGeometry args={[6.2, 0.05, 0.03]} /><meshBasicMaterial color={BAR_COLOR} toneMapped={false} /></mesh>
      </group>
      <Bartender />
      {/* two high tables at the side */}
      {[-4.7, 4.7].map((x) => (
        <group key={x} position={[x, SURFACE_Y, -0.6]}>
          <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.07, 0.07, 1.1, 8]} /><meshStandardMaterial color="#aeb8cf" metalness={0.8} roughness={0.3} /></mesh>
          <mesh position={[0, 1.12, 0]}><cylinderGeometry args={[0.6, 0.6, 0.07, 24]} /><meshStandardMaterial color="#e6ecf8" roughness={0.3} /></mesh>
          <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.35, 0.4, 0.08, 20]} /><meshStandardMaterial color="#232838" /></mesh>
        </group>
      ))}
      <LoungeSign text="BAR" sub={`${plan.barCount} leader${plan.barCount === 1 ? '' : 's'} resting here`} color={BAR_COLOR} y={5.2} width={5.4} />
    </LoungeBase>
  );
}

function Bed({ spot }: { spot: Spot }) {
  return (
    <group position={[spot.x, SURFACE_Y, spot.z]}>
      <mesh position={[0, 0.14, 0]}><boxGeometry args={[1.3, 0.28, 2.5]} /><meshStandardMaterial color="#1d2233" roughness={0.5} metalness={0.4} /></mesh>
      <mesh position={[0, 0.36, 0]}><boxGeometry args={[1.14, 0.17, 2.3]} /><meshStandardMaterial color="#cfd8ea" roughness={0.8} /></mesh>
      <mesh position={[0, 0.5, -0.85]}><boxGeometry args={[0.8, 0.13, 0.5]} /><meshStandardMaterial color="#ffffff" roughness={0.9} /></mesh>
      <mesh position={[0, 0.3, 1.26]}><boxGeometry args={[1.3, 0.06, 0.05]} /><meshBasicMaterial color={BUNKER_COLOR} toneMapped={false} /></mesh>
    </group>
  );
}

function LoungeBunker({ plan }: { plan: LoungePlan }) {
  const beds = plan.bedSpots.slice(0, Math.max(plan.bedCount, 1));
  return (
    <LoungeBase c={plan.bunker.c} r={plan.bunker.r} color={BUNKER_COLOR}>
      {beds.map((s, i) => <Bed key={i} spot={s} />)}
      <LoungeSign text="BUNKER" sub={`${plan.bedCount} bed${plan.bedCount === 1 ? '' : 's'} for resting agents`} color={BUNKER_COLOR} y={7.4} width={7.2} />
    </LoungeBase>
  );
}

// ---------------------------------------------------------------- robots
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

/** One shared speech-bubble texture ("...") for the robots that talk at the bar. */
let bubbleTex: THREE.CanvasTexture | null = null;
function BUBBLE_TEX() {
  if (!bubbleTex) {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 100;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(255,255,255,0.95)';
    roundRect(g, 4, 4, 152, 70, 30);
    g.fill();
    g.beginPath();
    g.moveTo(40, 70);
    g.lineTo(26, 96);
    g.lineTo(66, 72);
    g.fill();
    g.fillStyle = '#1b1e2a';
    for (const x of [48, 80, 112]) { g.beginPath(); g.arc(x, 39, 8, 0, Math.PI * 2); g.fill(); }
    bubbleTex = new THREE.CanvasTexture(c);
    bubbleTex.colorSpace = THREE.SRGBColorSpace;
  }
  return bubbleTex;
}

function Robot({ station, lounge, bobSeed, selected, onSelect }: { station: Station; lounge: RobotLounge | null; bobSeed: number; selected: boolean; onSelect: (id: string) => void }) {
  const robot = station.robot;
  const p = paletteOf(robot.floor);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const eyeMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const seed = useMemo(() => Math.random() * 10, []);
  const mode = useRef<'desk' | 'lounge' | null>(null);
  const queue = useRef<V2[]>([]);
  const lieAmt = useRef(0);
  const bubble = useRef<THREE.Sprite>(null);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const t = state.clock.elapsedTime + seed;
    const want: 'desk' | 'lounge' = robot.state === 'idle' && lounge ? 'lounge' : 'desk';
    const desk: V2 = [station.x, station.z];
    const goal: V2 = want === 'lounge' && lounge ? lounge.spot : desk;

    if (mode.current === null) {
      g.position.set(goal[0], SURFACE_Y, goal[1]);
      g.rotation.y = want === 'lounge' && lounge ? lounge.face : station.face;
      if (want === 'lounge' && lounge?.lie) lieAmt.current = 1;
      mode.current = want;
    } else if (mode.current !== want && lounge) {
      // leaving (or coming back): which part of the way the robot is on decides the waypoints
      const len = Math.hypot(lounge.b[0] - lounge.a[0], lounge.b[1] - lounge.a[1]) || 1;
      const ux = (lounge.b[0] - lounge.a[0]) / len;
      const uz = (lounge.b[1] - lounge.a[1]) / len;
      const along = (g.position.x - lounge.a[0]) * ux + (g.position.z - lounge.a[1]) * uz;
      const where = along < 0.4 ? 'island' : along > len - 0.4 ? 'lounge' : 'bridge';
      queue.current = want === 'lounge'
        ? where === 'island' ? [lounge.a, lounge.b, lounge.spot] : where === 'bridge' ? [lounge.b, lounge.spot] : [lounge.spot]
        : where === 'lounge' ? [lounge.b, lounge.a, desk] : where === 'bridge' ? [lounge.a, desk] : [desk];
      mode.current = want;
    }

    // the islands float up and down, the lounges and bridges do not: out on the bridge the robot stops following the island
    if (lounge) {
      const len = Math.hypot(lounge.b[0] - lounge.a[0], lounge.b[1] - lounge.a[1]) || 1;
      const along = ((g.position.x - lounge.a[0]) * (lounge.b[0] - lounge.a[0]) + (g.position.z - lounge.a[1]) * (lounge.b[1] - lounge.a[1])) / len;
      const f = Math.min(1, Math.max(0, along / len));
      g.position.y = SURFACE_Y - Math.sin(state.clock.elapsedTime * 0.5 + bobSeed) * 0.18 * f;
    } else {
      g.position.y = SURFACE_Y;
    }

    const next = queue.current[0] || goal;
    const dx = next[0] - g.position.x;
    const dz = next[1] - g.position.z;
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
      if (queue.current.length) queue.current.shift();
      const settledAt = want === 'lounge' && lounge ? lounge.face : station.face;
      const target = settledAt + (want === 'lounge' && !lounge?.lie ? Math.sin(t * 0.4) * 0.18 : 0); // leaders at the bar turn a little while they talk
      let diff = target - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, delta * 5);
    }
    const settled = !walking && queue.current.length === 0;
    const chatting = settled && want === 'lounge' && !lounge?.lie;
    const talk = chatting ? Math.max(0, Math.sin(t * 0.8)) : 0; // takes turns: each leader talks in bursts
    if (bubble.current) bubble.current.visible = talk > 0.35;
    const lieGoal = settled && want === 'lounge' && lounge?.lie ? 1 : 0;
    lieAmt.current += (lieGoal - lieAmt.current) * Math.min(1, delta * 4);

    const swing = walking ? Math.sin(t * 10) * 0.6 : 0;
    if (legL.current && legR.current) {
      legL.current.rotation.x = swing;
      legR.current.rotation.x = -swing;
    }
    if (armL.current && armR.current) {
      if (walking) {
        armL.current.rotation.x = -swing * 0.8;
        armR.current.rotation.x = swing * 0.8;
      } else if (chatting) {
        armR.current.rotation.x = -0.35 - talk * (0.7 + Math.sin(t * 7) * 0.25);
        armL.current.rotation.x = -0.15 - talk * 0.3 * Math.sin(t * 5 + 1);
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
      // asleep in a bed: the robot lies on its back, head on the pillow
      const L = lieAmt.current;
      const bob = walking ? Math.abs(Math.sin(t * 10)) * 0.06 : Math.sin(t * 2) * 0.015;
      body.current.position.set(0, bob * (1 - L) + 0.75 * L, 0.8 * L);
      body.current.rotation.x = -Math.PI / 2 * L;
    }
    if (head.current) {
      head.current.rotation.z = robot.state === 'waiting' ? Math.sin(t * 1.4) * 0.12 : 0;
      head.current.rotation.x = robot.state === 'working' && !walking ? -0.12 + Math.sin(t * 3) * 0.03 : chatting ? Math.sin(t * 2.6) * 0.07 * (0.4 + talk) : 0;
    }

    const eyeColor = robot.state === 'waiting' ? '#fbbf24' : p.eye;
    const bright = robot.state === 'working' ? 1 : robot.state === 'waiting' ? 0.85 : lieAmt.current > 0.5 ? 0.18 : 0.5 + Math.sin(t * 0.9) * 0.08;
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
        <group ref={legL} position={[-0.15, 0.6, 0]}>
          <mesh position={[0, -0.26, 0]}><boxGeometry args={[0.17, 0.5, 0.19]} /><meshStandardMaterial color="#14161f" /></mesh>
          <mesh position={[0, -0.55, 0.04]}><boxGeometry args={[0.22, 0.1, 0.32]} /><meshStandardMaterial color={p.shoe} roughness={0.5} /></mesh>
        </group>
        <group ref={legR} position={[0.15, 0.6, 0]}>
          <mesh position={[0, -0.26, 0]}><boxGeometry args={[0.17, 0.5, 0.19]} /><meshStandardMaterial color="#14161f" /></mesh>
          <mesh position={[0, -0.55, 0.04]}><boxGeometry args={[0.22, 0.1, 0.32]} /><meshStandardMaterial color={p.shoe} roughness={0.5} /></mesh>
        </group>
        <RoundedBox args={[0.66, 0.62, 0.44]} radius={0.12} smoothness={3} position={[0, 0.92, 0]}>
          <meshStandardMaterial color={p.hood} roughness={0.85} />
        </RoundedBox>
        {[-0.07, 0.07].map((sx) => (
          <mesh key={sx} position={[sx, 0.92, 0.225]}><boxGeometry args={[0.025, 0.24, 0.015]} /><meshBasicMaterial color={p.eye} toneMapped={false} /></mesh>
        ))}
        <group ref={armL} position={[-0.42, 1.14, 0]}>
          <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.15, 0.5, 0.16]} /><meshStandardMaterial color={p.hood} roughness={0.85} /></mesh>
          <mesh position={[0, -0.53, 0]}><sphereGeometry args={[0.09, 12, 12]} /><meshStandardMaterial color="#0d0e14" /></mesh>
        </group>
        <group ref={armR} position={[0.42, 1.14, 0]}>
          <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.15, 0.5, 0.16]} /><meshStandardMaterial color={p.hood} roughness={0.85} /></mesh>
          <mesh position={[0, -0.53, 0]}><sphereGeometry args={[0.09, 12, 12]} /><meshStandardMaterial color="#0d0e14" /></mesh>
        </group>
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
      <sprite ref={bubble} visible={false} position={[0.55, 2.25, 0]} scale={[0.8, 0.5, 1]}>
        <spriteMaterial map={BUBBLE_TEX()} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

// ---------------------------------------------------------------- camera
function CameraRig({ controls, focus, spread }: { controls: React.MutableRefObject<any>; focus: [number, number] | null; spread: number }) {
  const goal = useMemo(() => new THREE.Vector3(), []);
  const ready = useRef(false);
  useFrame(({ camera }) => {
    const c = controls.current;
    if (!c || !focus) return;
    goal.set(focus[0], 1.5, focus[1]);
    if (!ready.current) {
      c.target.copy(goal);
      camera.position.set(focus[0] + 0, 17 * spread, focus[1] + 24 * spread);
      ready.current = true;
      c.update();
      return;
    }
    const before = c.target.clone();
    c.target.lerp(goal, 0.07);
    camera.position.add(c.target.clone().sub(before)); // keep the viewing angle while flying to another island
    c.update();
  });
  return null;
}

// ---------------------------------------------------------------- scene
type DayMode = 'auto' | 'day' | 'night';
const jakartaIsDay = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date()));
  return h >= 6 && h < 18;
};

export function Office3D({
  robots, teams, focusTeamId = null, selectedId, onSelect, onFocusTeam = () => {},
}: {
  robots: RobotView[];
  teams: TeamView[];
  focusTeamId?: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFocusTeam?: (teamId: string) => void;
}) {
  const [mode, setMode] = useState<DayMode>('auto');
  const [autoDay, setAutoDay] = useState(true);
  const dayRef = useRef(1);
  const controls = useRef<any>(null);

  // remembered choice + Jakarta clock for "auto"
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai-office-daymode');
      if (saved === 'day' || saved === 'night' || saved === 'auto') setMode(saved);
    } catch {
      /* storage blocked: keep auto */
    }
    const tick = () => setAutoDay(jakartaIsDay());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  const choose = (m: DayMode) => {
    setMode(m);
    try {
      localStorage.setItem('ai-office-daymode', m);
    } catch {
      /* ignore */
    }
  };
  const isDay = mode === 'auto' ? autoDay : mode === 'day';

  const islands = useMemo<TeamView[]>(() => (teams.length ? teams : [{ id: NO_TEAM, name: 'No team yet' }]), [teams]);
  const robotsOf = (teamId: string) => robots.filter((r) => (r.teamId ?? NO_TEAM) === teamId);

  const plan = useMemo(() => buildLounge(robots, islands.length), [robots, islands.length]);

  const focusIndex = Math.max(0, islands.findIndex((t) => t.id === focusTeamId));
  const focus = teamCenter(focusIndex);
  // far enough back to see both lounges next to the islands
  const spread = (islands.length <= 1 ? 1 : islands.length <= 3 ? 1.5 : islands.length <= 7 ? 1.9 : 2.4) * 1.3;

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 17, 24], fov: 42, near: 0.1, far: 900 }}
        gl={{ antialias: true }}
        onPointerMissed={() => onSelect(null)}
      >
        <DayCtx.Provider value={dayRef}>
          <SceneRig isDay={isDay} />
          <SkyDome />
          <SunMoon />
          <Stars />
          <Clouds />
          <FloatingRocks />

          {islands.map((t, i) => (
            <Island key={t.id} index={i} team={t} robots={robotsOf(t.id)} selectedId={selectedId} onSelect={onSelect} onFocusTeam={onFocusTeam} plan={plan} />
          ))}

          <LoungeBar plan={plan} />
          <LoungeBunker plan={plan} />
          {islands.map((t, i) => (['bar', 'bunker'] as const).map((k) => {
            const L = plan[k];
            const rt = routeBetween(teamCenter(i), HEX_R, L.c, L.r);
            return <Bridge key={t.id + k} a={rt.a} b={rt.b} color={k === 'bar' ? BAR_COLOR : BUNKER_COLOR} />;
          }))}

          <OrbitControls
            ref={controls}
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={9}
            maxDistance={80}
            minPolarAngle={0.35}
            maxPolarAngle={1.5}
          />
          <CameraRig controls={controls} focus={focus} spread={spread} />
        </DayCtx.Provider>
      </Canvas>

      {/* day / night switch */}
      <div className="absolute right-3 top-3 z-10 inline-flex overflow-hidden rounded-lg border border-white/15 bg-black/45 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
        {([
          ['auto', Clock3, 'Auto'],
          ['day', Sun, 'Day'],
          ['night', Moon, 'Night'],
        ] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => choose(key)}
            title={key === 'auto' ? 'Follows Jakarta time: day 06:00-18:00' : label}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 ${mode === key ? 'bg-[#d4af37] text-black' : 'text-zinc-200 hover:bg-white/10'}`}
          >
            <Icon className="h-3 w-3" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Office3D;
