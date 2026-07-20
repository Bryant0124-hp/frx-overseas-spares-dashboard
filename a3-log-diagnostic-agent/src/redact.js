'use strict';

const SECRET_KEYS = [
  'password', 'passwd', 'pwd', 'secret', 'secretKey', 'secretId', 'token',
  'accessToken', 'refreshToken', 'authorization', 'mqttKey', 'privateKey',
  'apiKey', 'credential', 'cookie', 'ssid'
];

function redact(input) {
  let text = String(input ?? '');
  const keys = SECRET_KEYS.join('|');
  text = text.replace(new RegExp(`(["']?(?:${keys})["']?\\s*[:=]\\s*["']?)([^,"'\\s}]+)`, 'gi'), '$1[REDACTED]');
  text = text.replace(/(https?:\/\/[^\s?#]+\?[^\s]*?(?:token|secret|key|password)=)[^&#\s]+/gi, '$1[REDACTED]');
  text = text.replace(/\bAKID[A-Za-z0-9]{12,}\b/g, '[REDACTED_ID]');
  text = text.replace(/\b(?:[A-Fa-f0-9]{32,}|[A-Za-z0-9+/]{40,}={0,2})\b/g, '[REDACTED_SECRET]');
  return text.length > 360 ? `${text.slice(0, 357)}...` : text;
}

module.exports = { redact };

