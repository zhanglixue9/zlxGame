/** HUD 与覆盖层：只在数值变化时写 DOM */
export class HUD {
  constructor() {
    this.el = {
      score: document.getElementById('score'),
      best: document.getElementById('best'),
      energy: document.getElementById('energy'),
      bar: document.getElementById('bar'),
      speed: document.getElementById('speed'),
      camLabel: document.getElementById('cam-label'),
      overlay: document.getElementById('overlay'),
      title: document.getElementById('ov-title'),
      tag: document.getElementById('ov-tag'),
      stat: document.getElementById('ov-stat'),
      ovScore: document.getElementById('ov-score'),
      ovCoins: document.getElementById('ov-coins'),
      btn: document.getElementById('ov-btn'),
      tips: document.getElementById('ov-tips'),
      flash: document.getElementById('flash'),
      lines: document.getElementById('speedlines'),
      rotate: document.getElementById('rotate-hint'),
      toast: document.getElementById('toast'),
      hearts: document.getElementById('hearts'),
    };
    this.cache = { score: -1, best: -1, energy: -1, speed: -1, boost: null, health: -1 };
    this._flashTimer = 0;
  }

  onPrimary(fn) {
    this.el.btn.addEventListener('click', fn);
  }

  setScore(score, best) {
    if (score !== this.cache.score) {
      this.cache.score = score;
      this.el.score.textContent = score.toLocaleString('en-US');
    }
    if (best !== this.cache.best) {
      this.cache.best = best;
      this.el.best.textContent = best.toLocaleString('en-US');
    }
  }

  /** 三格血：满格实心，掉了变空心 */
  setHealth(hp, max = 3) {
    if (hp === this.cache.health) return;
    const prev = this.cache.health;
    this.cache.health = hp;
    const el = this.el.hearts;
    if (!el) return;
    if (el.children.length !== max) {
      el.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const s = document.createElement('span');
        s.className = 'heart';
        s.textContent = '♥';
        el.appendChild(s);
      }
    }
    for (let i = 0; i < max; i++) {
      const node = el.children[i];
      const on = i < hp;
      node.classList.toggle('empty', !on);
      node.textContent = on ? '♥' : '♡';
    }
    // 回血时让最后一格跳一下
    if (prev >= 0 && hp > prev) {
      const node = el.children[hp - 1];
      if (node) {
        node.classList.add('pop');
        setTimeout(() => node.classList.remove('pop'), 200);
      }
    }
  }

  setEnergy(v, boosting) {
    const pct = Math.round(v);
    if (pct !== this.cache.energy) {
      this.cache.energy = pct;
      this.el.energy.style.width = pct + '%';
      this.el.bar.classList.toggle('full', pct >= 99);
    }
    if (boosting !== this.cache.boost) {
      this.cache.boost = boosting;
      this.el.lines.classList.toggle('on', boosting);
    }
  }

  setSpeed(kmh) {
    const v = Math.round(kmh);
    if (v !== this.cache.speed) {
      this.cache.speed = v;
      this.el.speed.textContent = v;
    }
  }

  setCameraLabel(mode) {
    this.el.camLabel.textContent = mode === 0 ? '追尾' : '第一人称';
  }

  flashHit() {
    const el = this.el.flash;
    el.classList.add('on');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => el.classList.remove('on'), 90);
  }

  showMenu() {
    this.el.title.textContent = '鹈鹕骑行';
    this.el.tag.textContent = '沿海公路 · 3D 无限跑';
    this.el.stat.style.display = 'none';
    this.el.btn.textContent = '开始骑行';
    this.el.tips.style.display = '';
    this.el.overlay.classList.remove('hide');
  }

  showPause(score, coins) {
    this.el.title.textContent = '暂停中';
    this.el.tag.textContent = '喘口气，海岸线还在等你';
    this.el.ovScore.textContent = score.toLocaleString('en-US');
    this.el.ovCoins.textContent = coins;
    this.el.stat.style.display = 'flex';
    this.el.btn.textContent = '继续骑行';
    this.el.tips.style.display = 'none';
    this.el.overlay.classList.remove('hide');
  }

  showGameOver(score, coins, best) {
    this.el.title.textContent = '摔车了';
    this.el.tag.textContent = '海岸线还长，再来一趟';
    this.el.ovScore.textContent = score.toLocaleString('en-US');
    this.el.ovCoins.textContent = coins;
    this.el.stat.style.display = 'flex';
    this.el.btn.textContent = '再来一次';
    this.el.tips.style.display = 'none';
    this.el.overlay.classList.remove('hide');
  }

  hide() {
    this.el.overlay.classList.add('hide');
  }

  toast(text) {
    const el = this.el.toast;
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1300);
  }

  toggleRotateHint(on) {
    this.el.rotate.classList.toggle('show', on);
  }
}
