import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as T from "three";
import { Game } from "./game";
import { ParticleHero, ParticleEnemy, ParticleSlash } from "./ParticleActors";
export type CaptureRequest = {
  key: string;
  done: (canvas: HTMLCanvasElement) => void;
  fail: () => void;
};
let seed = 83;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function Particles({
  game,
  low,
  calm,
}: {
  game: Game;
  low: boolean;
  calm: boolean;
}) {
  const mat = useMemo(
    () =>
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexColors: true,
        blending: T.AdditiveBlending,
        uniforms: { clock: { value: 0 }, motion: { value: 1 } },
        vertexShader: `attribute float size; attribute float kind; uniform float clock; uniform float motion; varying vec3 c; varying float a; void main(){vec3 p=position; p.z=mod(p.z+clock*7.0*motion+100.0,180.0)-110.0; p.x+=sin(clock*.35+p.y*.7+p.z*.08)*.65; p.y+=cos(clock*.28+p.x*.4)*.25;vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*100./max(1.,-mv.z),1.,5.); c=color;a=smoothstep(0.,15.,-mv.z)*(1.-smoothstep(70.,115.,-mv.z));}`,
        fragmentShader: `varying vec3 c;varying float a;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(c,a*(1.-smoothstep(.3,.5,d))*.8);}`,
      }),
    [],
  );
  const geometry = useMemo(() => {
    seed = 83;
    const p: number[] = [],
      c: number[] = [],
      s: number[] = [],
      k: number[] = [];
    const add = (
      x: number,
      y: number,
      z: number,
      size: number,
      color: string,
    ) => {
      p.push(x, y, z);
      const col = new T.Color(color);
      c.push(col.r, col.g, col.b);
      s.push(size);
      k.push(0);
    };
    for (let i = 0; i < 4500; i++) {
      const z = random() * 180 - 110;
      const side = random() > 0.5 ? 1 : -1;
      const x = side * (8 + random() * 32);
      const y = -5 + random() * 3 + Math.sin(z * 0.07 + x * 0.05) * 4;
      add(x, y, z, 0.5 + random(), ["#526c53", "#82936a", "#a4b489"][i % 3]);
    }
    for (let i = 0; i < 48; i++) {
      const z = random() * 180 - 110;
      const x = (random() > 0.5 ? 1 : -1) * (8 + random() * 24);
      const h = 7 + random() * 17;
      for (let j = 0; j < 70; j++) {
        const y = -5 + (j / 70) * h;
        add(x + Math.sin(y * 0.08) * 0.5, y, z, 0.75, "#607e64");
        if (j % 9 === 0)
          for (let n = 0; n < 6; n++)
            add(
              x + (random() - 0.5) * 5,
              y + random() * 2,
              z + (random() - 0.5) * 2,
              0.8,
              "#94aa7c",
            );
      }
    }
    for (let i = 0; i < 4000; i++)
      add(
        (random() - 0.5) * 90,
        (random() - 0.3) * 45,
        random() * 180 - 110,
        0.3 + random() * 1.8,
        i % 4 ? "#a8b99a" : "#e4e6c8",
      );
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(c, 3));
    g.setAttribute("size", new T.Float32BufferAttribute(s, 1));
    g.setAttribute("kind", new T.Float32BufferAttribute(k, 1));
    return g;
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      mat.dispose();
    },
    [geometry, mat],
  );
  useFrame(() => {
    mat.uniforms.clock.value =
      game.phase === "home" ? (performance.now() / 1000) * 0.3 : game.time;
    mat.uniforms.motion.value = calm ? 0.3 : 1;
    geometry.setDrawRange(0, low ? 7500 : geometry.attributes.position.count);
  });
  return <points geometry={geometry} material={mat} frustumCulled={false} />;
}
function World({
  game,
  low,
  calm,
  capture,
  onReady,
}: {
  game: Game;
  low: boolean;
  calm: boolean;
  capture: CaptureRequest | null;
  onReady: () => void;
}) {
  const { gl, scene, camera } = useThree();
  const handled = useRef("");
  useEffect(onReady, []);
  useFrame(() => {
    const p = game.position;
    camera.position.x = T.MathUtils.lerp(
      camera.position.x,
      calm ? 0 : p[0] * 0.1,
      0.08,
    );
    camera.lookAt(0, 1.5, -23);
    if (capture && capture.key !== handled.current) {
      handled.current = capture.key;
      const target = new T.WebGLRenderTarget(1280, 720);
      const previous = gl.getRenderTarget();
      const cam = camera.clone() as T.PerspectiveCamera;
      cam.aspect = 1280 / 720;
      cam.updateProjectionMatrix();
      try {
        gl.setRenderTarget(target);
        gl.render(scene, cam);
        const pixels = new Uint8Array(1280 * 720 * 4);
        gl.readRenderTargetPixels(target, 0, 0, 1280, 720, pixels);
        const output = document.createElement("canvas");
        output.width = 1280;
        output.height = 720;
        const ctx = output.getContext("2d")!;
        const image = ctx.createImageData(1280, 720);
        for (let y = 0; y < 720; y++)
          image.data.set(
            pixels.subarray((719 - y) * 1280 * 4, (720 - y) * 1280 * 4),
            y * 1280 * 4,
          );
        ctx.putImageData(image, 0, 0);
        capture.done(output);
      } catch {
        capture.fail();
      } finally {
        gl.setRenderTarget(previous);
        target.dispose();
      }
    }
  });
  return (
    <>
      <color attach="background" args={["#030506"]} />
      <fog attach="fog" args={["#030506", 24, 110]} />
      <ambientLight intensity={2} />
      <directionalLight
        position={[-10, 18, 10]}
        intensity={3}
        color="#f5f0d4"
      />
      <Particles game={game} low={low} calm={calm} />
      <ParticleHero game={game} calm={calm} low={low} />
      <ParticleEnemy game={game} calm={calm} low={low} />
      <ParticleSlash game={game} low={low} />
    </>
  );
}
export default function Scene(props: {
  game: Game;
  low: boolean;
  calm: boolean;
  capture: CaptureRequest | null;
  onReady: () => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 3.1, 13.5], fov: 58, near: 0.1, far: 200 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
      fallback={<span>無法建立三維畫布 / WEBGL UNAVAILABLE</span>}
    >
      <World {...props} />
    </Canvas>
  );
}
