/**
 * LedWidget - threshold indicators for live datasets.
 */
import { WidgetBase } from './WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { getDatasetColor, formatValue } from '../utils/helpers.js';

export class LedWidget extends WidgetBase {
  constructor(config = {}) {
    super({ title: config.title || 'LED', icon: 'LED', ...config });
    this._datasets = config.datasets || [];
    this._items = [];
  }

  _thresholdFor(ds) {
    const threshold = Number(ds.ledHigh ?? ds.alarmHigh ?? ds.alarm ?? ds.max);
    return Number.isFinite(threshold) ? threshold : 0;
  }

  _render(body) {
    body.innerHTML = '<div class="led-grid"></div>';
    const grid = body.querySelector('.led-grid');
    this._datasets.forEach((ds, i) => {
      const color = getDatasetColor(i);
      const item = document.createElement('div');
      item.className = 'led-item';
      item.innerHTML = `
        <div class="led-indicator" style="color:${color};background:rgba(51,65,85,.35)"></div>
        <div class="led-name">${ds.title}</div>
        <div class="mono text-muted" style="font-size:var(--font-size-xs)">--</div>`;
      grid.appendChild(item);
      this._items.push({
        indicator: item.querySelector('.led-indicator'),
        value: item.querySelector('.mono'),
        color,
        ds
      });
    });
  }

  _subscribe() {
    this._unsubscribe = eventBus.on('frame:received', (frame) => {
      if (this._destroyed) return;
      this._items.forEach((item) => {
        const fds = frame.datasets?.[item.ds.index];
        if (!fds) return;
        const value = typeof fds.value === 'number' ? fds.value : Number.parseFloat(fds.value) || 0;
        const enabled = value >= this._thresholdFor(item.ds);
        item.indicator.classList.toggle('on', enabled);
        item.indicator.style.background = enabled ? item.color : 'rgba(51,65,85,.35)';
        item.value.textContent = formatValue(value) + (item.ds.units ? ` ${item.ds.units}` : '');
      });
    });
  }

  reset() {
    this._items.forEach((item) => {
      item.indicator.classList.remove('on');
      item.indicator.style.background = 'rgba(51,65,85,.35)';
      item.value.textContent = '--';
    });
  }
}
