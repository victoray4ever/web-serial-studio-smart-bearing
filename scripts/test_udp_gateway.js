const assert = require('assert');
const { FrameReassembler, mergeFrameDefinition } = require('../electron/udpGateway');

function frame(length, marker = 0) {
  assert(length >= 5);
  const bytes = Buffer.alloc(length, marker);
  bytes[0] = 0x5A;
  bytes[1] = 0xA5;
  bytes[length - 2] = 0xDD;
  bytes[length - 1] = 0xEE;
  return bytes;
}

function feedChunks(reassembler, input, chunkSizes) {
  const output = [];
  let offset = 0;
  let now = 1000;
  for (const chunkSize of chunkSizes) {
    if (offset >= input.length) break;
    const end = Math.min(input.length, offset + chunkSize);
    output.push(...reassembler.feed(input.subarray(offset, end), now).frames);
    offset = end;
    now += 10;
  }
  if (offset < input.length) {
    output.push(...reassembler.feed(input.subarray(offset), now).frames);
  }
  return output;
}

const defaults = {
  startDelimiter: '5A A5',
  endDelimiter: 'DD EE',
  frameLength: 5732,
  timeoutMs: 2000,
  maxBufferBytes: 65536
};

const shortDefinition = mergeFrameDefinition(defaults, { frameLength: 1468 });
const longDefinition = mergeFrameDefinition(defaults, { frameLength: 5732 });
assert.strictEqual(shortDefinition.frameLength, 1468);
assert.strictEqual(longDefinition.frameLength, 5732);

const shortFrame = frame(1468, 0x11);
const longFrame = frame(5732, 0x22);
const shortFrames = feedChunks(new FrameReassembler(shortDefinition), shortFrame, [7, 113, 509]);
const longFrames = feedChunks(new FrameReassembler(longDefinition), longFrame, [3, 2048, 1024]);

assert.strictEqual(shortFrames.length, 1);
assert.strictEqual(shortFrames[0].length, 1468);
assert.deepStrictEqual(shortFrames[0], shortFrame);
assert.strictEqual(longFrames.length, 1);
assert.strictEqual(longFrames[0].length, 5732);
assert.deepStrictEqual(longFrames[0], longFrame);

const delimiterDefinition = mergeFrameDefinition(defaults, { frameLength: 0 });
const variableReassembler = new FrameReassembler(delimiterDefinition);
const variableFrames = variableReassembler.feed(Buffer.concat([frame(32, 0x33), frame(47, 0x44)]), 2000).frames;
assert.deepStrictEqual(variableFrames.map((item) => item.length), [32, 47]);

console.log('UDP gateway framing tests passed: 1468-byte, 5732-byte, and delimiter-length frames.');
