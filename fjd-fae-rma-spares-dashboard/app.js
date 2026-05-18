const FILTER_ALL = '全部';

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

function qtyText(value, fallback = '0') {
  if (value === null || value === undefined || value === '') return fallback;
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
  const ownerOk = filters.owner === FILTER_ALL || card.owner === filters.owner;
  const warehouseOk = filters.warehouse === FILTER_ALL || card.warehouseGroup === filters.warehouse;
  if (!ownerOk || !warehouseOk) return false;
  if (!filters.keyword) return true;

  const inventoryHaystack = (card.inventorySummary?.warehouses || []).flatMap((item) => [
    item.label,
    item.placeLabel,
    item.stockWarehouseName,
    item.note
  ]);

  const haystack = [
    card.owner,
    card.warehouseGroup,
    card.projectCode,
    ...card.warehouses,
    ...card.items.map((item) => item.partName),
    ...card.items.flatMap((item) => item.rmaNames),
    ...card.items.flatMap((item) => item.productCodes || []),
    ...inventoryHaystack
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

function uniqueProjects(cards) {
  const map = new Map();
  cards.forEach((card) => {
    const key = [card.owner, card.projectCode].join('|');
    if (!map.has(key)) {
      map.set(key, card);
    }
  });
  return [...map.values()];
}

function renderHero() {
  const source = state.data.source;
  const inventorySource = source.inventorySource || {};
  const warehouseConfigs = inventorySource.warehouseConfigs || [];
  const configuredCount = warehouseConfigs.filter((item) => item.stockConfigured).length;

  els.heroMeta.innerHTML = [
    `生成时间：${state.data.generatedAt}`,
    `覆盖明细：${source.rawRowCount} 行`,
    `项目卡片：${source.projectCardCount} 张`,
    `聚合明细：${source.detailRowCount} 行`,
    `已配置库存仓：${configuredCount}/${warehouseConfigs.length}`
  ].map((text) => `<span class="chip">${text}</span>`).join('');

  const noteLines = [];
  if (source.unmatchedWarehouseRowCount > 0) {
    noteLines.push(`当前仍有 ${source.unmatchedWarehouseRowCount} 行原始 header 未写明发货仓，页面不再做任何仓库推断。`);
  } else {
    noteLines.push('当前所有发货仓均直接来自原始 Odoo / header 数据，不含任何补推仓库。');
  }

  const unconfigured = warehouseConfigs.filter((item) => !item.stockConfigured).map((item) => item.label);
  if (unconfigured.length > 0) {
    noteLines.push(`${unconfigured.join('、')} 在 Odoo 出发地主数据中未配置 stock_warehouse_id，现存量显示为“未配置”；在途量按发运单 place_of_departure 精确统计。`);
  }

  if (inventorySource.unmatchedProductCodeCount > 0) {
    noteLines.push(`有 ${inventorySource.unmatchedProductCodeCount} 个产品编码未在 Odoo 产品主数据中匹配到，因此不会计入现存与在途。`);
  }

  els.sourceNote.textContent = noteLines.join(' ');
}

function renderMetrics(cards, rows) {
  const totalQty = rows.reduce((sum, row) => sum + Number(row.qty), 0);
  const uniqueCards = uniqueProjects(cards);
  const projectCount = uniqueCards.length;
  const detailCount = rows.length;
  const warehouseCount = new Set(rows.map((row) => row.warehouseName)).size;
  const totalTransitQty = uniqueCards.reduce(
    (sum, card) => sum + Number(card.inventorySummary?.totalInTransitQty || 0),
    0
  );

  const metrics = [
    ['覆盖项目数', projectCount],
    ['聚合明细行数', detailCount],
    ['已发送备件数量', qtyText(totalQty)],
    ['当前在途数量', qtyText(totalTransitQty)],
    ['涉及发货仓', warehouseCount]
  ];

  els.metrics.innerHTML = metrics
    .map(([label, value]) => `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`)
    .join('');
}

function renderInventoryCards(card) {
  const warehouseMetrics = card.inventorySummary?.warehouses || [];
  if (!warehouseMetrics.length) {
    return '<div class="inventory-empty">当前项目未匹配到可统计的 Odoo 产品编码。</div>';
  }

  return `
    <div class="inventory-grid">
      ${warehouseMetrics.map((item) => `
        <article class="inventory-card${item.stockConfigured ? '' : ' is-unconfigured'}">
          <div class="inventory-card-head">
            <span>${item.label}</span>
            <strong>${item.stockConfigured ? qtyText(item.onHandQty, '0') : '未配置'}</strong>
          </div>
          <div class="inventory-sub">现存备件量</div>
          <div class="inventory-transit">在途：${qtyText(item.inTransitQty)}</div>
          <div class="inventory-note">${item.stockConfigured ? `库存仓：${item.stockWarehouseName}` : item.note}</div>
        </article>
      `).join('')}
    </div>
  `;
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
            <span>在途 ${qtyText(card.inventorySummary?.totalInTransitQty || 0)}</span>
          </div>
        </div>
        <div class="project-meta">
          <span>备件 ${card.partCount} 种</span>
          <span>RMA ${card.rmaCount} 单</span>
          <span>匹配编码 ${card.inventorySummary?.matchedProductCodeCount || 0}</span>
        </div>
      </div>

      <div class="project-meta warehouse-tags">
        ${card.warehouses.map((warehouse) => `<span>${warehouse}</span>`).join('')}
      </div>

      <section class="project-section">
        <div class="project-section-title">四仓现存与在途</div>
        ${renderInventoryCards(card)}
        ${card.inventorySummary?.unmatchedProductCodeCount
          ? `<div class="inventory-warning">未匹配 Odoo 产品编码 ${card.inventorySummary.unmatchedProductCodeCount} 个：${card.inventorySummary.unmatchedProductCodes.join('、')}</div>`
          : ''}
      </section>

      <table class="project-table">
        <thead>
          <tr>
            <th>备件</th>
            <th>产品编码</th>
            <th>发货仓</th>
            <th>数量</th>
            <th>RMA 单数</th>
          </tr>
        </thead>
        <tbody>
          ${card.items.map((item) => `
            <tr>
              <td>${item.partName}</td>
              <td>${(item.productCodes || []).join(', ') || '-'}</td>
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
      <td>${(row.productCodes || []).join(', ') || '-'}</td>
      <td>${qtyText(row.qty)}</td>
      <td>${row.rmaCount}</td>
      <td>${row.serialCount}</td>
      <td>${row.latestDate || '-'}</td>
      <td>${row.rmaNames.join(', ')}</td>
    </tr>
  `).join('');
}

function renderSummary(cards, rows) {
  const uniqueCards = uniqueProjects(cards);
  const totalQty = rows.reduce((sum, row) => sum + Number(row.qty), 0);
  const totalTransitQty = uniqueCards.reduce(
    (sum, card) => sum + Number(card.inventorySummary?.totalInTransitQty || 0),
    0
  );
  els.resultSummary.textContent =
    `当前筛选命中 ${uniqueCards.length} 个项目号，${rows.length} 行聚合明细，已发送备件 ${qtyText(totalQty)}，当前在途 ${qtyText(totalTransitQty)}。`;
}

function downloadCsv(rows, cards) {
  const summaryMap = new Map();
  uniqueProjects(cards).forEach((card) => {
    summaryMap.set([card.owner, card.projectCode].join('|'), card.inventorySummary || {});
  });

  const header = [
    '区域负责人',
    '仓别',
    '发货仓',
    '项目号',
    '备件名称',
    '产品编码',
    '发送数量',
    'RMA单数',
    'SN数',
    '最近RMA时间',
    '关联RMA',
    '芝加哥现存',
    '芝加哥在途',
    '法兰克福现存',
    '法兰克福在途',
    '悉尼现存',
    '悉尼在途',
    '日本现存',
    '日本在途'
  ];

  const lines = [header];
  rows.forEach((row) => {
    const summary = summaryMap.get([row.owner, row.projectCode].join('|')) || {};
    const inventory = new Map((summary.warehouses || []).map((item) => [item.key, item]));
    const rowValues = [
      row.owner,
      row.warehouseGroup,
      row.warehouseName,
      row.projectCode,
      row.partName,
      (row.productCodes || []).join(' / '),
      row.qty,
      row.rmaCount,
      row.serialCount,
      row.latestDate,
      row.rmaNames.join(' / '),
      inventory.get('chicago')?.stockConfigured ? inventory.get('chicago').onHandQty : '未配置',
      inventory.get('chicago')?.inTransitQty ?? 0,
      inventory.get('frankfurt')?.stockConfigured ? inventory.get('frankfurt').onHandQty : '未配置',
      inventory.get('frankfurt')?.inTransitQty ?? 0,
      inventory.get('sydney')?.stockConfigured ? inventory.get('sydney').onHandQty : '未配置',
      inventory.get('sydney')?.inTransitQty ?? 0,
      inventory.get('japan')?.stockConfigured ? inventory.get('japan').onHandQty : '未配置',
      inventory.get('japan')?.inTransitQty ?? 0
    ];
    lines.push(rowValues);
  });

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
  els.downloadBtn.onclick = () => downloadCsv(rows, cards);
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
    els.ownerFilter.value = FILTER_ALL;
    els.warehouseFilter.value = FILTER_ALL;
    els.keywordFilter.value = '';
    refresh();
  });

  refresh();
}

boot().catch((error) => {
  document.body.innerHTML = `<pre style="padding:24px;font:14px Consolas, monospace;">看板加载失败\n${String(error)}</pre>`;
});
