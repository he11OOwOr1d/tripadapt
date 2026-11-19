const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

test('review retries use the same idempotency key and a bounded request signal', async () => {
  const exports = {}, calls = [], timeouts = [];
  const AbortSignal = { timeout(ms) { const signal = new AbortController().signal; signal.ms = ms; timeouts.push(signal); return signal; } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../lib/trips/proposals.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, AbortSignal, require: () => ({ accountRequest: async (url, options) => { calls.push({url, options}); return {data:{id:'review'}}; } }) });
  await exports.proposalAdapter.submit('trip', '"draft:v:3"', 'same-request');
  await exports.proposalAdapter.submit('trip', '"draft:v:3"', 'same-request');
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.url, '/trips/trip/draft/submit');
    assert.equal(call.options.headers['If-Match'], '"draft:v:3"');
    assert.equal(call.options.headers['Idempotency-Key'], 'same-request');
    assert.equal(call.options.signal.ms, 15000);
  }
  assert.equal(timeouts.length, 2);
});

test('a timeout also releases a review waiting for session lookup', async () => {
  const exports = {};
  const controller = new AbortController();
  const AbortSignal = { timeout() { return controller.signal; } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../lib/trips/proposals.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, AbortSignal, require: () => ({ accountRequest: () => new Promise(() => {}) }) });
  const pending = exports.proposalAdapter.submit('trip', 'etag', 'key');
  const reason = new Error('timed out'); reason.name = 'TimeoutError';
  controller.abort(reason);
  await assert.rejects(pending, error => error === reason);
});
