'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');
const { RULES } = require('./rules');
const { redact } = require('./redact');

const TEXT_FILE = /(?:\.log(?:\.\d+)?|\.txt|\.jsonl?|messages|syslog|dmesg)(?:\.gz)?$/i;
const PRE_FILTER = /crc|checksum|frame-info|sdio|CFG80211|WEXT|CFGP2P|ecounters|json\.exception|STRtkPathWorkReport|serial|uart|tty|bus[- ]off|motor|电机|overheat|thermal|temperature|out of memory|oom-killer|killed process|EXT4-fs|I\/O error|filesystem/i;

async function listFiles(root) {
  const result = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try { entries = await fs.promises.readdir(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && TEXT_FILE.test(entry.name)) result.push(full);
    }
  }
  return result;
}

function timestamp(line) {
  return line.match(/\[(\d{4}-\d{2}-\d{2}[T ][^\]]+)\]/)?.[1]
    || line.match(/\b(\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+)/)?.[1] || '';
}

function inputFor(file) {
  const stream = fs.createReadStream(file);
  return file.toLowerCase().endsWith('.gz') ? stream.pipe(zlib.createGunzip()) : stream;
}

async function analyzeLogRoot(root, options = {}) {
  const onProgress = options.onProgress || (() => {});
  const files = await listFiles(root);
  const findings = new Map(RULES.map(rule => [rule.id, { ...rule, count: 0, files: new Map(), samples: [], firstSeen: '', lastSeen: '' }]));
  let lines = 0;
  let bytes = 0;
  let processed = 0;

  for (const file of files) {
    let stat;
    try { stat = await fs.promises.stat(file); bytes += stat.size; } catch { continue; }
    const relative = path.relative(root, file).replaceAll('\\', '/');
    let reader;
    try {
      reader = readline.createInterface({ input: inputFor(file), crlfDelay: Infinity });
      for await (const rawLine of reader) {
        lines += 1;
        if (!PRE_FILTER.test(rawLine)) continue;
        for (const rule of RULES) {
          if (!rule.pattern.test(rawLine) || (rule.exclude && rule.exclude.test(rawLine))) continue;
          const finding = findings.get(rule.id);
          finding.count += 1;
          finding.files.set(relative, (finding.files.get(relative) || 0) + 1);
          const time = timestamp(rawLine);
          if (time && (!finding.firstSeen || time < finding.firstSeen)) finding.firstSeen = time;
          if (time && (!finding.lastSeen || time > finding.lastSeen)) finding.lastSeen = time;
          if (finding.samples.length < 4) finding.samples.push({ file: relative, time, text: redact(rawLine) });
        }
      }
    } catch (error) {
      // Broken/rotating logs should not stop analysis of the remaining evidence.
    } finally {
      reader?.close();
    }
    processed += 1;
    if (processed % 5 === 0 || processed === files.length) {
      onProgress({ phase: 'analyzing', progress: files.length ? Math.round(processed / files.length * 100) : 100, message: `已分析 ${processed}/${files.length} 个日志文件` });
    }
  }

  const active = [...findings.values()].filter(item => item.count > 0).map(item => ({
    id: item.id,
    category: item.category,
    severity: item.severity,
    title: item.title,
    count: item.count,
    score: item.weight,
    impact: item.impact,
    cause: item.cause,
    actions: item.actions,
    firstSeen: item.firstSeen,
    lastSeen: item.lastSeen,
    files: [...item.files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
    samples: item.samples
  })).sort((a, b) => {
    const rank = { critical: 4, high: 3, medium: 2, low: 1 };
    return rank[b.severity] - rank[a.severity] || b.count - a.count;
  });

  const penalty = active.reduce((sum, item) => sum + Math.min(item.score, item.score * Math.log10(item.count + 1)), 0);
  const healthScore = Math.max(8, Math.round(100 - Math.min(92, penalty)));
  const primary = active[0];
  return {
    generatedAt: new Date().toISOString(),
    healthScore,
    status: active.some(x => x.severity === 'critical') ? 'critical' : active.some(x => x.severity === 'high') ? 'warning' : active.length ? 'attention' : 'healthy',
    summary: primary ? `主要问题位于${primary.category}：${primary.title}。共识别 ${active.length} 类有效异常。` : '未识别到规则库覆盖的明确故障。',
    metrics: { files: files.length, lines, bytes, findings: active.reduce((sum, x) => sum + x.count, 0) },
    findings: active,
    coverage: ['RTK/GNSS', '网络/Wi-Fi', '串口/VCU', 'CAN/电机', '系统资源', '存储/文件系统'],
    disclaimer: '诊断基于日志证据和规则关联；涉及硬件更换前应结合现场复测。'
  };
}

module.exports = { analyzeLogRoot, listFiles };

