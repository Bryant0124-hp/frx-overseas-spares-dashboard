#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveLogs, validSn } = require('./src/collector');
const { analyzeLogRoot } = require('./src/analyzer');

async function main() {
  const sn = String(process.argv[2] || '').trim().toUpperCase();
  if (!validSn(sn)) throw new Error('用法：node cli.js <SN> [日志目录] [输出文件]');
  const root = process.argv[3] ? path.resolve(process.argv[3]) : await resolveLogs(sn, event => console.error(event.message));
  const result = await analyzeLogRoot(root, { onProgress: event => console.error(event.message) });
  const output = path.resolve(process.argv[4] || `reports/${sn}-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ sn, model: sn.includes('FR4000') ? 'FR4000' : 'A3 Device', ...result }, null, 2));
  console.log(output);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

