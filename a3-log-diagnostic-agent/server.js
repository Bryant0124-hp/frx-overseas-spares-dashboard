'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveLogs, validSn } = require('./src/collector');
const { analyzeLogRoot } = require('./src/analyzer');
const { available: enterpriseAvailable } = require('./src/enterprise-collector');

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC = path.join(__dirname, 'public');
const jobs = new Map();

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  const token = process.env.A3_ACCESS_TOKEN;
  if (!token) return true;
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!supplied || supplied.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 20_000) throw new Error('请求过大');
  }
  return JSON.parse(body || '{}');
}

function publicFile(urlPath) {
  const requestPath = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.resolve(PUBLIC, `.${decodeURIComponent(requestPath)}`);
  return file.startsWith(PUBLIC) ? file : null;
}

function modelFromSn(sn) {
  if (sn.includes('FR4000')) return 'FR4000';
  if (sn.includes('FL3000')) return 'FL3000';
  if (sn.includes('FV2000')) return 'FV2000';
  if (sn.includes('RCM')) return 'RCM';
  return 'A3 Device';
}

function update(job, event) {
  Object.assign(job, event, { updatedAt: new Date().toISOString() });
}

async function run(job) {
  try {
    update(job, { state: 'running', phase: 'connecting', progress: 4, message: '正在识别车型与设备区域' });
    const logRoot = await resolveLogs(job.sn, event => update(job, event));
    update(job, { phase: 'analyzing', progress: 1, message: '日志已就绪，正在建立故障时间线' });
    const result = await analyzeLogRoot(logRoot, { onProgress: event => update(job, { ...event, progress: 68 + Math.round(event.progress * 0.28) }) });
    let device = {};
    try { device = JSON.parse(fs.readFileSync(path.join(path.dirname(logRoot), 'device.json'), 'utf8')); } catch {}
    job.result = { sn: job.sn, model: device.model || modelFromSn(job.sn), region: device.region || '', source: 'enterprise-agent', ...result };
    update(job, { state: 'done', phase: 'done', progress: 100, message: '诊断完成' });
  } catch (error) {
    update(job, { state: 'error', phase: 'error', progress: 100, message: error.message });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/api/status') {
    return json(res, 200, { ok: true, mode: process.env.A3_COLLECTOR_COMMAND || enterpriseAvailable() ? 'enterprise' : 'local', version: '1.1.0' });
  }
  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    if (!authorized(req)) return json(res, 401, { error: '未授权：请通过企业认证入口访问' });
    try {
      const body = await readJson(req);
      const sn = String(body.sn || '').trim().toUpperCase();
      if (!validSn(sn)) return json(res, 400, { error: '请输入正确的设备 SN' });
      const id = crypto.randomUUID();
      const job = { id, sn, state: 'queued', phase: 'queued', progress: 0, message: '任务已创建', createdAt: new Date().toISOString() };
      jobs.set(id, job);
      run(job);
      return json(res, 202, { id });
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  const match = url.pathname.match(/^\/api\/jobs\/([a-f0-9-]+)$/i);
  if (req.method === 'GET' && match) {
    if (!authorized(req)) return json(res, 401, { error: '未授权：请通过企业认证入口访问' });
    const job = jobs.get(match[1]);
    return job ? json(res, 200, job) : json(res, 404, { error: '任务不存在' });
  }
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  const file = publicFile(url.pathname);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return json(res, 404, { error: 'Not found' });
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => console.log(`A3 Log Diagnostic Agent: http://${HOST}:${PORT}`));

