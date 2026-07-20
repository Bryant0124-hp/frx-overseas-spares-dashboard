'use strict';

function available() {
  return false;
}

async function collectEnterprise() {
  throw new Error('No private enterprise collector is configured. Set A3_COLLECTOR_COMMAND on the protected backend.');
}

function config() {
  return {};
}

module.exports = { available, collectEnterprise, config };
