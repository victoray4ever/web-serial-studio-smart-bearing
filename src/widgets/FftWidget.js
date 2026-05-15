/**
 * FftWidget - lightweight frequency magnitude view for recent samples.
 */
import { WidgetBase } from './WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { getDatasetColor } from '../utils/helpers.js';

export class FftWidget extends WidgetBase {
  constructor(config = {}) {
    super({ title: config.title || 'FFT', icon: 'FFT', ...config });
    this._datasets = config.datasets || [];
    this._histories = this._datasets.map(() => []);
    this._spectra = this._datasets.map(() => []);
    this._canvas = null;
    this._ctx = null;
    this._raf = null;
  }

  _render(body) {
    body.style.padding = '8px';
    this._canvas = document.createElement('canvas');
    this._canvas.style.width = '100%';
    this._canvas.style.height = '100%';
    body.appendChild(this._canvas);
    this._resizeCanvas();
    this._draw();
  }

  _subscribe() {
    this._unsubscribe = eventBus.on('frame:received', (frame) => {
      if (this._destroyed) return;
      this._datasets.forEach((ds, i) => {
        const fds = frame.datasets?.[ds.index];
        if (!fds) return;
        let samples = [];
        if (Array.isArray(fds.buffer) && fds.buffer.length) {
          samples = fds.buffer.map(Number).filter(Number.isFinite);
        } else {
          const value = typeof fds.value === 'number' ? fds.value : Number.parseFloat(fds.value);
          if (Number.isFinite(value)) {
            this._histories[i].push(value);
            if (this._histories[i].length > 128) this._histories[i].splice(0, this._histories[i].length - 128);
            samples = this._histories[i];
          }
        }
        this._spectra[i] = this._computeSpectrum(samples.slice(-128));
      });
      this._scheduleDraw();
    });
  }

  _computeSpectrum(samples) {
    const n = samples.length;
    if (n < 4) return [];
    const mean = samples.reduce((sum, value) => sum + value, 0) / n;
    const centered = samples.map((value) => value - mean);
    const bins = Math.min(Math.floor(n / 2), 48);
    const result = [];
    for (let k = 1; k <= bins; k += 1) {
      let real = 0;
      let imag = 0;
      for (let t = 0; t < n; t += 1) {
        const angle = (2 * Math.PI * k * t) / n;
        real += centered[t] * Math.cos(angle);
        imag -= centered[t] * Math.sin(angle);
      }
      result.push(Math.sqrt(real * real + imag * imag) / n);
    }
    return result;
  }

  _scheduleDraw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      this._draw();
    });
  }

  _resizeCanvas() {
    if (!this._canvas) return;
    const rect = this._canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (this._canvas.width !== width || this._canvas.height !== height) {
      this._canvas.width = width;
      this._canvas.height = height;
    }
    this._ctx = this._canvas.getContext('2d');
  }

  _draw() {
    this._resizeCanvas();
    const ctx = this._ctx;
    const canvas = this._canvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const all = this._spectra.flat();
    const max = Math.max(...all.filter(Number.isFinite), 0.000001);
    const laneHeight = h / Math.max(1, this._datasets.length);

    this._spectra.forEach((spectrum, i) => {
      const top = laneHeight * i;
      const color = getDatasetColor(i);
      ctx.fillStyle = 'rgba(148,163,184,0.08)';
      ctx.fillRect(0, top + laneHeight - 1, w, 1);
      ctx.fillStyle = color;
      const count = Math.max(1, spectrum.length);
      const gap = 2;
      const barW = Math.max(1, (w - gap * (count - 1)) / count);
      spectrum.forEach((value, bin) => {
        const barH = Math.max(1, (value / max) * (laneHeight - 22));
        const x = bin * (barW + gap);
        const y = top + laneHeight - barH - 8;
        ctx.fillRect(x, y, barW, barH);
      });
      ctx.fillStyle = 'rgba(203,213,225,.9)';
      ctx.font = `${12 * (window.devicePixelRatio || 1)}px sans-serif`;
      ctx.fillText(this._datasets[i]?.title || `Ch ${i + 1}`, 8, top + 16);
    });
  }

  _onResize() {
    this._draw();
  }

  reset() {
    this._histories = this._datasets.map(() => []);
    this._spectra = this._datasets.map(() => []);
    this._draw();
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    super.destroy();
  }
}
