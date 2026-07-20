'use strict';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const demoSn = 'DEMO-A3-DEVICE-001';
let demoCache;

const phases = ['connecting', 'collecting', 'analyzing', 'done'];
const phaseLabels = { queued: '任务排队', connecting: '识别设备与区域', collecting: '建立通道并采集日志', analyzing: '多协议关联分析', done: '诊断结论已生成', error: '诊断中断' };

function formatNumber(value) { return new Intl.NumberFormat('zh-CN', { notation: Number(value) > 999999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value || 0); }
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = String(value ?? ''); return div.innerHTML; }

function setProgress(phase, progress, message) {
  $('#progressPanel').classList.remove('hidden');
  $('#progressValue').textContent = `${Math.max(0, Math.min(100, progress || 0))}%`;
  $('#progressBar').style.width = `${progress || 0}%`;
  $('#phaseName').textContent = phaseLabels[phase] || phase;
  $('#progressMessage').textContent = message || '正在处理…';
  const current = Math.max(0, phases.indexOf(phase));
  $$('.pipeline>div').forEach((el, index) => {
    el.classList.toggle('active', index === current);
    el.classList.toggle('done', index < current || phase === 'done');
  });
}

async function getDemo() {
  demoCache ||= fetch('data/demo-result.json').then(response => response.json());
  return demoCache;
}

function render(result) {
  $('#results').classList.remove('hidden');
  $('#deviceModel').textContent = result.model;
  $('#deviceSn').textContent = result.sn;
  $('#healthScore').textContent = result.healthScore;
  $('#healthRing').style.setProperty('--score', result.healthScore);
  $('#metricFiles').textContent = formatNumber(result.metrics.files);
  $('#metricLines').textContent = formatNumber(result.metrics.lines);
  $('#metricFindings').textContent = formatNumber(result.metrics.findings);
  $('#metricCoverage').textContent = result.coverage.length;
  $('#summaryTitle').textContent = result.findings[0]?.title || '未发现明确故障';
  $('#summaryText').textContent = result.summary;
  $('#statusBadge').textContent = result.status.toUpperCase();
  $('#disclaimer').textContent = result.disclaimer;
  $('#signalChart').innerHTML = Array.from({ length: 54 }, (_, i) => `<i style="height:${12 + Math.abs(Math.sin(i * .67) * 46) + (i % 7) * 2}px;animation-delay:${i * 8}ms"></i>`).join('');
  $('#coverageList').innerHTML = result.coverage.map((name, i) => `<div class="coverage-item"><span>${escapeHtml(name)}</span><span>ACTIVE</span><div class="coverage-bar"><i style="width:${78 + (i * 7) % 22}%"></i></div></div>`).join('');
  $('#findingList').innerHTML = result.findings.map((item, index) => `
    <article class="finding ${index === 0 ? 'open' : ''}">
      <div class="finding-summary" role="button" tabindex="0">
        <span class="severity-tag ${item.severity}">${item.severity}</span>
        <div class="finding-title"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.category)} · ${escapeHtml(item.firstSeen || '时间未知')} → ${escapeHtml(item.lastSeen || '持续')}</span></div>
        <div class="finding-count"><b>${formatNumber(item.count)}</b><span>MATCHES</span></div>
      </div>
      <div class="finding-detail">
        <div class="detail-block"><h4>可能影响</h4><p>${escapeHtml(item.impact)}</p><h4>根因判断</h4><p>${escapeHtml(item.cause)}</p></div>
        <div class="detail-block"><h4>建议动作</h4><ul>${item.actions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}</ul></div>
        ${item.samples.map(sample => `<div class="evidence"><b>${escapeHtml(sample.time || sample.file)}</b>　${escapeHtml(sample.text)}</div>`).join('')}
      </div>
    </article>`).join('') || '<article class="finding"><div class="finding-summary"><div class="finding-title"><b>未发现明确故障</b><span>建议结合现场症状进一步检查</span></div></div></article>';
  $$('.finding-summary').forEach(summary => {
    const toggle = () => summary.parentElement.classList.toggle('open');
    summary.addEventListener('click', toggle);
    summary.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') toggle(); });
  });
  setTimeout(() => $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' }), 160);
}

async function runDemo() {
  $('#scanButton').disabled = true;
  const stages = [
    ['connecting', 12, '正在识别 FR4000 与欧服设备域'],
    ['collecting', 38, '已校验日志快照：5,715 个文件'],
    ['analyzing', 71, '正在关联 RTK、网络、导航与 VCU 证据'],
    ['done', 100, '诊断完成，所有展示内容均已脱敏']
  ];
  for (const stage of stages) { setProgress(...stage); await new Promise(resolve => setTimeout(resolve, 520)); }
  render(await getDemo());
  $('#scanButton').disabled = false;
}

async function poll(id) {
  for (;;) {
    const response = await fetch(`api/jobs/${id}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('读取诊断任务失败');
    const job = await response.json();
    setProgress(job.phase, job.progress, job.message);
    if (job.state === 'done') return job.result;
    if (job.state === 'error') throw new Error(job.message);
    await new Promise(resolve => setTimeout(resolve, 900));
  }
}

async function start(sn) {
  $('#scanButton').disabled = true;
  $('#results').classList.add('hidden');
  try {
    const response = await fetch('api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sn }) });
    if (!response.ok) throw new Error((await response.json()).error || '创建任务失败');
    render(await poll((await response.json()).id));
  } catch (error) {
    if (sn === demoSn) return runDemo();
    setProgress('error', 100, `公开演示站未连接企业采集器：${error.message}`);
  } finally { $('#scanButton').disabled = false; }
}

$('#scanForm').addEventListener('submit', event => {
  event.preventDefault();
  const sn = $('#snInput').value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{8,40}$/.test(sn)) return setProgress('error', 100, '请输入 8–40 位正确设备 SN');
  start(sn);
});
$('#demoButton').addEventListener('click', () => { $('#snInput').value = demoSn; runDemo(); });
fetch('api/status', { cache: 'no-store' }).then(response => response.json()).then(status => {
  $('#systemText').textContent = status.mode === 'enterprise' ? '企业采集器在线' : '本地分析模式';
}).catch(() => { $('#systemText').textContent = '公开演示模式'; });

