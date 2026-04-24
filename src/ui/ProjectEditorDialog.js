import { eventBus } from '../core/EventBus.js';
import { appState } from '../core/AppState.js';
import { defaultProject } from '../core/ProjectModel.js';
import { t } from '../core/i18n.js?v=csv-autosave-20260424-1';

function cloneProject(project) {
  if (typeof structuredClone === 'function') return structuredClone(project);
  return JSON.parse(JSON.stringify(project));
}

function getLabels(locale) {
  if (locale === 'zh-CN') {
    return {
      title: '项目编辑器',
      addGroup: '添加分组',
      addDataset: '添加数据集',
      removeSelection: '删除当前项',
      loadDefault: '载入默认项目',
      apply: '应用到仪表盘',
      projectNode: '项目',
      groups: '分组',
      projectSettings: '项目设置',
      groupSettings: '分组设置',
      datasetSettings: '数据集设置',
      titleField: '标题',
      protocol: '协议',
      separator: '分隔符',
      frameStart: '帧起始',
      frameEnd: '帧结束',
      frameDetection: '帧检测',
      widget: '控件',
      index: '索引',
      units: '单位',
      min: '最小值',
      max: '最大值',
      alarm: '报警值',
      features: '启用功能',
      plot: '曲线',
      bar: '柱状图',
      gauge: '仪表',
      led: 'LED',
      fft: 'FFT',
      compass: '罗盘',
      selectionHint: '左侧选择项目、分组或数据集后即可编辑属性。',
      noGroupHint: '当前还没有分组，先添加一个分组。',
      noDatasetHint: '当前分组还没有数据集，可以先添加一个。',
      projectApplied: '项目编辑器内容已应用到仪表盘',
      invalidProject: '项目结构无效，无法应用',
      confirmDeleteGroup: '删除这个分组以及其下所有数据集？',
      confirmDeleteDataset: '删除这个数据集？'
    };
  }

  return {
    title: 'Project Editor',
    addGroup: 'Add Group',
    addDataset: 'Add Dataset',
    removeSelection: 'Delete Selection',
    loadDefault: 'Load Default',
    apply: 'Apply to Dashboard',
    projectNode: 'Project',
    groups: 'Groups',
    projectSettings: 'Project Settings',
    groupSettings: 'Group Settings',
    datasetSettings: 'Dataset Settings',
    titleField: 'Title',
    protocol: 'Protocol',
    separator: 'Separator',
    frameStart: 'Frame Start',
    frameEnd: 'Frame End',
    frameDetection: 'Frame Detection',
    widget: 'Widget',
    index: 'Index',
    units: 'Units',
    min: 'Min',
    max: 'Max',
    alarm: 'Alarm',
    features: 'Features',
    plot: 'Plot',
    bar: 'Bar',
    gauge: 'Gauge',
    led: 'LED',
    fft: 'FFT',
    compass: 'Compass',
    selectionHint: 'Select the project, a group, or a dataset on the left to edit its properties.',
    noGroupHint: 'No groups yet. Add a group to start building the project.',
    noDatasetHint: 'This group has no datasets yet. Add one to continue.',
    projectApplied: 'Project editor changes applied to the dashboard',
    invalidProject: 'The project structure is invalid and could not be applied',
    confirmDeleteGroup: 'Delete this group and all of its datasets?',
    confirmDeleteDataset: 'Delete this dataset?'
  };
}

const GROUP_WIDGETS = ['DataGrid', 'MultiPlot', 'Plot', 'Bar', 'Gauge', 'Gauges', 'Compass', 'Accelerometer'];
const DATASET_WIDGETS = ['Bar', 'Gauge', 'Plot', 'Compass', 'DataGrid'];
const FRAME_DETECTIONS = ['EndDelimiterOnly', 'StartAndEndDelimiter', 'NoDelimiters'];

export class ProjectEditorDialog {
  constructor(modalRoot, projectModel, options = {}) {
    this._root = modalRoot;
    this._projectModel = projectModel;
    this._onApply = options.onApply || (() => {});
    this._el = null;
    this._draft = null;
    this._selected = { type: 'project' };
    this._onKeyDown = null;

    eventBus.on('ui:openEditor', () => this.open());
  }

  open() {
    if (this._el) this.close();

    this._draft = cloneProject(this._projectModel.project || defaultProject());
    if (!Array.isArray(this._draft.groups)) this._draft.groups = [];
    this._selected = { type: 'project' };

    this._el = document.createElement('div');
    this._el.className = 'modal-overlay animate-fadeIn';
    this._el.innerHTML = `
      <div class="modal" style="max-width:1040px">
        <div class="modal-header">
          <div class="modal-title">${this._labels.title}</div>
          <button class="btn btn-icon" id="project-editor-close" style="font-size:18px">X</button>
        </div>
        <div class="modal-body" id="project-editor-body">${this._renderBody()}</div>
        <div class="modal-footer">
          <button class="btn" id="project-editor-default">${this._labels.loadDefault}</button>
          <button class="btn" id="project-editor-cancel">${t('common.close')}</button>
          <button class="btn btn-primary" id="project-editor-apply">${this._labels.apply}</button>
        </div>
      </div>`;

    this._root.appendChild(this._el);
    this._bindStaticEvents();
    this._bindBodyEvents();
  }

  close() {
    if (this._onKeyDown) {
      document.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    if (!this._el) return;
    this._el.remove();
    this._el = null;
  }

  get _labels() {
    return getLabels(appState.locale);
  }

  _bindStaticEvents() {
    this._el.addEventListener('click', (e) => {
      if (e.target === this._el) this.close();
    });

    this._el.querySelector('#project-editor-close')?.addEventListener('click', () => this.close());
    this._el.querySelector('#project-editor-cancel')?.addEventListener('click', () => this.close());
    this._el.querySelector('#project-editor-default')?.addEventListener('click', () => {
      this._draft = cloneProject(defaultProject());
      this._selected = { type: 'project' };
      this._refreshBody();
    });
    this._el.querySelector('#project-editor-apply')?.addEventListener('click', () => {
      try {
        this._onApply(cloneProject(this._draft));
        this.close();
        eventBus.emit('toast', { type: 'success', message: this._labels.projectApplied });
      } catch (error) {
        eventBus.emit('toast', { type: 'error', message: error?.message || this._labels.invalidProject });
      }
    });

    this._onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    };

    document.addEventListener('keydown', this._onKeyDown);
  }

  _refreshBody() {
    const body = this._el?.querySelector('#project-editor-body');
    if (!body) return;
    body.innerHTML = this._renderBody();
    this._bindBodyEvents();
  }

  _bindBodyEvents() {
    this._el?.querySelectorAll('[data-editor-select]').forEach((node) => {
      node.addEventListener('click', () => {
        this._selected = {
          type: node.dataset.type,
          groupIndex: node.dataset.groupIndex !== undefined ? parseInt(node.dataset.groupIndex, 10) : undefined,
          datasetIndex: node.dataset.datasetIndex !== undefined ? parseInt(node.dataset.datasetIndex, 10) : undefined
        };
        this._refreshBody();
      });
    });

    this._el?.querySelector('#project-editor-add-group')?.addEventListener('click', () => {
      this._draft.groups.push({
        title: `Group ${this._draft.groups.length + 1}`,
        widget: 'DataGrid',
        datasets: []
      });
      this._selected = { type: 'group', groupIndex: this._draft.groups.length - 1 };
      this._refreshBody();
    });

    this._el?.querySelector('#project-editor-add-dataset')?.addEventListener('click', () => {
      if (!this._draft.groups.length) {
        this._draft.groups.push({ title: 'Group 1', widget: 'DataGrid', datasets: [] });
      }

      const groupIndex = this._resolveGroupIndex();
      const group = this._draft.groups[groupIndex];
      if (!Array.isArray(group.datasets)) group.datasets = [];

      group.datasets.push({
        title: `Dataset ${group.datasets.length + 1}`,
        index: group.datasets.length,
        units: '',
        widget: 'Bar',
        min: 0,
        max: 100,
        alarm: 0,
        led: false,
        fft: false,
        plot: true,
        bar: true,
        gauge: false,
        compass: false
      });

      this._selected = {
        type: 'dataset',
        groupIndex,
        datasetIndex: group.datasets.length - 1
      };
      this._refreshBody();
    });

    this._el?.querySelector('#project-editor-remove')?.addEventListener('click', () => {
      if (this._selected.type === 'group') {
        if (!window.confirm(this._labels.confirmDeleteGroup)) return;
        this._draft.groups.splice(this._selected.groupIndex, 1);
        this._selected = { type: 'project' };
        this._refreshBody();
        return;
      }

      if (this._selected.type === 'dataset') {
        if (!window.confirm(this._labels.confirmDeleteDataset)) return;
        const group = this._draft.groups[this._selected.groupIndex];
        group?.datasets?.splice(this._selected.datasetIndex, 1);
        this._reindexDatasets(group);
        this._selected = { type: 'group', groupIndex: this._selected.groupIndex };
        this._refreshBody();
      }
    });

    this._bindFormFields();
  }

  _bindFormFields() {
    const target = this._getSelectedTarget();
    if (!target) return;

    this._el?.querySelectorAll('[data-field]').forEach((fieldEl) => {
      const syncValue = () => {
        const field = fieldEl.dataset.field;
        const kind = fieldEl.dataset.kind || 'string';
        let value;

        if (kind === 'boolean') {
          value = !!fieldEl.checked;
        } else if (kind === 'number') {
          value = Number(fieldEl.value);
          if (Number.isNaN(value)) value = 0;
        } else {
          value = fieldEl.value;
        }

        target[field] = value;

        if (this._selected.type === 'dataset' && ['min', 'max', 'alarm', 'index'].includes(field)) {
          target[field] = Number.isFinite(target[field]) ? target[field] : 0;
        }
      };

      const rerenderIfNeeded = () => {
        if (fieldEl.dataset.refresh === 'true') this._refreshBody();
      };

      const eventName = fieldEl.type === 'checkbox' || fieldEl.tagName === 'SELECT' ? 'change' : 'input';
      fieldEl.addEventListener(eventName, syncValue);
      if (eventName !== 'change') fieldEl.addEventListener('change', () => {
        syncValue();
        rerenderIfNeeded();
      });
      if (eventName === 'change') fieldEl.addEventListener('change', rerenderIfNeeded);
    });
  }

  _resolveGroupIndex() {
    if (this._selected.type === 'group' || this._selected.type === 'dataset') {
      const groupIndex = Number(this._selected.groupIndex);
      if (Number.isInteger(groupIndex) && this._draft.groups[groupIndex]) return groupIndex;
    }
    return 0;
  }

  _getSelectedTarget() {
    if (this._selected.type === 'project') return this._draft;
    if (this._selected.type === 'group') return this._draft.groups[this._selected.groupIndex] || null;
    if (this._selected.type === 'dataset') {
      return this._draft.groups[this._selected.groupIndex]?.datasets?.[this._selected.datasetIndex] || null;
    }
    return null;
  }

  _reindexDatasets(group) {
    if (!group?.datasets) return;
    group.datasets.forEach((dataset, index) => {
      if (!Number.isInteger(dataset.index) || dataset.index < 0 || dataset.index >= group.datasets.length) {
        dataset.index = index;
      }
    });
  }

  _renderBody() {
    return `
      <div class="editor-layout">
        <div style="width:260px;display:flex;flex-direction:column;gap:10px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button class="btn" id="project-editor-add-group">${this._labels.addGroup}</button>
            <button class="btn" id="project-editor-add-dataset">${this._labels.addDataset}</button>
          </div>
          <button class="btn" id="project-editor-remove" ${this._selected.type === 'project' ? 'disabled' : ''}>${this._labels.removeSelection}</button>
          <div class="editor-tree">
            ${this._renderTree()}
          </div>
        </div>
        <div class="editor-form">
          ${this._renderForm()}
        </div>
      </div>`;
  }

  _renderTree() {
    const items = [
      `<div class="editor-tree-item group ${this._selected.type === 'project' ? 'active' : ''}" data-editor-select="true" data-type="project">
        <span class="editor-tree-icon">#</span>
        <span>${this._escape(this._draft.title || this._labels.projectNode)}</span>
      </div>`
    ];

    if (!this._draft.groups.length) {
      items.push(`<div class="editor-tree-item" style="cursor:default;color:var(--text-muted)">${this._labels.noGroupHint}</div>`);
    }

    this._draft.groups.forEach((group, groupIndex) => {
      items.push(`
        <div class="editor-tree-item group ${this._isSelected('group', groupIndex) ? 'active' : ''}" data-editor-select="true" data-type="group" data-group-index="${groupIndex}">
          <span class="editor-tree-icon">G</span>
          <span>${this._escape(group.title || `${this._labels.groups} ${groupIndex + 1}`)}</span>
        </div>`);

      if (!group.datasets?.length) {
        items.push(`<div class="editor-tree-item dataset" style="cursor:default;color:var(--text-muted)">${this._labels.noDatasetHint}</div>`);
      }

      group.datasets?.forEach((dataset, datasetIndex) => {
        items.push(`
          <div class="editor-tree-item dataset ${this._isSelected('dataset', groupIndex, datasetIndex) ? 'active' : ''}" data-editor-select="true" data-type="dataset" data-group-index="${groupIndex}" data-dataset-index="${datasetIndex}">
            <span class="editor-tree-icon">D</span>
            <span>${this._escape(dataset.title || `Dataset ${datasetIndex + 1}`)}</span>
          </div>`);
      });
    });

    return items.join('');
  }

  _renderForm() {
    const selected = this._getSelectedTarget();
    if (!selected) {
      return `<div style="color:var(--text-muted);line-height:1.6">${this._labels.selectionHint}</div>`;
    }

    if (this._selected.type === 'project') {
      return `
        <div class="editor-form-section">
          <div class="editor-form-section-title">${this._labels.projectSettings}</div>
          <div class="editor-form-grid">
            ${this._renderTextField(this._labels.titleField, 'title', selected.title || '', true)}
            ${this._renderTextField(this._labels.protocol, 'protocol', selected.protocol || '')}
            ${this._renderTextField(this._labels.separator, 'separator', selected.separator || ',')}
            ${this._renderSelectField(this._labels.frameDetection, 'frameDetection', selected.frameDetection || 'EndDelimiterOnly', FRAME_DETECTIONS)}
            ${this._renderTextField(this._labels.frameStart, 'frameStart', selected.frameStart || '')}
            ${this._renderTextField(this._labels.frameEnd, 'frameEnd', selected.frameEnd || '\\n')}
          </div>
        </div>`;
    }

    if (this._selected.type === 'group') {
      return `
        <div class="editor-form-section">
          <div class="editor-form-section-title">${this._labels.groupSettings}</div>
          <div class="editor-form-grid">
            ${this._renderTextField(this._labels.titleField, 'title', selected.title || '', true)}
            ${this._renderSelectField(this._labels.widget, 'widget', selected.widget || 'DataGrid', GROUP_WIDGETS)}
          </div>
        </div>`;
    }

    return `
      <div class="editor-form-section">
        <div class="editor-form-section-title">${this._labels.datasetSettings}</div>
        <div class="editor-form-grid">
          ${this._renderTextField(this._labels.titleField, 'title', selected.title || '', true)}
          ${this._renderNumberField(this._labels.index, 'index', selected.index ?? 0)}
          ${this._renderTextField(this._labels.units, 'units', selected.units || '')}
          ${this._renderSelectField(this._labels.widget, 'widget', selected.widget || 'Bar', DATASET_WIDGETS)}
          ${this._renderNumberField(this._labels.min, 'min', selected.min ?? 0)}
          ${this._renderNumberField(this._labels.max, 'max', selected.max ?? 100)}
          ${this._renderNumberField(this._labels.alarm, 'alarm', selected.alarm ?? 0)}
        </div>
      </div>
      <div class="editor-form-section">
        <div class="editor-form-section-title">${this._labels.features}</div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:10px">
          ${this._renderCheckboxField(this._labels.plot, 'plot', !!selected.plot)}
          ${this._renderCheckboxField(this._labels.bar, 'bar', !!selected.bar)}
          ${this._renderCheckboxField(this._labels.gauge, 'gauge', !!selected.gauge)}
          ${this._renderCheckboxField(this._labels.led, 'led', !!selected.led)}
          ${this._renderCheckboxField(this._labels.fft, 'fft', !!selected.fft)}
          ${this._renderCheckboxField(this._labels.compass, 'compass', !!selected.compass)}
        </div>
      </div>`;
  }

  _renderTextField(label, field, value, refresh = false) {
    return `
      <div class="form-row">
        <div class="form-label">${label}</div>
        <input class="form-input" data-field="${field}" data-kind="string" ${refresh ? 'data-refresh="true"' : ''} value="${this._escapeAttr(value)}">
      </div>`;
  }

  _renderNumberField(label, field, value) {
    return `
      <div class="form-row">
        <div class="form-label">${label}</div>
        <input class="form-input" type="number" data-field="${field}" data-kind="number" value="${Number(value) || 0}">
      </div>`;
  }

  _renderSelectField(label, field, value, options) {
    return `
      <div class="form-row">
        <div class="form-label">${label}</div>
        <select class="form-select" data-field="${field}" data-kind="string">
          ${options.map((option) => `<option value="${this._escapeAttr(option)}" ${option === value ? 'selected' : ''}>${this._escape(option)}</option>`).join('')}
        </select>
      </div>`;
  }

  _renderCheckboxField(label, field, checked) {
    return `
      <label class="checkbox-wrap" style="margin:0">
        <input type="checkbox" data-field="${field}" data-kind="boolean" ${checked ? 'checked' : ''}>
        <span>${label}</span>
      </label>`;
  }

  _isSelected(type, groupIndex, datasetIndex) {
    if (this._selected.type !== type) return false;
    if (type === 'group') return this._selected.groupIndex === groupIndex;
    if (type === 'dataset') {
      return this._selected.groupIndex === groupIndex && this._selected.datasetIndex === datasetIndex;
    }
    return true;
  }

  _escape(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  _escapeAttr(value) {
    return this._escape(value).replaceAll('\n', '&#10;');
  }
}
