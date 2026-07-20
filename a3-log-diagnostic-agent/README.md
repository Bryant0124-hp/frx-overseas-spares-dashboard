# A3 Pulse — Universal Log Diagnostic Agent

Enter a device serial number and the agent can call an organization-provided collector, stream the resulting logs, correlate protocol failures, and present a visual diagnosis.

## Capabilities

- Accepts any safe 8–40 character device SN; no single model is hard-coded.
- Supports an external enterprise collector through `A3_COLLECTOR_COMMAND`.
- Streams plain, rotated, JSON/JSONL, and Gzip logs.
- Correlates RTK/GNSS, network, navigation, serial/VCU, CAN/motor, storage, and system-resource signals.
- Redacts credentials and limits evidence length before results reach the browser.
- Includes a synthetic public demo. Real collection requires a private backend protected by enterprise SSO or an access token.

## Run

```powershell
npm.cmd test
npm.cmd start
```

Open `http://127.0.0.1:4173`. To analyze an existing directory:

```powershell
node cli.js DEVICE-SN "D:\logs\DEVICE-SN\extracted"
```

## Connect a private collector

Set `A3_COLLECTOR_COMMAND` and optional `A3_COLLECTOR_ARGS_JSON`. The collector receives the SN and must print a final JSON line such as:

```json
{"logRoot":"D:\\secure-device-logs\\DEVICE-SN\\extracted"}
```

Keep credentials, platform sessions, private keys, raw logs, tunnel endpoints, and internal hostnames outside this repository. GitHub Pages serves only the static UI and synthetic demo; real device analysis requires the protected backend.

MIT License
