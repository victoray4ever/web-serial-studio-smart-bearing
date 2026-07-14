import { eventBus } from './EventBus.js';
import { outputManager } from './OutputManager.js';
import { sourceIdForDataset } from '../widgets/datasetSource.js';

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rms(values) {
  const nums = values.map(finiteNumber).filter((value) => value !== null);
  if (!nums.length) return NaN;
  return Math.sqrt(nums.reduce((sum, value) => sum + value * value, 0) / nums.length);
}

function calc(values, method) {
  const nums = values.map(finiteNumber).filter((value) => value !== null);
  if (!nums.length) return NaN;
  if (method === 'max') return Math.max(...nums);
  if (method === 'min') return Math.min(...nums);
  if (method === 'avg') return nums.reduce((sum, value) => sum + value, 0) / nums.length;
  return rms(nums);
}

export class InterlockManager {
  constructor(output = outputManager) {
    this._output = output;
    this._project = null;
    this._config = null;
    this._datasetDefs = [];
    this._ruleStates = new Map();
    this._latched = false;
    this._triggering = false;
    this._alarmActive = false;
    this._lastStatus = null;
    this._frameHandler = (frame) => this.handleFrame(frame);
    this._resetHandler = () => this.reset();
    eventBus.on('frame:received', this._frameHandler);
    eventBus.on('interlock:reset', this._resetHandler);
  }

  configure(project) {
    this._project = project || null;
    this._config = project?.interlock || null;
    this._datasetDefs = (project?.groups || []).flatMap((group) => group.datasets || []);
    this._ruleStates.clear();
    this._latched = false;
    this._triggering = false;
    this._alarmActive = false;
    this._output.configure(project?.outputs || []);
    this._emitStatus('normal');
  }

  reset() {
    const wasAlarm = this._latched || this._alarmActive;
    this._latched = false;
    this._triggering = false;
    this._ruleStates.forEach((state) => {
      state.confirmCount = 0;
      state.alarm = false;
    });
    this._alarmActive = false;
    if (wasAlarm) {
      this._emitAlarmRecord('reset', []);
      this._sendResetOutput('interlock-reset');
    }
    this._emitStatus('normal');
  }

  handleFrame(frame) {
    const config = this._config;
    if (!config?.enabled || !Array.isArray(config.rules) || !config.rules.length) return;
    const ruleResults = config.rules.map((rule, index) => this._evaluateRule(frame, rule, index));
    this._emitMetrics(ruleResults, frame);
    const activeRules = ruleResults.filter((result) => result.alarm);
    const shouldAlarm = config.mode === 'all'
      ? ruleResults.length > 0 && ruleResults.every((result) => result.alarm)
      : activeRules.length > 0;

    const effectiveAlarm = shouldAlarm || (this._latched && config.resetMode !== 'auto');
    if (effectiveAlarm) {
      this._latched = config.resetMode !== 'auto';
      const displayedRules = activeRules.length ? activeRules : ruleResults;
      this._emitStatus('alarm', displayedRules);
      if (!this._alarmActive) {
        this._alarmActive = true;
        this._emitAlarmRecord('alarm', displayedRules);
        this._triggerOutput(displayedRules);
      }
      return;
    }

    if (this._alarmActive) {
      this._emitAlarmRecord('recovered', ruleResults);
      this._sendResetOutput('interlock-recovered');
    }
    this._alarmActive = false;
    this._triggering = false;
    this._emitStatus('normal', ruleResults);
  }

  _evaluateRule(frame, rule, fallbackIndex) {
    const key = rule.id || rule.name || `${rule.sourceField || 'rule'}-${fallbackIndex}`;
    const state = this._ruleStates.get(key) || { buffer: [], confirmCount: 0, alarm: false };
    this._ruleStates.set(key, state);

    const datasetDef = this._datasetDefs.find((dataset) => {
      if (rule.sourceField && dataset.sourceField !== rule.sourceField) return false;
      if (rule.sourceId && String(sourceIdForDataset(dataset) || '') !== String(rule.sourceId)) return false;
      return true;
    });
    const datasetIndex = Number.isInteger(Number(rule.index)) ? Number(rule.index) : Number(datasetDef?.index);
    const received = Number.isInteger(datasetIndex) ? frame?.datasets?.[datasetIndex] : null;
    const actualSourceId = received?.sourceId ?? frame?.sourceId;
    if (rule.sourceId && actualSourceId !== undefined && String(actualSourceId) !== String(rule.sourceId)) {
      return this._statusForRule(rule, state, NaN, false);
    }

    const incoming = Array.isArray(received?.buffer)
      ? received.buffer
      : (received && received.value !== undefined ? [received.value] : []);
    const nums = incoming.map(finiteNumber).filter((value) => value !== null);
    if (nums.length) {
      state.buffer.push(...nums);
      const windowSize = Math.max(1, Number(rule.windowSize || this._config.windowSize) || 1024);
      if (state.buffer.length > windowSize) state.buffer.splice(0, state.buffer.length - windowSize);
    }

    const value = calc(state.buffer, rule.method || 'rms');
    const threshold = Number(rule.threshold);
    const exceeded = Number.isFinite(value) && Number.isFinite(threshold) && value >= threshold;
    const confirmWindows = Math.max(1, Number(rule.confirmWindows || this._config.confirmWindows) || 1);
    state.confirmCount = exceeded ? state.confirmCount + 1 : 0;
    state.alarm = state.confirmCount >= confirmWindows;
    state.value = value;
    return this._statusForRule(rule, state, value, state.alarm);
  }

  _statusForRule(rule, state, value, alarm) {
    return {
      name: rule.name || rule.sourceField || 'Interlock Rule',
      sourceField: rule.sourceField || '',
      method: rule.method || 'rms',
      threshold: Number(rule.threshold),
      value,
      confirmCount: state.confirmCount || 0,
      alarm: !!alarm,
      unit: rule.unit || ''
    };
  }

  _emitMetrics(rules, frame) {
    eventBus.emit('interlock:metrics', {
      timestamp: frame?.timestamp || Date.now(),
      sourceId: 'interlock',
      title: '联锁实时计算',
      datasets: rules.map((rule, index) => ({
        index,
        title: rule.name,
        value: rule.value,
        buffer: Number.isFinite(rule.value) ? [rule.value] : [],
        units: rule.unit,
        alarm: rule.alarm,
        threshold: rule.threshold,
        sourceId: 'interlock'
      }))
    });
  }

  _emitAlarmRecord(type, rules) {
    eventBus.emit('interlock:alarm-record', {
      type,
      timestamp: Date.now(),
      rules: (rules || []).map((rule) => ({ ...rule }))
    });
  }

  async _triggerOutput(activeRules) {
    if (this._triggering) return;
    const outputId = this._config?.onAlarm?.outputId || this._config?.outputId || '';
    if (!outputId) return;
    this._triggering = true;
    try {
      await this._output.send(outputId, {
        reason: 'interlock-alarm',
        activeRules,
        timestamp: Date.now()
      });
    } catch (error) {
      eventBus.emit('toast', { type: 'error', message: `PLC 输出失败：${error.message || error}` });
    }
  }

  async _sendResetOutput(reason) {
    const outputId = this._config?.onAlarm?.outputId || this._config?.outputId || '';
    if (!outputId) return;
    try {
      await this._output.send(outputId, { reason, timestamp: Date.now() });
    } catch (error) {
      eventBus.emit('toast', { type: 'error', message: `PLC 复位输出失败：${error.message || error}` });
    }
  }

  _emitStatus(state, rules = []) {
    const payload = {
      enabled: !!this._config?.enabled,
      state,
      latched: this._latched,
      rules,
      timestamp: Date.now()
    };
    this._lastStatus = payload;
    eventBus.emit('interlock:status', payload);
  }
}
