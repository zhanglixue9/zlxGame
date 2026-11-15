import { clamp } from '../utils.js';

const STEER_SENS = 0.0062; // 每像素转向权重
const ORBIT_SENS = 0.0075; // 每像素旋转弧度

export class Input {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.keys = new Set();
    this.dragAxis = 0;
    this.pointers = new Map();
    this.mode = null; // 'steer' | 'orbit'
    this.lastPointerX = 0;
    this.lastPos = { x: 0, y: 0 };
    this.prevMid = { x: 0, y: 0 };
    this.prevDist = 0;
    this.pinchAccum = 0;
    this.touchBoost = false;
    this.jumpQueued = false;

    window.addEventListener('keydown', (e) => this.onKeyDown(e), { passive: false });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.hooks.onZoom?.(e.deltaY);
      },
      { passive: false }
    );

    // 触屏按钮
    const bindHold = (el, onDown, onUp) => {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDown();
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, onUp));
    };

    const boostBtn = document.getElementById('btn-boost');
    bindHold(
      boostBtn,
      () => {
        this.touchBoost = true;
        boostBtn.classList.add('on');
      },
      () => {
        this.touchBoost = false;
        boostBtn.classList.remove('on');
      }
    );

    const jumpBtn = document.getElementById('btn-jump');
    bindHold(
      jumpBtn,
      () => {
        this.jumpQueued = true;
        this.hooks.onJump?.();
        jumpBtn.classList.add('on');
      },
      () => jumpBtn.classList.remove('on')
    );

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    this.canvas.setPointerCapture?.(e.pointerId);

    if (this.pointers.size === 1) {
      this.mode = e.pointerType === 'mouse' ? 'orbit' : 'steer';
      this.lastPointerX = e.clientX;
      this.lastPos = { x: e.clientX, y: e.clientY };
      this.hooks.onOrbitStart?.();
    } else if (this.pointers.size === 2) {
      // 双指：旋转视角 + 捏合缩放
      this.mode = 'orbit';
      this.dragAxis = 0;
      const [a, b] = [...this.pointers.values()];
      this.prevMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.prevDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinchAccum = 0;
      this.hooks.onOrbitStart?.();
    }
  }

  onPointerMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    if (this.mode === 'orbit') {
      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        this.hooks.onOrbit?.((mid.x - this.prevMid.x) * 1.4, (mid.y - this.prevMid.y) * 1.4);
        if (this.prevDist > 0) this.pinchAccum += this.prevDist - dist;
        if (Math.abs(this.pinchAccum) > 6) {
          this.hooks.onZoom?.(this.pinchAccum * 2.4);
          this.pinchAccum = 0;
        }
        this.prevMid = mid;
        this.prevDist = dist;
      } else {
        const dx = e.clientX - this.lastPos.x;
        const dy = e.clientY - this.lastPos.y;
        this.lastPos = { x: e.clientX, y: e.clientY };
        this.hooks.onOrbit?.(dx * ORBIT_SENS, dy * ORBIT_SENS);
      }
    } else if (this.mode === 'steer') {
      const dx = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;
      this.dragAxis = clamp(this.dragAxis + dx * STEER_SENS, -1, 1);
    }
  }

  onPointerUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 1) {
      const p = [...this.pointers.values()][0];
      this.mode = p.type === 'mouse' ? 'orbit' : 'steer';
      this.lastPointerX = p.x;
      this.lastPos = { x: p.x, y: p.y };
    } else if (this.pointers.size === 0) {
      this.mode = null;
      this.hooks.onOrbitEnd?.();
    }
  }

  onKeyDown(e) {
    const code = e.code;
    if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight'].includes(code)
    ) {
      e.preventDefault();
    }
    if (code === 'Space') {
      this.jumpQueued = true;
      this.hooks.onJump?.();
      return;
    }
    if (code === 'KeyC') {
      this.hooks.onCamera?.();
      return;
    }
    if (code === 'KeyP' || code === 'Escape') {
      this.hooks.onPause?.();
      return;
    }
    if (code === 'KeyR') {
      this.hooks.onRestart?.();
      return;
    }
    if (code === 'KeyM') {
      this.hooks.onMute?.();
      return;
    }
    this.keys.add(code);
  }

  /** -1..1 的横向输入（键盘优先，其次单指拖动） */
  get steer() {
    let k = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) k -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) k += 1;
    if (k !== 0) return k;
    return this.mode === 'orbit' ? 0 : this.dragAxis;
  }

  get boostHeld() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchBoost;
  }

  consumeJump() {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  update(dt) {
    if (this.mode !== 'steer' && this.dragAxis !== 0) {
      const sign = Math.sign(this.dragAxis);
      this.dragAxis -= sign * Math.min(Math.abs(this.dragAxis), 7 * dt);
      if (Math.abs(this.dragAxis) < 0.001) this.dragAxis = 0;
    }
  }
}
