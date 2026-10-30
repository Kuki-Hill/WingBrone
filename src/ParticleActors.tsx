import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { Game, thresholds, ATTACK_TIMING } from "./game";
import { ENEMY_SCALE, lateralCutPose, SLASH_RELEASE } from "./lateralCut";

// Surface samples stay attached to their form while the shader circulates
// them along it. No solid meshes are used by the characters or weapons.
let seed = 51;
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
type Form = "orb" | "robe" | "hat" | "limb" | "blade" | "horn";
function sample(form: Form, n: number) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const angle = rnd() * Math.PI * 2;
    const t = rnd();
    let x = 0,
      y = 0,
      z = 0;
    const r = 0.78 + rnd() * 0.22;
    if (form === "orb") {
      const h = 2 * t - 1;
      const radius = Math.sqrt(1 - h * h) * r;
      x = Math.cos(angle) * radius;
      y = h;
      z = Math.sin(angle) * radius;
    } else if (form === "hat") {
      const radius = Math.sqrt(t);
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      y = (1 - radius) * 0.4;
    } else if (form === "robe") {
      const radius = (1 - t) * 0.65 + 0.22;
      x = Math.cos(angle) * radius;
      y = t;
      z = Math.sin(angle) * radius * 0.6;
    } else if (form === "blade") {
      x = (rnd() - 0.5) * 0.28 * (1 - t * 0.8);
      y = t;
      z = (rnd() - 0.5) * 0.045;
    } else if (form === "horn") {
      x = Math.cos(angle) * (1 - t) * 0.25 + t * t * 0.35;
      y = t;
      z = Math.sin(angle) * (1 - t) * 0.25;
    } else {
      x = Math.cos(angle) * 0.16 * r;
      y = t;
      z = Math.sin(angle) * 0.16 * r;
    }
    a.set([x, y, z], i * 3);
  }
  return a;
}
function Cloud({
  form,
  count,
  color,
  scale = [1, 1, 1],
  position = [0, 0, 0],
  game,
  calm = false,
  tint,
}: {
  form: Form;
  count: number;
  color: string;
  scale?: [number, number, number];
  position?: [number, number, number];
  game: Game;
  calm?: boolean;
  tint?: { current: T.Color };
}) {
  const resources = useMemo(() => {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(sample(form, count), 3));
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = rnd();
    g.setAttribute("aSeed", new T.BufferAttribute(seeds, 1));
    const m = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uFlow: { value: 0.035 },
        uSpin: { value: form === "blade" || form === "horn" ? 0 : 0.38 },
        uColor: { value: new T.Color(color) },
      },
      vertexShader: `attribute float aSeed;uniform float uTime;uniform float uFlow;uniform float uSpin;varying float alpha;void main(){vec3 p=position;float turn=uTime*uSpin*(.8+.2*sin(p.y*3.));p.xz=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p.xz;float s=aSeed*63.;float a=uTime*.42+position.y*3.+s; p+=vec3(sin(a),cos(a*1.3),cos(a)) * uFlow;vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp((1.+aSeed*1.5)*30./max(3.,-v.z),1.1,4.5);alpha=.4+.6*aSeed;}`,
      fragmentShader:
        `uniform vec3 uColor;varying float alpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=pow(1.-d*2.,1.4);gl_FragColor=vec4(uColor*1.5,a*alpha);#include <colorspace_fragment>}`.replace(
          ";#include",
          ";\n#include",
        ),
    });
    return { g, m };
  }, [form, count, color]);
  useEffect(
    () => () => {
      resources.g.dispose();
      resources.m.dispose();
    },
    [resources],
  );
  useFrame(() => {
    if (tint) resources.m.uniforms.uColor.value.copy(tint.current);
    resources.m.uniforms.uTime.value =
      game.phase === "home" ? performance.now() / 1000 : game.time;
    resources.m.uniforms.uFlow.value = calm ? 0.012 : 0.045;
    resources.m.uniforms.uSpin.value =
      form === "blade" || form === "horn" ? 0 : calm ? 0.08 : 0.38;
  });
  return (
    <points
      geometry={resources.g}
      material={resources.m}
      scale={scale}
      position={position}
      frustumCulled={false}
    />
  );
}
const axis = new T.Vector3(0, 1, 0);
function bone(
  group: T.Group | null,
  from: T.Vector3,
  to: T.Vector3,
  width = 1,
) {
  if (!group) return;
  group.position.copy(from);
  group.scale.set(width, from.distanceTo(to), width);
  group.quaternion.setFromUnitVectors(axis, to.clone().sub(from).normalize());
}
export function ParticleHero({
  game,
  calm,
  low,
}: {
  game: Game;
  calm: boolean;
  low: boolean;
}) {
  const ref = useRef<T.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const [x, y] = game.position;
    ref.current.position.set(x, y - 1, 1);
    ref.current.rotation.z = calm ? 0 : -x * 0.075;
  });
  const n = low ? 0.55 : 1;
  return (
    <group ref={ref}>
      <Cloud
        game={game}
        calm={calm}
        form="hat"
        count={Math.floor(1100 * n)}
        color="#e7d8a6"
        position={[0, 1.85, 0]}
        scale={[0.95, 1, 0.95]}
      />
      <Cloud
        game={game}
        calm={calm}
        form="orb"
        count={250}
        color="#a9d7bd"
        position={[0, 1.5, 0]}
        scale={[0.25, 0.29, 0.25]}
      />
      <Cloud
        game={game}
        calm={calm}
        form="robe"
        count={Math.floor(1500 * n)}
        color="#95bda2"
        position={[0, -0.2, 0]}
        scale={[1, 1.65, 1]}
      />
      {[-1, 1].map((s) => (
        <group key={s}>
          <group position={[s * 0.57, 0.3, 0]} rotation={[0, 0, s * 0.35]}>
            <Cloud
              game={game}
              form="limb"
              count={280}
              color="#c2d5b2"
              scale={[1, 0.85, 1]}
            />
          </group>
          <Cloud
            game={game}
            form="limb"
            count={200}
            color="#83a99d"
            position={[s * 0.23, -0.75, 0]}
            scale={[0.8, 0.6, 0.8]}
          />
        </group>
      ))}
      <group position={[0, -0.83, 1.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <Cloud
          game={game}
          form="blade"
          count={700}
          color="#e2edbf"
          scale={[1.4, 4.4, 1]}
        />
      </group>
      <group position={[-0.35, -0.82, 1.25]} rotation={[0, 0, -Math.PI / 2]}>
        <Cloud
          game={game}
          form="limb"
          count={100}
          color="#e2cd91"
          scale={[0.3, 0.7, 0.3]}
        />
      </group>
      <group position={[0, -0.86, 2]} rotation={[Math.PI / 2, 0, 0]}>
        <Cloud
          game={game}
          form="robe"
          count={450}
          color="#5da999"
          scale={[0.35, 7, 0.08]}
        />
      </group>
    </group>
  );
}
function motion(game: Game) {
  const t = game.phase === "trial" ? game.cycle : 0;
  const wind = T.MathUtils.smoothstep(t, 1, 2.7);
  const cut = T.MathUtils.smoothstep(
    t,
    ATTACK_TIMING.cueStart,
    ATTACK_TIMING.impact,
  );
  const release = T.MathUtils.smoothstep(t, 3.65, 4.8);
  return { t, wind, cut, release };
}
export function ParticleEnemy({
  game,
  calm,
  low,
}: {
  game: Game;
  calm: boolean;
  low: boolean;
}) {
  const root = useRef<T.Group>(null),
    upper = useRef<T.Group>(null),
    lower = useRef<T.Group>(null),
    weapon = useRef<T.Group>(null),
    left = useRef<T.Group>(null),
    leftForearm = useRef<T.Group>(null),
    frontHand = useRef<T.Group>(null),
    rearHand = useRef<T.Group>(null),
    hilt = useRef<T.Group>(null);
  const steel = useMemo(() => new T.Color("#f3c58d"), []);
  const scarlet = useMemo(() => new T.Color("#ff1713"), []);
  const saber = useMemo(() => new T.Color("#cbffeb"), []);
  const bladeTint = useRef(steel.clone());
  const practice = useRef({ step: -1, run: -1, start: 0 });
  const n = low ? 0.6 : 1;
  useFrame(() => {
    const side = game.activeDirection;
    const isSide =
      (side === "left" || side === "right") &&
      (game.phase === "trial" || game.phase === "tutorial");
    for (const part of [leftForearm, frontHand, rearHand, hilt])
      if (part.current) part.current.visible = isSide;
    if (isSide) {
      let time = game.cycle;
      if (game.phase === "tutorial") {
        if (
          practice.current.run !== game.run ||
          practice.current.step !== game.tutorialIndex
        )
          practice.current = {
            step: game.tutorialIndex,
            run: game.run,
            start: game.time,
          };
        time = Math.min(
          ATTACK_TIMING.cueStart,
          game.time - practice.current.start,
        );
      }
      const pose = lateralCutPose(side, time);
      if (root.current) {
        root.current.position.set(0, 1, pose.rootZ);
        root.current.rotation.z = 0;
      }
      bone(upper.current, new T.Vector3(2.4, 4.8, 0), pose.frontElbow, 2.7);
      bone(lower.current, pose.frontElbow, pose.frontGrip, 2.0);
      bone(left.current, new T.Vector3(-2.4, 4.8, 0), pose.rearElbow, 2.7);
      bone(leftForearm.current, pose.rearElbow, pose.rearGrip, 2.0);
      frontHand.current?.position.copy(pose.frontGrip);
      rearHand.current?.position.copy(pose.rearGrip);
      if (hilt.current) hilt.current.visible = pose.bladeLength > 0;
      if (weapon.current) weapon.current.visible = pose.bladeLength > 0;
      if (pose.bladeLength > 0) {
        bone(hilt.current, pose.hiltBase, pose.bladeBase, 1.1);
        bone(weapon.current, pose.bladeBase, pose.bladeTip, 4.0);
      }
      bladeTint.current.copy(pose.red ? scarlet : saber);
      return;
    }
    bladeTint.current.copy(steel);
    if (weapon.current)
      weapon.current.visible =
        game.phase === "trial" || game.phase === "tutorial";
    const { wind, cut, release } = motion(game);
    const strength = cut * (1 - release);
    if (root.current) {
      root.current.position.set(0, 1, -23 + strength * 10);
      root.current.rotation.z =
        (game.activeDirection === "right" ? -1 : 1) * strength * 0.12;
    }
    const mirror = game.activeDirection === "right" ? -1 : 1;
    const angle = 0.6 - wind * 1.45 + cut * 2.5 * (1 - release);
    const shoulder = new T.Vector3(mirror * 2.6, 4.8, 0);
    const elbow = shoulder
      .clone()
      .add(
        new T.Vector3(
          mirror * Math.sin(angle) * 2.5,
          Math.cos(angle) * 2.5,
          -wind,
        ),
      );
    const hand = elbow
      .clone()
      .add(
        new T.Vector3(
          mirror * Math.sin(angle + 0.45) * 2.6,
          Math.cos(angle + 0.45) * 2.6,
          strength * 3,
        ),
      );
    const tip = hand
      .clone()
      .add(
        new T.Vector3(
          -mirror * strength * 6,
          5.5 * (1 - cut) - strength * 5,
          strength * 8,
        ),
      );
    bone(upper.current, shoulder, elbow, 2.8);
    bone(lower.current, elbow, hand, 2.1);
    bone(weapon.current, hand, tip, 3);
    bone(
      left.current,
      new T.Vector3(-mirror * 2.5, 4.7, 0),
      new T.Vector3(-mirror * (3 + wind), 1.5, -1),
      2.5,
    );
  });
  return (
    <group ref={root} position={[0, 1, -23]} scale={ENEMY_SCALE}>
      <Cloud
        game={game}
        calm={calm}
        form="robe"
        count={Math.floor(2800 * n)}
        color="#5c988c"
        position={[0, -4, 0]}
        scale={[4.5, 9, 3]}
      />
      <Cloud
        game={game}
        calm={calm}
        form="orb"
        count={1200}
        color="#a4c8b4"
        position={[0, 6.1, 0]}
        scale={[1.25, 1.6, 1]}
      />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Cloud
            game={game}
            form="orb"
            count={400}
            color="#91bcb1"
            position={[s * 2.4, 4.8, 0]}
            scale={[1.4, 0.9, 1]}
          />
          <group position={[s * 0.9, 7.1, 0]} rotation={[0, 0, -s * 0.35]}>
            <Cloud
              game={game}
              form="horn"
              count={220}
              color="#dbbc81"
              scale={[1, 2, 1]}
            />
          </group>
          <Cloud
            game={game}
            form="orb"
            count={60}
            color="#ffd8a0"
            position={[s * 0.5, 6.35, 1]}
            scale={[0.18, 0.09, 0.08]}
          />
          <Cloud
            game={game}
            form="limb"
            count={500}
            color="#548b83"
            position={[s * 1.2, -6, 0]}
            scale={[3, 4, 3]}
          />
        </group>
      ))}
      <group ref={upper}>
        <Cloud game={game} form="limb" count={700} color="#9bc4a8" />
      </group>
      <group ref={lower}>
        <Cloud game={game} form="limb" count={600} color="#cccf9f" />
      </group>
      <group ref={left}>
        <Cloud game={game} form="limb" count={600} color="#79a69b" />
      </group>
      <group ref={weapon} visible={false}>
        <Cloud
          game={game}
          form="blade"
          count={Math.floor(1500 * n)}
          color="#f3c58d"
          tint={bladeTint}
        />
      </group>
      <group ref={leftForearm}>
        <Cloud game={game} form="limb" count={380 * n} color="#aacbb9" />
      </group>
      <group ref={hilt}>
        <Cloud game={game} form="limb" count={220} color="#93724a" />
      </group>
      <group ref={frontHand}>
        <Cloud
          game={game}
          form="orb"
          count={200}
          scale={[0.37, 0.37, 0.36]}
          color="#d3d8bb"
        />
      </group>
      <group ref={rearHand}>
        <Cloud
          game={game}
          form="orb"
          count={200}
          scale={[0.37, 0.37, 0.36]}
          color="#b7c6a5"
        />
      </group>
    </group>
  );
}
export function ParticleSlash({ game, low }: { game: Game; low: boolean }) {
  const ref = useRef<T.Points>(null);
  const count = low ? 1100 : 2400;
  const { geometry, material, samples } = useMemo(() => {
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(count * 3), 3),
    );
    const samples = Array.from({ length: count }, () => [rnd(), rnd(), rnd()]);
    const m = new T.PointsMaterial({
      color: "#e9b979",
      size: 0.055,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    return { geometry: g, material: m, samples };
  }, [count]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(() => {
    if (!ref.current) return;
    const t = game.cycle;
    const d = game.activeDirection;
    const horizontal = d === "left" || d === "right";
    const launch = horizontal ? SLASH_RELEASE : 2.75;
    ref.current.visible = game.phase === "trial" && t >= launch && t < 4.3;
    if (!ref.current.visible) return;
    const progress = T.MathUtils.clamp(
      (t - launch) / (ATTACK_TIMING.impact - launch),
      0,
      1,
    );
    const dissolve = Math.max(0, (t - ATTACK_TIMING.impact) / 0.8);
    const releasePose = horizontal ? lateralCutPose(d, launch) : null;
    const origin = new T.Vector3();
    const edge = horizontal ? thresholds.horizontal : thresholds.vertical;
    const sign = d === "left" || d === "down" ? 1 : -1;
    const a = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const [u, v, w] = samples[i];
      const blocked = sign * (-edge + u * (edge + 7));
      const cross = (v - 0.5) * 14;
      const x = horizontal ? blocked : cross;
      const y = (horizontal ? cross : blocked) - 1;
      // Emit from points along the raised blade in world space. At impact the
      // cloud reaches the existing unsafe half-plane on the opposite side.
      if (releasePose)
        origin
          .lerpVectors(releasePose.bladeBase, releasePose.bladeTip, u)
          .multiplyScalar(ENEMY_SCALE);
      const curve = Math.sin(progress * Math.PI) * (w - 0.5) * 9;
      a[i * 3] =
        T.MathUtils.lerp(releasePose ? origin.x : sign * 5, x, progress) +
        curve +
        dissolve * (u - 0.5) * 5;
      a[i * 3 + 1] =
        T.MathUtils.lerp(releasePose ? origin.y + 1 : 8, y, progress) +
        Math.sin(progress * Math.PI) * 3 +
        dissolve * (v - 0.5) * 5;
      a[i * 3 + 2] =
        T.MathUtils.lerp(
          releasePose ? releasePose.rootZ + origin.z : -13,
          1,
          progress,
        ) -
        (releasePose ? 0 : (1 - progress) * w * 5) +
        dissolve * (w - 0.2) * 10;
    }
    geometry.attributes.position.needsUpdate = true;
    material.opacity = (1 - dissolve) * 0.7;
  });
  return (
    <points
      ref={ref}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}
