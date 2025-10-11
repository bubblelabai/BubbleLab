/* eslint-disable @typescript-eslint/no-require-imports, no-undef, @typescript-eslint/no-unused-vars */
'use strict';
const path = require('path');
const scope = require('@typescript-eslint/scope-manager');

// Re-export everything from upstream
Object.assign(exports, scope);

// Also export resetIds from internal ID module
try {
  // Find where scope-manager is installed, then load ID.js from there
  const scopeManagerPath = require.resolve('@typescript-eslint/scope-manager');
  const idPath = path.join(path.dirname(scopeManagerPath), 'ID.js');
  const { resetIds } = require(idPath);
  exports.resetIds = resetIds;
} catch (_e) {
  // noop if upstream layout changes
}
