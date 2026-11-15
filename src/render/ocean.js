import * as THREE from 'three';
import { PALETTE } from '../config.js';

/**
 * 海面：多方向涌浪 + 细碎波纹 + 菲涅尔天空反射 + 夕阳金光带 + 浪尖白沫 + 岸边碎浪。
 * 波浪振幅近岸衰减，和沙滩自然衔接。
 */
export function createOcean(sunDir) {
  const geo = new THREE.PlaneGeometry(1500, 1500, 190, 190);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uShoreX: { value: -13.0 },
    deepColor: { value: new THREE.Color(PALETTE.oceanDeep) },
    shallowColor: { value: new THREE.Color(PALETTE.oceanShallow) },
    horizonColor: { value: new THREE.Color(PALETTE.skyHorizon) },
    midColor: { value: new THREE.Color(PALETTE.skyMid) },
    sunColor: { value: new THREE.Color(PALETTE.sun) },
    sunDir: { value: sunDir.clone().normalize() },
  };

  const waveGLSL = /* glsl */ `
    float waveHeight(vec2 p, float t){
      float h = 0.0;
      h += sin(dot(p, vec2( 0.052,  0.021)) + t * 0.80) * 1.15;
      h += sin(dot(p, vec2(-0.034,  0.072)) + t * 1.15) * 0.72;
      h += sin(dot(p, vec2( 0.118, -0.086)) + t * 1.75) * 0.26;
      h += sin(dot(p, vec2( 0.215,  0.163)) + t * 2.45) * 0.11;
      return h;
    }
    float shoreAmp(float x, float shoreX){
      return smoothstep(0.0, 1.0, clamp((shoreX - 3.0 - x) / 74.0, 0.0, 1.0));
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uShoreX;
      varying vec3 vWorld;
      varying float vAmp;
      varying float vHeight;
      ${waveGLSL}

      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float amp = shoreAmp(wp.x, uShoreX);
        float h = waveHeight(wp.xz, uTime) * amp;
        wp.y += h;
        vAmp = amp;
        vHeight = h;
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uShoreX;
      uniform vec3 deepColor, shallowColor, horizonColor, midColor, sunColor, sunDir;
      varying vec3 vWorld;
      varying float vAmp;
      varying float vHeight;
      ${waveGLSL}

      void main(){
        vec2 p = vWorld.xz;
        float t = uTime;

        float e = 0.55;
        float hL = waveHeight(p - vec2(e, 0.0), t);
        float hR = waveHeight(p + vec2(e, 0.0), t);
        float hD = waveHeight(p - vec2(0.0, e), t);
        float hU = waveHeight(p + vec2(0.0, e), t);
        float dx = (hR - hL) / (2.0 * e) * vAmp;
        float dz = (hU - hD) / (2.0 * e) * vAmp;

        // 高频细浪，制造碎光
        dx += sin(p.x * 2.3 + p.y * 0.7 + t * 4.1) * 0.03;
        dz += sin(p.x * -1.1 + p.y * 2.9 + t * 3.3) * 0.03;

        vec3 N = normalize(vec3(-dx * 3.2, 1.0, -dz * 3.2));
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 L = sunDir;

        float distToShore = max(0.0, uShoreX - vWorld.x);
        float ndv = max(dot(N, V), 0.0);
        float fres = pow(1.0 - ndv, 4.0);

        // 水色：近岸青绿 → 外海深蓝
        float shallowMix = exp(-distToShore * 0.045);
        vec3 base = mix(deepColor, shallowColor, shallowMix * 0.85 + 0.1);

        // 天空反射
        vec3 R = reflect(-V, N);
        float ry = clamp(R.y * 1.6, 0.0, 1.0);
        vec3 skyRefl = mix(horizonColor, midColor, ry * 0.9);
        vec3 col = mix(base, skyRefl, clamp(0.14 + fres * 1.15, 0.0, 0.95));

        // 太阳镜面高光
        vec3 H = normalize(L + V);
        col += sunColor * pow(max(dot(N, H), 0.0), 160.0) * 3.6;

        // 朝太阳方向的金色光带
        vec2 toPoint = normalize(vWorld.xz - cameraPosition.xz + vec2(0.0001));
        vec2 sunAz = normalize(sunDir.xz);
        float align = max(dot(toPoint, sunAz), 0.0);
        float band = pow(align, 20.0);
        float glit = band * (0.18 + 1.25 * fres) * (0.55 + 0.45 * sin(p.x * 0.62 + p.y * 0.93 + t * 2.1));
        col += sunColor * max(glit, 0.0) * 0.9;

        // 浪尖白沫
        float crest = smoothstep(0.62, 1.12, vHeight / max(vAmp, 0.001));
        float crestNoise = 0.6 + 0.4 * sin(p.x * 1.9 + p.y * 1.4 - t * 2.8);
        col = mix(col, vec3(0.98, 0.97, 0.94), clamp(crest * crestNoise, 0.0, 0.85) * 0.65);

        // 岸边碎浪
        float surf = exp(-distToShore * 0.19) * (0.55 + 0.45 * sin(distToShore * 2.6 - t * 2.3));
        col = mix(col, vec3(0.97, 0.96, 0.93), clamp(surf, 0.0, 1.0) * 0.8);

        // 远处融进地平线
        float d = distance(cameraPosition, vWorld);
        col = mix(col, horizonColor, smoothstep(230.0, 680.0, d) * 0.95);

        col = pow(max(col, 0.0), vec3(0.4545));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(-260, -1.0, -320);
  mesh.frustumCulled = false;

  return {
    mesh,
    update(dt) {
      uniforms.uTime.value += dt;
    },
  };
}
