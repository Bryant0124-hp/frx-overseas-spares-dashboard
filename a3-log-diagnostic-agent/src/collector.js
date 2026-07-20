'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { available: enterpriseAvailable, collectEnterprise } = require('./enterprise-collector');

function validSn(sn) {
  return /^[A-Z0-9_-]{8,40}$/.test(sn);
}

async function resolveLogs(sn, onProgress = () => {}) {
  if (!validSn(sn)) throw new Error('SN 格式不正确');
  const store = path.resolve(process.env.A3_LOG_STORE || path.join(__dirname, '..', 'runtime', 'devices'));
  const existing = path.join(store, sn, 'extracted');
  if (fs.existsSync(existing)) {
    onProgress({ phase: 'collecting', progress: 100, message: '已找到本地日志快照' });
    return existing;
  }
  const command = process.env.A3_COLLECTOR_COMMAND;
  if (!command && enterpriseAvailable()) return collectEnterprise(sn, store, onProgress);
  if (!command) throw new Error('未配置企业采集器。请在部署端设置 A3_SSH_KEY 或 A3_COLLECTOR_COMMAND；凭据不能放入公开网页。');
  let args;
  try { args = JSON.parse(process.env.A3_COLLECTOR_ARGS_JSON || '["{sn}"]'); }
  catch { throw new Error('A3_COLLECTOR_ARGS_JSON 不是合法 JSON'); }
  if (!Array.isArray(args)) throw new Error('A3_COLLECTOR_ARGS_JSON 必须是数组');
  args = args.map(value => String(value).replaceAll('{sn}', sn).replaceAll('{output}', path.join(store, sn)));
  onProgress({ phase: 'collecting', progress: 8, message: '正在申请设备远程通道并采集日志' });
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, env: { ...process.env, A3_TARGET_SN: sn } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; onProgress({ phase: 'collecting', progress: 55, message: '正在从设备安全传输日志' }); });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`采集器退出（${code}）：${stderr.slice(-500)}`));
      for (const line of stdout.trim().split(/\r?\n/).reverse()) {
        try {
          const result = JSON.parse(line);
          if (result.logRoot && fs.existsSync(result.logRoot)) return resolve(path.resolve(result.logRoot));
        } catch {}
      }
      if (fs.existsSync(existing)) return resolve(existing);
      reject(new Error('采集器未返回有效的 logRoot'));
    });
  });
}

module.exports = { resolveLogs, validSn };

