# A3 Pulse — 智能日志诊断 Agent

输入设备 SN，Agent 自动完成日志准备、流式扫描、协议关联、根因排序和可视化展示。

## 功能

- 严格校验 SN；采集器使用参数数组启动，不拼接 Shell 命令。
- 流式分析普通日志、轮转日志、JSON/JSONL 和 Gzip 日志。
- 覆盖 RTK/GNSS、网络/Wi-Fi、导航、串口/VCU、CAN/电机、系统资源和存储。
- 每条结论包含影响、根因、建议动作、时间范围、次数和脱敏证据。
- 动态网页展示任务进度、健康指数、协议覆盖和可展开证据链。
- 公网静态页提供 `FJDFR40002550373FY` 的脱敏实测结果。

## 本地启动

需要 Node.js 18 或更高版本，不需要第三方依赖：

```powershell
cd a3-log-diagnostic-agent
npm.cmd start
```

打开 `http://localhost:4173`。也可直接分析已有日志：

```powershell
node cli.js FJDFR40002550373FY "D:\logs\FJDFR40002550373FY\extracted"
```

## 让新 SN 自动采集

公开浏览器不能安全保存 UOP 会话、SSH 私钥或 FRP 凭据。生产部署时，将企业采集程序放在受控服务器，并配置：

```text
A3_COLLECTOR_COMMAND=C:\secure\collector.exe
A3_COLLECTOR_ARGS_JSON=["--sn","{sn}","--output","{output}"]
A3_LOG_STORE=D:\secure-a3-logs
```

采集器完成后，最后一行输出 `{"logRoot":"D:\\secure-a3-logs\\FJ...\\extracted"}`。网页只发送 SN，UOP 登录态、动态 SSH 端口和私钥均留在服务器端。

## 已验证链路

项目依据 FR4000 `FJDFR40002550373FY` 的成功流程设计：识别产品与区域 → 申请或刷新 SSH 隧道 → 校验主机指纹 → 分目录归档 → SHA-256 校验 → 补采轮转日志 → 流式分析。

## 安全

- `.env`、私钥、原始日志和压缩包均被禁止提交。
- 证据进入结果前自动脱敏并限制长度。
- 公网演示仅包含人工复核的脱敏证据，不提供匿名设备 SSH 权限。

运行测试：`npm.cmd test`

MIT License
