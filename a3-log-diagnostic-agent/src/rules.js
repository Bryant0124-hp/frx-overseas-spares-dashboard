'use strict';

const RULES = [
  {
    id: 'rtk-crc', category: 'RTK / 无线链路', severity: 'high', weight: 22,
    title: 'RTK 无线数据帧校验失败',
    pattern: /failed to check crc|(?:crc|checksum).*(?:fail|error|mismatch)/i,
    impact: 'RTK 差分数据存在损坏，可能造成定位由 FIX 降级、路径抖动或短时停机。',
    cause: '优先怀疑基站到车辆的无线链路干扰、天线/馈线接触或射频覆盖质量。',
    actions: ['检查车辆与基站天线、接头和馈线', '对比异常时段的 radio rate/lost', '换空旷区域复测并检查同频干扰']
  },
  {
    id: 'rtk-loss', category: 'RTK / 无线链路', severity: 'medium', weight: 13,
    title: 'RTK 数据帧存在丢失',
    pattern: /\[frame-info\].*\brate:(?:9[0-7](?:\.\d+)?|[0-8]?\d(?:\.\d+)?)\b.*\blost:[1-9]\d*/i,
    impact: '差分链路完整率偏低，连续丢帧时会影响定位稳定性。',
    cause: '无线覆盖、遮挡或瞬时干扰导致有效帧率下降。',
    actions: ['检查 rate 最低值与持续时间', '确认基站位置和天线视距', '与 CRC 失败事件交叉比对']
  },
  {
    id: 'sdio-timeout', category: '网络 / 驱动', severity: 'high', weight: 20,
    title: 'Wi-Fi SDIO 总线响应超时',
    pattern: /sdio:\s*resp_timeout/i,
    impact: 'Wi-Fi 芯片通信可能中断，进一步引起云端离线、远程控制或日志上传失败。',
    cause: 'Wi-Fi 模组、SDIO 总线、供电稳定性或驱动恢复异常。',
    actions: ['核对超时前后的 Wi-Fi 重启记录', '检查模组供电与连接', '升级或回归验证 Wi-Fi 驱动/固件']
  },
  {
    id: 'wifi-driver', category: '网络 / 驱动', severity: 'medium', weight: 11,
    title: 'Wi-Fi 驱动异常',
    pattern: /CFG80211-ERROR|WEXT-ERROR|CFGP2P-ERROR|failed to start ecounters/i,
    impact: '无线网络连接或自动恢复可能不稳定。',
    cause: '驱动状态机、Wi-Fi 模组复位或配置切换异常。',
    actions: ['查看同一时间是否发生接口重置', '检查 WLAN 固件版本', '验证网络切换与重连流程']
  },
  {
    id: 'nav-parse', category: '导航 / 数据', severity: 'medium', weight: 10,
    title: '导航任务数据解析失败',
    pattern: /(?:NAV|Path).*json\.exception\.parse_error|STRtkPathWorkReport.*parse error/i,
    impact: '任务路径或作业报告无法被导航模块正确解析。',
    cause: '上游数据为空、截断或格式与当前固件不兼容。',
    actions: ['抓取对应任务报文原文', '校验发送端 JSON 格式', '核对平台与车辆固件协议版本']
  },
  {
    id: 'serial-link', category: '串口 / VCU', severity: 'high', weight: 18,
    title: '串口通信异常',
    pattern: /(?:serial|uart|tty\w*).{0,100}(?:failed|error|timeout|disconnect|closed)/i,
    exclude: /open.*success|set .*baudrate done/i,
    impact: 'VCU、传感器或外设数据可能中断。',
    cause: '串口设备掉线、波特率不匹配、线路干扰或进程重启。',
    actions: ['确认具体 tty 设备和波特率', '检查线束与接插件', '比对串口中断前后的进程重启记录']
  },
  {
    id: 'can-bus-off', category: 'CAN / 执行器', severity: 'critical', weight: 32,
    title: 'CAN 总线 Bus-Off',
    pattern: /can.{0,60}bus[- ]off|bus[- ]off.{0,60}can/i,
    impact: '底盘或执行器通信可能完全中断，车辆应停止工作。',
    cause: 'CAN 线束、终端电阻、供电或节点持续发送错误帧。',
    actions: ['立即检查 CAN_H/CAN_L 与终端电阻', '确认异常节点和错误计数', '排除线束短路及供电波动']
  },
  {
    id: 'motor-fault', category: '电机 / 执行器', severity: 'high', weight: 22,
    title: '电机或驱动器故障',
    pattern: /(?:motor|电机).{0,80}(?:fault|故障|overcurrent|过流|overheat|过温|stall|堵转)/i,
    exclude: /恢复|recover|clear|故障检测|fault check/i,
    impact: '行走或割草动作受限，可能触发保护停机。',
    cause: '机械阻塞、负载过高、驱动器保护、温升或供电问题。',
    actions: ['检查刀盘/轮毂是否卡滞', '查看电流、温度和母线电压', '确认故障是否重复出现']
  },
  {
    id: 'thermal', category: '系统 / 硬件', severity: 'high', weight: 20,
    title: '系统温度异常',
    pattern: /overheat|thermal.*(?:critical|trip)|temperature.{0,30}(?:too high|critical)/i,
    impact: '系统可能降频或保护关机。',
    cause: '散热受阻、环境温度过高或温度传感器异常。',
    actions: ['清理散热通道', '检查风扇和导热结构', '复核温度传感器读数']
  },
  {
    id: 'oom', category: '系统 / 资源', severity: 'critical', weight: 30,
    title: '内存耗尽',
    pattern: /out of memory|oom-killer|killed process \d+/i,
    impact: '关键进程可能被系统终止，造成导航或控制服务中断。',
    cause: '进程内存泄漏、并发任务过多或资源配置不足。',
    actions: ['定位被终止进程', '检查内存增长趋势', '复核 core dump 与服务重启记录']
  },
  {
    id: 'filesystem', category: '存储 / 文件系统', severity: 'critical', weight: 30,
    title: '存储或文件系统错误',
    pattern: /EXT4-fs error|blk_update_request.*I\/O error|buffer I\/O error|filesystem.*corrupt/i,
    impact: '日志、地图或配置可能损坏，严重时设备无法正常启动。',
    cause: '存储介质老化、异常断电或文件系统损坏。',
    actions: ['立即备份关键数据', '检查存储健康状态', '离线执行文件系统检查并评估更换介质']
  }
];

module.exports = { RULES };

