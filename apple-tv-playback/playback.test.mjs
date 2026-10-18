import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./AppleTV.Playback.response.js', import.meta.url), 'utf8');
const moduleText = await readFile(new URL('./AppleTV.Playback.sgmodule', import.meta.url), 'utf8');
const script = new vm.Script(source);
const endpoint = 'https://uts-api.itunes.apple.com/uts/v3/movies/example?sf=143441&locale=en-US&caller=wlk';
const originalURL = 'https://play.itunes.apple.com/WebObjects/MZPlay.woa/playlist?token=a%2Fb%3D&sf=143441#start';
const aliasURL = originalURL.replace('play.itunes.apple.com', 'play-cdn.itunes.apple.com');

function run(body, { url = endpoint, method = 'GET', status = 200 } = {}) {
  const request = Object.freeze({ url, method, headers: Object.freeze({ 'X-Apple-Store-Front': '143441' }) });
  const response = Object.freeze({ body, status, headers: Object.freeze({ 'Content-Type': 'application/json' }) });
  const results = [];
  script.runInNewContext({
    $request: request, $response: response,
    $done: result => results.push(JSON.parse(JSON.stringify(result))),
    console: { log() { assert.fail('No runtime logging'); } },
  }, { timeout: 1000 });
  assert.equal(results.length, 1, 'Always finish exactly once');
  assert.equal(request.url, url);
  assert.equal(request.headers['X-Apple-Store-Front'], '143441');
  assert.equal(response.body, body);
  return results[0];
}

test('changes only hlsUrl hosts while preserving unrelated JSON bytes and signed URL data', () => {
  const body = `{
  "largeID": 900719925474099312345,
  "decimal": 1.23000e+2,
  "applicationProps": {"tabs":[{"type":"NewServerTab","subTabs":[]}]},
  "data": {"assets": {
    "hlsUrl": "${originalURL}",
    "fpsUrl": "${originalURL}",
    "licenseUrl": "${originalURL}"
  }, "offers": [{"hlsUrl":"https://play-edge.itunes.apple.com/a?signature=%2B%2F%3D"}]},
  "subtitles": [{"language":"zh-Hans","name":"简体中文","url":"https://hls.itunes.apple.com/zh.m3u8"}],
  "storefront": "143441", "locale": "en-US"
}`;
  const expected = body.replace(`"hlsUrl": "${originalURL}"`, `"hlsUrl": "${aliasURL}"`)
    .replace('"hlsUrl":"https://play-edge.itunes.apple.com/', '"hlsUrl":"https://play-edge-cdn.itunes.apple.com/');
  assert.deepEqual(run(body), { body: expected });
});

test('configurations, account/settings, UMC, other versions and host lookalikes pass through byte-for-byte', () => {
  const body = JSON.stringify({ applicationProps: { tabs: [] }, hlsUrl: originalURL });
  for (const url of [
    'https://uts-api.itunes.apple.com/uts/v3/configurations?caller=wlk',
    'https://uts-api.itunes.apple.com/uts/v3/configurations?caller=wta',
    'https://uts-api.itunes.apple.com/uts/v3/user/settings',
    'https://uts-api.itunes.apple.com/uts/v3/accounts',
    'https://umc-tempo-api.apple.com/v3/movies/example',
    'https://uts-api.itunes.apple.com/uts/v2/movies/example',
    'https://uts-api.itunes.apple.com/uts/v3/movies-extra/example',
    'https://uts-api.itunes.apple.com.example.org/uts/v3/movies/example',
    'https://uts-api.itunes.apple.com@other.example/uts/v3/movies/example',
    'https://music.apple.com/uts/v3/movies/example',
  ]) assert.deepEqual(run(body, { url }), {}, url);
});

test('only exact hosts in hlsUrl string values are aliased', () => {
  for (const url of [
    'https://play.itunes.apple.com.example.org/path',
    'https://play.itunes.apple.com@other.example/path',
    'https://play.itunes.apple.com:password@other.example/path',
    'https://play.itunes.apple.com:443@other.example/path',
    'https://other.example/?redirect=https://play.itunes.apple.com/path',
    'https://play-cdn.itunes.apple.com/path',
    'https://play-edge-cdn.itunes.apple.com/path',
    'https://vod-ap-aoc.tv.apple.com/path',
    'skd://play.itunes.apple.com/path',
    '/relative.m3u8',
  ]) assert.deepEqual(run(JSON.stringify({ hlsUrl: url })), {}, url);
  assert.deepEqual(run(JSON.stringify({ url: originalURL, fpsUrl: originalURL, licenseUrl: originalURL })), {});
});

test('handles escaped JSON keys and values without interpreting JSON embedded in strings', () => {
  const literalURL = JSON.stringify(originalURL).replaceAll('/', '\\/');
  const nestedText = JSON.stringify(JSON.stringify({ hlsUrl: originalURL }));
  const body = `{"text":${nestedText},"hls\\u0055rl" : ${literalURL},"label":"hlsUrl","other":"${originalURL}"}`;
  assert.deepEqual(run(body), { body: body.replace(literalURL, JSON.stringify(aliasURL)) });
});

test('non-string hlsUrl values do not prevent later or nested valid values being handled', () => {
  const body = JSON.stringify({
    items: [null, { hlsUrl: null }, { hlsUrl: 123 }, { hlsUrl: { hlsUrl: originalURL } },
      { hlsUrl: ['hlsUrl', originalURL, { hlsUrl: originalURL }] }, { hlsUrl: originalURL }],
  });
  const result = JSON.parse(run(body).body);
  assert.equal(result.items[3].hlsUrl.hlsUrl, aliasURL);
  assert.equal(result.items[4].hlsUrl[1], originalURL);
  assert.equal(result.items[4].hlsUrl[2].hlsUrl, aliasURL);
  assert.equal(result.items[5].hlsUrl, aliasURL);
});

test('whitespace, duplicate fields, and unknown metadata survive without reserialization', () => {
  const body = `{"id":1,"id":2, "hlsUrl"\n:\t"${originalURL}","hlsUrl":"${originalURL}", "future":"\\u2603"}`;
  assert.deepEqual(run(body), { body: body.replaceAll(originalURL, aliasURL) });
});

test('exact host case and explicit ports preserve the decoded URL path, query and fragment', () => {
  const url = 'https://PLAY-EDGE.itunes.apple.com:443/a%2Fb?b=2&a=1&a=3#x';
  const result = JSON.parse(run(JSON.stringify({ hlsUrl: url })).body);
  assert.equal(result.hlsUrl, 'https://play-edge-cdn.itunes.apple.com:443/a%2Fb?b=2&a=1&a=3#x');
});

test('invalid JSON, absent bodies and non-JSON bodies pass through rather than abort', () => {
  for (const body of [undefined, null, '', 'not JSON', '<html>failure</html>', '{"hlsUrl":',
    `{"hlsUrl":"${originalURL}",}`, new Uint8Array([1, 2]), '{"broken":"\\q"}']) {
    assert.deepEqual(run(body), {});
  }
});

test('non-success responses and non-GET requests remain untouched', () => {
  const body = JSON.stringify({ hlsUrl: originalURL });
  for (const status of [0, 204, 301, 304, 400, 401, 403, 500]) {
    assert.deepEqual(run(status === 204 ? '' : body, { status }), {});
  }
  for (const method of ['POST', 'HEAD', 'PUT', 'DELETE']) assert.deepEqual(run(body, { method }), {});
});

test('repeat processing is idempotent and unmodified responses return no replacement body', () => {
  const first = run(JSON.stringify({ hlsUrl: originalURL }));
  assert.deepEqual(run(first.body), {});
  for (const body of ['null', 'true', '123', '[]', '{}', '"hlsUrl"', '["hlsUrl","https://play.itunes.apple.com/a"]']) {
    assert.deepEqual(run(body), {});
  }
});

test('module and runtime agree on the six allowed content endpoints', () => {
  const declaration = moduleText.split('\n').find(line => line.includes('type=http-response'));
  const pattern = new RegExp(declaration.match(/, pattern=([^,]+),/)[1]);
  const body = JSON.stringify({ hlsUrl: originalURL });
  for (const kind of ['canvases', 'shelves', 'movies', 'shows', 'episodes', 'sporting-events']) {
    for (const suffix of ['', '?sf=143441', '/example?locale=en-US']) {
      const url = `https://uts-api.itunes.apple.com/uts/v3/${kind}${suffix}`;
      assert(pattern.test(url), url);
      assert.equal(JSON.parse(run(body, { url }).body).hlsUrl, aliasURL);
    }
  }
  for (const path of ['configurations', 'user/settings', 'accounts', 'moviesExtra']) {
    const url = `https://uts-api.itunes.apple.com/uts/v3/${path}`;
    assert(!pattern.test(url), url);
    assert.deepEqual(run(body, { url }), {});
  }
});

test('alias forwarding rules preserve the signed URL and do not match unrelated hosts', () => {
  const rules = moduleText.split('\n').filter(line => line.startsWith('^'));
  assert.equal(rules.length, 2);
  for (const rule of rules) {
    const [regex, replacement, type] = rule.split(' ');
    const pattern = new RegExp(regex);
    assert.equal(type, 'header');
    const host = replacement.includes('play-edge.') ? 'play-edge' : 'play';
    const original = `https://${host}.itunes.apple.com:443/a%2Fb?sig=%2F%2B%3D&sf=143441`;
    const alias = original.replace(`${host}.itunes`, `${host}-cdn.itunes`);
    assert.equal(alias.replace(pattern, replacement), original);
    assert(!pattern.test(`https://${host}-cdn.itunes.apple.com.example.org/a`));
    assert(!pattern.test(`https://${host}-cdn.itunes.apple.com@other.example/a`));
    assert(!pattern.test(`https://${host}-cdn.itunes.apple.com:password@other.example/a`));
    assert(!pattern.test(`https://${host}-cdn.itunes.apple.com:443@other.example/a`));
    assert(!pattern.test(original));
  }
});

test('module is self-contained, version-pinned and does not declare account, proxy, DNS or request changes', () => {
  const version = moduleText.match(/^#!version = (.+)$/m)[1];
  const remoteScript = moduleText.match(/script-path=([^\s,]+)/)[1];
  assert.equal(remoteScript, `https://github.com/LeoGray/Universal/releases/download/apple-tv-playback-v${version}/AppleTV.Playback.response.js`);
  assert.deepEqual([...moduleText.matchAll(/^\[([^\]]+)\]/gm)].map(match => match[1]), ['URL Rewrite', 'Script', 'MITM']);
  assert.equal(moduleText.split('\n').filter(line => line.includes('type=')).length, 1);
  assert(!moduleText.includes('type=http-request'));
  assert(!moduleText.includes('/configurations'));
  assert(!moduleText.includes('umc-tempo-api.apple.com'));
  assert.equal(moduleText.match(/^hostname = (.+)$/m)[1], '%APPEND% uts-api.itunes.apple.com, play-cdn.itunes.apple.com, play-edge-cdn.itunes.apple.com');
  assert(moduleText.includes('max-size=2097152'));
});
