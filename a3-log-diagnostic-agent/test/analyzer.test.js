'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { analyzeLogRoot } = require('../src/analyzer');
const { redact } = require('../src/redact');
const { validSn } = require('../src/collector');

test('finds synthetic RTK CRC, packet loss and navigation parse failures', async () => {
  const result = await analyzeLogRoot(path.join(__dirname, 'fixtures'));
  assert.equal(result.findings.find(x => x.id === 'rtk-crc').count, 1);
  assert.equal(result.findings.find(x => x.id === 'rtk-loss').count, 1);
  assert.equal(result.findings.find(x => x.id === 'nav-parse').count, 1);
});

test('redacts credentials before evidence is returned', () => {
  const output = redact('password=synthetic-value secretKey=00000000000000000000000000000000');
  assert.doesNotMatch(output, /synthetic-value|0000000000000000/);
  assert.match(output, /REDACTED/);
});

test('accepts safe SN only', () => {
  assert.equal(validSn('DEMO-A3-DEVICE-001'), true);
  assert.equal(validSn('x; unsafe command'), false);
});
