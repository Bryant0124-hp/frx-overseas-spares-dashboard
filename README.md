FRX 海外仓备件交互站

目录说明
- `index.html` 是可直接发布到公网的单文件静态网页。
- `fjd-fae-rma-spares-dashboard/` 是独立的 FJD FAE RMA 备件交互看板子目录。

发布方式
- GitHub Pages：把这个目录内容放到仓库根目录或发布目录，启用 Pages 即可。
- Cloudflare Pages：新建 Pages 项目后，把这个目录作为站点目录上传即可。

说明
- 当前页面已经是纯前端静态页，不依赖本地程序、数据库或后端服务。
- 只要部署到任意静态托管平台，别人就可以通过公网链接访问。
- 如果当前仓已经开启 GitHub Pages，则新看板可通过子路径访问：
  `https://bryant0124-hp.github.io/frx-overseas-spares-dashboard/fjd-fae-rma-spares-dashboard/`
