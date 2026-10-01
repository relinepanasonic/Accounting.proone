'use client';

// 3D office in the sky: every team owns a hexagonal island with a glowing border, a tiled floor, one dome pod per
// agent, a command hub in the middle and some cargo. Islands sit side by side like a honeycomb, floating above the
// clouds, with a day / night cycle. Robots sit at their pod while working (or queued) and mill around the hub when idle.
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
  index, team, robots, selectedId, onSelect, onFocusTeam,
}: {
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
          <Robot key={s.robot.id} station={s} selected={selectedId === s.robot.id} onSelect={onSelect} />
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

function Robot({ station, selected, onSelect }: { station: Station; selected: boolean; onSelect: (id: string) => void }) {
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
  const start = useRef(false);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const t = state.clock.elapsedTime + seed;
    const atDesk = robot.state !== 'idle';
    const tx = atDesk ? station.x : station.idleX;
    const tz = atDesk ? station.z : station.idleZ;

    if (!start.current) {
      g.position.set(tx, SURFACE_Y, tz);
      g.rotation.y = station.face;
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
      const target = atDesk ? station.face : station.face + Math.sin(t * 0.25) * 1.3; // idle robots glance around
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

  const focusIndex = Math.max(0, islands.findIndex((t) => t.id === focusTeamId));
  const focus = teamCenter(focusIndex);
  const spread = islands.length <= 1 ? 1 : islands.length <= 3 ? 1.5 : islands.length <= 7 ? 1.9 : 2.4;

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
            <Island key={t.id} index={i} team={t} robots={robotsOf(t.id)} selectedId={selectedId} onSelect={onSelect} onFocusTeam={onFocusTeam} />
          ))}

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
