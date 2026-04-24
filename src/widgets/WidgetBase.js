/**
 * WidgetBase - Base class for all dashboard widgets (with drag + resize)
 */
export class WidgetBase {
  constructor(config = {}) {
    this.config = {
      title: config.title || 'Widget',
      icon: config.icon || 'W',
      x: config.x || 0,
      y: config.y || 0,
      w: config.w || 380,
      h: config.h || 260,
      ...config
    };
    this._el = null;
    this._body = null;
    this._destroyed = false;
    this._unsubscribe = null;
  }

  mount(container) {
    this._el = document.createElement('div');
    this._el.className = 'widget animate-fadeInUp';
    this._el.style.cssText = `
      left: ${this.config.x}px;
      top: ${this.config.y}px;
      width: ${this.config.w}px;
      height: ${this.config.h}px;
    `;
    this._el.innerHTML = `
      <div class="widget-header">
        <div class="widget-title">
          <span class="widget-title-icon">${this.config.icon}</span>
          <span>${this.config.title}</span>
        </div>
        <div class="widget-actions">
          <button class="widget-action-btn" data-action="refresh" title="Reset data">R</button>
          <button class="widget-action-btn" data-action="minimize" title="Minimize">-</button>
        </div>
      </div>
      <div class="widget-body"></div>
      <div class="widget-resize-handle" title="Drag to resize"></div>
    `;

    this._body = this._el.querySelector('.widget-body');
    this._el.querySelector('[data-action="refresh"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.reset();
    });
    this._el.querySelector('[data-action="minimize"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleMinimize();
    });

    this._render(this._body);
    container.appendChild(this._el);
    this._subscribe();
    this._setupDragResize();
    return this._el;
  }

  _toggleMinimize() {
    const body = this._el.querySelector('.widget-body');
    const minimized = body.style.display === 'none';
    body.style.display = minimized ? '' : 'none';
    this._el.style.height = minimized ? `${this.config.h}px` : 'auto';
    const btn = this._el.querySelector('[data-action="minimize"]');
    if (btn) btn.textContent = minimized ? '-' : '+';
  }

  _setupDragResize() {
    const header = this._el.querySelector('.widget-header');
    const resizeHandle = this._el.querySelector('.widget-resize-handle');
    const el = this._el;

    let dragStartX;
    let dragStartY;
    let elStartLeft;
    let elStartTop;

    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.classList.contains('widget-action-btn')) return;
      e.preventDefault();
      el.classList.add('dragging');
      el.style.zIndex = '50';
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      elStartLeft = parseInt(el.style.left, 10) || 0;
      elStartTop = parseInt(el.style.top, 10) || 0;

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - dragStartX;
        const dy = moveEvent.clientY - dragStartY;
        const newLeft = Math.max(0, elStartLeft + dx);
        const newTop = Math.max(0, elStartTop + dy);
        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
        const container = el.parentElement;
        if (container) {
          const minH = newTop + el.offsetHeight + 20;
          if ((parseInt(container.style.minHeight, 10) || 0) < minH) {
            container.style.minHeight = `${minH}px`;
          }
        }
      };

      const onUp = () => {
        el.classList.remove('dragging');
        el.style.zIndex = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    if (resizeHandle) {
      let resizeStartX;
      let resizeStartY;
      let resizeStartW;
      let resizeStartH;

      resizeHandle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('resizing');
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartW = el.offsetWidth;
        resizeStartH = el.offsetHeight;

        const onMove = (moveEvent) => {
          const newW = Math.max(240, resizeStartW + (moveEvent.clientX - resizeStartX));
          const newH = Math.max(180, resizeStartH + (moveEvent.clientY - resizeStartY));
          el.style.width = `${newW}px`;
          el.style.height = `${newH}px`;
          this.config.w = newW;
          this.config.h = newH;
          this._onResize?.();
        };

        const onUp = () => {
          el.classList.remove('resizing');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          this._onResize?.();
          const canvas = el.querySelector('canvas');
          if (canvas?.__chartjs) {
            canvas.__chartjs.resize();
          }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }
  }

  _render(body) {}

  _subscribe() {}

  _onResize() {}

  reset() {}

  destroy() {
    this._destroyed = true;
    if (this._unsubscribe) this._unsubscribe();
    if (this._el) this._el.remove();
  }
}
