import { eventBus } from './EventBus.js';

function hexToBytes(hexText) {
  const clean = String(hexText || '').replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
  const out = [];
  if (clean.length < 2 || clean.length % 2 !== 0) return out;
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

export class OutputManager {
  constructor() {
    this._outputs = [];
  }

  configure(outputs = []) {
    this._outputs = Array.isArray(outputs) ? outputs : [];
  }

  _emitStatus(status, output, details = {}) {
    eventBus.emit('plc:status', {
      status,
      outputId: output?.id || '',
      name: output?.name || output?.id || 'PLC',
      type: output?.type || '',
      host: output?.host || '',
      port: Number(output?.port) || (output?.type === 'modbusTcp' ? 502 : 0),
      unitId: Number(output?.unitId) || 1,
      timestamp: Date.now(),
      ...details
    });
  }

  getOutput(id) {
    return this._outputs.find((output) => String(output.id || '') === String(id || '')) || null;
  }

  async send(outputId, context = {}) {
    const output = this.getOutput(outputId);
    if (!output) throw new Error(`Output not found: ${outputId || '(empty)'}`);

    const type = String(output.type || 'none');
    const commandHex = output.commandHex || '';
    const bytes = hexToBytes(commandHex);
    const payloadBase64 = btoa(String.fromCharCode(...bytes));

    if (type === 'none') {
      eventBus.emit('toast', { type: 'warning', message: '联锁已触发，但输出方式为 none，未发送 PLC 命令' });
      return { ok: true, skipped: true };
    }

    if (!window.memsCmsDesktop?.plc?.send) {
      throw new Error('PLC output is available only in the Electron app.');
    }

    this._emitStatus('connecting', output, { action: context.reason || 'write' });
    try {
      const result = await window.memsCmsDesktop.plc.send({
        ...output,
        payloadBase64,
        context
      });
      this._emitStatus('online', output, {
        action: context.reason || 'write',
        operation: result.operation || type,
        address: result.address,
        value: result.value,
        message: 'PLC 通信成功'
      });
      eventBus.emit('plc:outputSent', { output, result, context });
      return result;
    } catch (error) {
      this._emitStatus('error', output, { action: context.reason || 'write', message: error.message || String(error) });
      throw error;
    }
  }

  async test(outputOrId) {
    const output = typeof outputOrId === 'string' ? this.getOutput(outputOrId) : outputOrId;
    if (!output) throw new Error('PLC output configuration not found.');
    if (!window.memsCmsDesktop?.plc?.test) throw new Error('PLC connection test is available only in the Electron app.');
    this._emitStatus('testing', output, { action: 'test' });
    try {
      const result = await window.memsCmsDesktop.plc.test(output);
      this._emitStatus('online', output, {
        action: 'test', operation: result.operation, address: result.address,
        value: result.value, message: 'Modbus 只读测试成功'
      });
      return result;
    } catch (error) {
      this._emitStatus('error', output, { action: 'test', message: error.message || String(error) });
      throw error;
    }
  }
}

export const outputManager = new OutputManager();
