const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function adapter(fetch, configured = true) {
  const exports = {};
  const file = path.resolve(__dirname, '../lib/trips/place-search.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, fetch, AbortSignal, Error, encodeURIComponent, process: { env: configured ? { NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000/api/v1/' } : {} } });
  return exports.placeSearchAdapter;
}
test('public place lookup encodes the query and sends no account credentials', async () => {
  let request;
  const lookup = adapter(async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ data: { results: [{ name: 'Kyoto', timezone: 'Asia/Tokyo' }], source: 'Open-Meteo / GeoNames' } }) }; });
  const result = await lookup.search(' Kyoto & Japan ', new AbortController().signal);
  assert.equal(request.url, 'http://localhost:8000/api/v1/destinations/search?q=Kyoto%20%26%20Japan');
  assert.equal(request.options.credentials, 'omit');
  assert.equal(request.options.cache, 'no-store');
  assert.equal(result.results[0].timezone, 'Asia/Tokyo');
});
test('unconfigured search never calls a provider and keeps manual entry available', async () => {
  let called = false;
  await assert.rejects(adapter(async () => { called = true; }, false).search('Kyoto', new AbortController().signal), /manually/);
  assert.equal(called, false);
});
test('rate limits expose a useful retry message instead of invented results', async () => {
  await assert.rejects(adapter(async () => ({ ok: false, status: 429 })).search('Kyoto', new AbortController().signal), /Wait a minute/);
});
test('network failures explain the manual fallback without exposing transport details', async () => {
  await assert.rejects(adapter(async () => { throw new Error('internal private failure'); }).search('Kyoto', new AbortController().signal), /timezone manually/);
});
