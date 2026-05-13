const els = {
  heroMeta: document.getElementById('heroMeta'),
  ownerFilter: document.getElementById('ownerFilter'),
  warehouseFilter: document.getElementById('warehouseFilter'),
  keywordFilter: document.getElementById('keywordFilter'),
  resetBtn: document.getElementById('resetBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  sourceNote: document.getElementById('sourceNote'),
  metrics: document.getElementById('metrics'),
  resultSummary: document.getElementById('resultSummary'),
  projectGrid: document.getElementById('projectGrid'),
  emptyState: document.getElementById('emptyState'),
  detailBody: document.getElementById('detailBody')
};

const state = { data: null };

function option(value) {
  return `<option value="${value}">${value}</option>`;
}

function qtyText(value) {
  const number = Number(value || 0);
  const hasDecimal = Math.abs(number % 1) > 0.0001;
  return number.toLocaleString('zh-CN', {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2
  });
}

function fillSelect(el, values) {
  el.innerHTML = values.map(option).join('');
}

function getFilters() {
  return {
    owner: els.ownerFilter.value,
    warehouse: els.warehouseFilter.value,
    keyword: els.keywordFilter.value.trim().toLowerCase()
  };
}

function cardMatches(card, filters) {
  const ownerOk = filters.owner === '全部' || card.owner === filters.owner;
  const warehouseOk = filters.warehouse === '全部' || card.warehouseGroup === filters.warehouse;
  if (!ownerOk || !warehouseOk) return false;
  if (!filters.keyword) return true;

  const haystack = [
    card.owner,
    card.warehouseGroup,
    card.projectCode,
    ...card.warehouses,
    ...card.items.map((item) => item.partName),
    ...card.items.flatMap((item) => item.rmaNames)
  ].join(' ').toLowerCase();

  return haystack.includes(filters.keyword);
}

function filterProjectCards() {
  const filters = getFilters();
  return state.data.projectCards.filter((card) => cardMatches(card, filters));
}

function filterDetailRows(cards) {
  const keys = new Set(
    cards.flatMap((card) =>
      card.items.map((item) =>
        [item.owner, item.warehouseGroup, item.warehouseName, item.projectCode, item.partName].join('|')
      )
    )
  );

  return state.data.detailRows.filter((row) =>
    keys.has([row.owner, row.warehouseGroup, row.warehouseName, row.projectCode, row.partName].join('|'))
  );
}

function renderHero() {
  const source = state.data.source;
  els.heroMeta.innerHTML = [
    `生成时间：${state.data.generatedAt}`,
    `覆盖明细：${source.rawRowCount} 行`,
    `项目卡片：${source.projectCardCount} 个`,
    `聚合明细：${source.detailRowCount} 行`
  ].map((text) => `<span class="chip">${text}</span>`).join('');

  els.sourceNote.textContent =
    source.unmatchedWarehouseRowCount > 0
      ? `当前仍有 ${source.unmatchedWarehouseRowCount} 行未在原始 header 数据中匹配到发货仓，页面不会再做推断，只保留为“未匹配（原始数据未写明发货仓）”。`
      : '当前所有看板明细均已按原始 Odoo / header 数据写明具体发货仓，页面不包含任何推断仓库。';
}

function renderMetrics(cards, rows) {
  const totalQty = rows.reduce((sum, row) => sum + Number(row.qty), 0);
  const projectCount = new Set(cards.map((card) => card.projectCode)).size;
  const detailCount = rows.length;
  const warehouseCount = new Set(rows.map((row) => row.warehouseName)).size;

  const metrics = [
    ['覆盖项目号', projectCount],
    ['聚合明细行数', detailCount],
    ['发送备件总数量', qtyText(totalQty)],
    ['涉及发货仓', warehouseCount]
  ];

  els.metrics.innerHTML = metrics
    .map(([label, value]) => `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`)
    .join('');
}

function renderProjectGrid(cards) {
  els.projectGrid.innerHTML = cards.map((card) => `
    <article class="project-card">
      <div class="project-head">
        <div>
          <div class="project-code">${card.projectCode}</div>
          <div class="project-meta">
            <span>${card.owner}</span>
            <span>${card.warehouseGroup}</span>
            <span>发送数量 ${qtyText(card.totalQty)}</span>
          </div>
        </div>
        <div class="project-meta">
          <span>备件 ${card.partCount} 种</span>
          <span>RMA ${card.rmaCount} 单</span>
        </div>
      </div>
      <div class="project-meta warehouse-tags">${card.warehouses.map((warehouse) => `<span>${warehouse}</span>`).join('')}</div>
      <table class="project-table">
        <thead>
          <tr>
            <th>备件</th>
            <th>发货仓</th>
            <th>数量</th>
            <th>RMA单数</th>
          </tr>
        </thead>
        <tbody>
          ${card.items.map((item) => `
            <tr>
              <td>${item.partName}</td>
              <td>${item.warehouseName}</td>
              <td>${qtyText(item.qty)}</td>
              <td>${item.rmaCount}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </article>
  `).join('');
}

function renderDetailTable(rows) {
  els.detailBody.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.owner}</td>
      <td>${row.warehouseGroup}</td>
      <td>${row.warehouseName}</td>
      <td>${row.projectCode}</td>
      <td>${row.partName}</td>
      <td>${qtyText(row.qty)}</td>
      <td>${row.rmaCount}</td>
      <td>${row.serialCount}</td>
      <td>${row.latestDate || '-'}</td>
      <td>${row.rmaNames.join(', ')}</td>
    </tr>
  `).join('');
}

function renderSummary(cards, rows) {
  const projectCount = new Set(cards.map((card) => card.projectCode)).size;
  const totalQty = rows.reduce((sum, row) => sum + Number(row.qty), 0);
  els.resultSummary.textContent =
    `当前筛选命中 ${projectCount} 个项目号，${rows.length} 行聚合明细，发送备件总数量 ${qtyText(totalQty)}。`;
}

function downloadCsv(rows) {
  const header = ['区域负责人', '仓别', '发货仓', '项目号', '备件名称', '发送数量', 'RMA单数', 'SN数', '最近RMA时间', '关联RMA'];
  const lines = [header, ...rows.map((row) => [
    row.owner,
    row.warehouseGroup,
    row.warehouseName,
    row.projectCode,
    row.partName,
    row.qty,
    row.rmaCount,
    row.serialCount,
    row.latestDate,
    row.rmaNames.join(' / ')
  ])];

  const csvText = '\ufeff' + lines.map((cols) => cols.map((value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\n');

  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'FJD_FAE_RMA备件看板_当前筛选.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function refresh() {
  const cards = filterProjectCards();
  const rows = filterDetailRows(cards);
  renderMetrics(cards, rows);
  renderSummary(cards, rows);
  renderProjectGrid(cards);
  renderDetailTable(rows);
  els.emptyState.style.display = cards.length ? 'none' : 'block';
  els.downloadBtn.onclick = () => downloadCsv(rows);
}

async function boot() {
  if (window.__dashboardData) {
    state.data = window.__dashboardData;
  } else {
    const response = await fetch('./data/dashboard-data.json');
    state.data = await response.json();
  }

  fillSelect(els.ownerFilter, state.data.filters.owners);
  fillSelect(els.warehouseFilter, state.data.filters.warehouseGroups);
  renderHero();

  els.ownerFilter.addEventListener('change', refresh);
  els.warehouseFilter.addEventListener('change', refresh);
  els.keywordFilter.addEventListener('input', refresh);
  els.resetBtn.addEventListener('click', () => {
    els.ownerFilter.value = '全部';
    els.warehouseFilter.value = '全部';
    els.keywordFilter.value = '';
    refresh();
  });

  refresh();
}

boot().catch((error) => {
  document.body.innerHTML = `<pre style="padding:24px;font:14px Consolas, monospace;">看板加载失败\n${String(error)}</pre>`;
});
