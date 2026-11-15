import * as THREE from 'three';
import { PALETTE } from '../config.js';

/**
 * 夕阳天空：渐变 + 太阳光晕 + 一层飘动的云带。
 * 注意：自定义 shader 不走 three 的 tonemapping，手动做 gamma，保持和其他材质一致。
 */
export function createSky(sunDir) {
  const uniforms = {
    topColor: { value: new THREE.Color(PALETTE.skyTop) },
    midColor: { value: new THREE.Color(PALETTE.skyMid) },
    horizonColor: { value: new THREE.Color(PALETTE.skyHorizon) },
    sunColor: { value: new THREE.Color(PALETTE.sun) },
    sunDir: { value: sunDir.clone().normalize() },
    uTime: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor, midColor, horizonColor, sunColor, sunDir;
      uniform float uTime;
      varying vec3 vWorld;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i), b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }

      void main(){
        vec3 dir = normalize(vWorld - cameraPosition);
        float y = dir.y;

        vec3 col = mix(horizonColor, midColor, smoothstep(-0.02, 0.30, y));
        col = mix(col, topColor, smoothstep(0.24, 0.88, y));

        float sd = max(dot(dir, sunDir), 0.0);
        col += sunColor * pow(sd, 18.0) * 0.40;
        col += sunColor * pow(sd, 420.0) * 2.6;

        // 低空暖带
        float band = exp(-abs(y - 0.02) * 11.0);
        col = mix(col, sunColor, band * 0.18);

        // 云带：把方向投影到高空平面
        if (y > 0.015) {
          vec2 uv = dir.xz / max(y, 0.08) * 0.32;
          uv += vec2(uTime * 0.004, uTime * 0.0015);
          float n = fbm(uv * 1.6);
          float cloud = smoothstep(0.52, 0.86, n) * smoothstep(0.015, 0.22, y);
          vec3 cloudCol = mix(horizonColor * 1.12, sunColor, smoothstep(0.1, 0.9, pow(sd, 3.0)));
          col = mix(col, cloudCol, cloud * 0.55);
        }

        // 地平线以下压暗
        col *= mix(1.0, 0.55, smoothstep(0.0, -0.18, y));

        col = pow(max(col, 0.0), vec3(0.4545));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 40, 26), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  return {
    mesh,
    update(dt) {
      uniforms.uTime.value += dt;
    },
  };
}
