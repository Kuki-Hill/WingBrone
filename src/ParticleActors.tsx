import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import {
  Game,
  thresholds,
  ATTACK_TIMING,
  RIDER_Y,
  RIDER_SCALE,
  FLYING_SWORD_SCALE,
} from "./game";
import { iaiCutPose, upperBodyPoint } from "./iaiCut";
import { ENEMY_SCALE, lateralCutPose, SLASH_RELEASE } from "./lateralCut";

// Surface samples stay attached to their form while the shader circulates
// them along it. No solid meshes are used by the characters or weapons.
let seed = 51;
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
type Form = "orb" | "robe" | "hat" | "limb" | "blade" | "horn" | "leg";
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
    } else if (form === "leg") {
      y = (t - 0.5) * 0.74;
      const cap = Math.max(0, Math.abs(y) - 0.25);
      const radius = Math.sqrt(Math.max(0, 0.12 * 0.12 - cap * cap));
      x = Math.cos(angle) * radius;
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
    ref.current.position.set(x, y + RIDER_Y, 1);
    ref.current.rotation.z = calm ? 0 : -x * 0.075;
  });
  const n = low ? 0.55 : 1;
  return (
    <group ref={ref} scale={RIDER_SCALE}>
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
            form="leg"
            count={300}
            color="#83a99d"
            position={[s * 0.24, -0.43, 0]}
            scale={[1, 1, 1]}
          />
        </group>
      ))}
      <group
        position={[0, -0.83, 0]}
        rotation={[0, 0.98, 0]}
        scale={FLYING_SWORD_SCALE}
      >
        <group position={[0, 0, 1.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <Cloud
            game={game}
            form="blade"
            count={700}
            color="#e2edbf"
            scale={[1.4, 4.4, 1]}
          />
        </group>
        <group position={[-0.35, 0, 1.25]} rotation={[0, 0, -Math.PI / 2]}>
          <Cloud
            game={game}
            form="limb"
            count={100}
            color="#e2cd91"
            scale={[0.3, 0.7, 0.3]}
          />
        </group>
        <group position={[0, 0, 1.3]} rotation={[Math.PI / 2, 0, 0]}>
          <Cloud
            game={game}
            form="limb"
            count={180}
            color="#e4c995"
            scale={[0.55, 0.78, 0.55]}
          />
        </group>
      </group>
    </group>
  );
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
    hilt = useRef<T.Group>(null),
    sheath = useRef<T.Group>(null),
    head = useRef<T.Group>(null),
    torso = useRef<T.Group>(null);
  const thighs = useRef<(T.Group | null)[]>([null, null]);
  const shins = useRef<(T.Group | null)[]>([null, null]);
  const steel = useMemo(() => new T.Color("#f3c58d"), []);
  const scarlet = useMemo(() => new T.Color("#ff1713"), []);
  const saber = useMemo(() => new T.Color("#cbffeb"), []);
  const bladeTint = useRef(steel.clone());
  const practice = useRef({ step: -1, run: -1, start: 0 });
  const n = low ? 0.6 : 1;
  useFrame(() => {
    const side = game.activeDirection;
    const active = game.phase === "trial" || game.phase === "tutorial";
    const lateral = side === "left" || side === "right";
    let time = active ? game.cycle : 0;
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
    for (const part of [leftForearm, frontHand, rearHand, hilt])
      if (part.current) part.current.visible = active;
    if (sheath.current) sheath.current.visible = active && !lateral;
    if (lateral) {
      root.current?.scale.setScalar(ENEMY_SCALE);
      head.current?.scale.setScalar(1);
      if (torso.current) torso.current.rotation.x = 0;
      [-1, 1].forEach((side, i) => {
        bone(
          thighs.current[i],
          new T.Vector3(side * 1.15, -2.1, 0),
          new T.Vector3(side * 1.3, -3.8, 0.3),
          2.8,
        );
        bone(
          shins.current[i],
          new T.Vector3(side * 1.3, -3.8, 0.3),
          new T.Vector3(side * 1.45, -5.8, 0.25),
          2.5,
        );
      });
      const pose = lateralCutPose(side, time);
      if (root.current) {
        root.current.position.set(0, 1, pose.rootZ);
        root.current.rotation.z = 0;
      }
      bone(upper.current, new T.Vector3(-2.4, 4.8, 0), pose.frontElbow, 2.7);
      bone(lower.current, pose.frontElbow, pose.frontGrip, 2.0);
      bone(left.current, new T.Vector3(2.4, 4.8, 0), pose.rearElbow, 2.7);
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
    const flank = game.flank;
    const pose = iaiCutPose(side, flank, time);
    root.current?.position.copy(pose.root);
    root.current?.scale.setScalar(pose.scale);
    head.current?.scale.setScalar(pose.headScale);
    if (torso.current) torso.current.rotation.x = pose.torsoTilt;
    pose.legs.forEach((leg, i) => {
      bone(thighs.current[i], leg.hip, leg.knee, 2.8);
      bone(shins.current[i], leg.knee, leg.foot, 2.5);
    });
    bladeTint.current.copy(pose.red ? scarlet : steel);
    if (weapon.current) weapon.current.visible = active;
    const supportElbow = new T.Vector3(flank * 2.7, 3.8, 0.45);
    bone(
      upper.current,
      upperBodyPoint(new T.Vector3(-flank * 2.4, 4.8, 0), pose.torsoTilt),
      pose.elbow,
      2.7,
    );
    bone(lower.current, pose.elbow, pose.hand, 2);
    bone(
      left.current,
      upperBodyPoint(new T.Vector3(flank * 2.4, 4.8, 0), pose.torsoTilt),
      supportElbow,
      2.7,
    );
    bone(leftForearm.current, supportElbow, pose.sheathMouth, 2);
    frontHand.current?.position.copy(pose.hand);
    rearHand.current?.position.copy(pose.sheathMouth);
    bone(hilt.current, pose.hand, pose.bladeBase, 1.4);
    bone(sheath.current, pose.sheathMouth, pose.sheathEnd, 2.3);
    bone(weapon.current, pose.bladeBase, pose.bladeTip, 4.1);
  });
  return (
    <group ref={root} position={[0, 1, -23]} scale={ENEMY_SCALE}>
      <group ref={torso} position={[0, 3, 0]}>
        <group position={[0, -3, 0]}>
          <Cloud
            game={game}
            calm={calm}
            form="robe"
            count={Math.floor(2800 * n)}
            color="#5c988c"
            position={[0, -4, 0]}
            scale={[4.5, 9, 3]}
          />
          <group ref={head} position={[0, 6.1, 0]}>
            <Cloud
              game={game}
              calm={calm}
              form="orb"
              count={1200}
              color="#a4c8b4"
              scale={[1.25, 1.6, 1]}
            />
            {[-1, 1].map((s) => (
              <group key={s}>
                <group position={[s * 0.9, 1, 0]} rotation={[0, 0, -s * 0.35]}>
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
                  position={[s * 0.5, 0.25, 1]}
                  scale={[0.18, 0.09, 0.08]}
                />
              </group>
            ))}
          </group>
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
            </group>
          ))}
        </group>
      </group>
      {[0, 1].map((i) => (
        <group key={i}>
          <group
            ref={(node) => {
              thighs.current[i] = node;
            }}
          >
            <Cloud game={game} form="limb" count={340} color="#a2bfa8" />
          </group>
          <group
            ref={(node) => {
              shins.current[i] = node;
            }}
          >
            <Cloud game={game} form="limb" count={300} color="#94ac99" />
          </group>
        </group>
      ))}
      <group ref={sheath} visible={false}>
        <Cloud game={game} form="limb" count={450 * n} color="#62867e" />
      </group>
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
    const launch = SLASH_RELEASE;
    ref.current.visible = game.phase === "trial" && t >= launch && t < 4.3;
    if (!ref.current.visible) return;
    const progress = T.MathUtils.clamp(
      (t - launch) / (ATTACK_TIMING.impact - launch),
      0,
      1,
    );
    const dissolve = Math.max(0, (t - ATTACK_TIMING.impact) / 0.8);
    const origin = new T.Vector3();
    const a = geometry.attributes.position.array as Float32Array;
    geometry.attributes.position.needsUpdate = true;
    material.opacity = (1 - dissolve) * 0.7;
    if (!horizontal) {
      // Sample successive blade poses to produce a flat fan at waist or
      // chest height. The ribbon stays attached to the actual drawing arc.
      const end = Math.min(t, ATTACK_TIMING.impact);
      const flank = game.flank;
      const ribbon = Array.from({ length: 16 }, (_, i) =>
        iaiCutPose(d, flank, end - (i / 15) * 0.14),
      );
      for (let i = 0; i < count; i++) {
        const [u, v, w] = samples[i];
        const pose = ribbon[Math.floor(v * 16)];
        origin
          .lerpVectors(pose.bladeBase, pose.bladeTip, u)
          .multiplyScalar(pose.scale)
          .add(pose.root);
        a[i * 3] = origin.x + (v - 0.5) * dissolve * 2;
        a[i * 3 + 1] = origin.y + (w - 0.5) * (0.16 + dissolve * 1.6);
        a[i * 3 + 2] = origin.z + dissolve * (w - 0.2) * 2;
      }
      return;
    }
    const releasePose = lateralCutPose(d, launch);
    const edge = thresholds.horizontal;
    const sign = d === "left" ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const [u, v, w] = samples[i];
      const blocked = sign * (-edge + u * (edge + 7));
      const cross = (v - 0.5) * 14;
      const x = blocked;
      const y = cross + RIDER_Y;
      // Emit from points along the raised blade in world space. At impact the
      // cloud reaches the existing unsafe half-plane on the opposite side.
      origin
        .lerpVectors(releasePose.bladeBase, releasePose.bladeTip, u)
        .multiplyScalar(ENEMY_SCALE);
      origin.y += 1;
      origin.z += releasePose.rootZ;
      const curve = Math.sin(progress * Math.PI) * (w - 0.5) * 9;
      a[i * 3] =
        T.MathUtils.lerp(origin.x, x, progress) +
        curve +
        dissolve * (u - 0.5) * 5;
      a[i * 3 + 1] =
        T.MathUtils.lerp(origin.y, y, progress) +
        Math.sin(progress * Math.PI) * 3 +
        dissolve * (v - 0.5) * 5;
      a[i * 3 + 2] =
        T.MathUtils.lerp(origin.z, 1, progress) + dissolve * (w - 0.2) * 10;
    }
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
