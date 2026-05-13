# FJD FAE RMA备件看板

这是一个独立的可交互式静态站目录，不覆盖任何已有看板。

## 页面能力

- 一级筛选：`Jingtian.Chen欧洲`、`James.Wang美洲`、`Jackson.Lv澳新`、`Haochen.Peng亚太`
- 二级筛选：`海外仓`、`国内仓`、`未匹配仓库`
- 关键词搜索：项目号 / 备件 / 发货仓 / RMA 单号
- 项目卡片视图
- 聚合明细表
- 当前筛选结果 CSV 导出

## 数据文件

- `data/dashboard-data.json`

## 本地预览

```bash
npm run serve
```

默认地址：

```text
http://localhost:4173
```

## 数据生成来源

- `C:\Users\haocheng.peng\Documents\Playground\odoo-rma-export\build-fjd-fae-rma-dashboard.py`
- `C:\Users\haocheng.peng\Documents\Playground\odoo-rma-export\output\rma_project_serial_export\fjd_fae_rma_dashboard_data.json`
