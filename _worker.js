'use strict'

// Prefix（如需子路径路由，例如 /gh/*，将其改为 '/gh/'）
const PREFIX = '/'

function makeResponse(body, status = 200, headers = {}) {
  headers['access-control-allow-origin'] = '*'
  return new Response(body, { status, headers })
}

// 规则集
const exp1 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i
const exp2 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i
const exp3 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*/i
const exp4 = /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i
const exp5 = /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i
const exp6 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*/i

function checkUrl(u) { for (let i of [exp1,exp2,exp3,exp4,exp5,exp6]) { if (u.search(i) === 0) return true } return false }

async function proxy(urlObj, reqInit) {
  const res = await fetch(urlObj.href, reqInit)
  const resHdrOld = res.headers
  const resHdrNew = new Headers(resHdrOld)
  const status = res.status

  if (resHdrNew.has('location')) {
    let loc = resHdrNew.get('location')
    if (checkUrl(loc)) resHdrNew.set('location', PREFIX + loc)
    else { reqInit.redirect = 'follow'; return proxy(new URL(loc), reqInit) }
  }

  resHdrNew.set('access-control-expose-headers', '*')
  resHdrNew.set('access-control-allow-origin', '*')
  resHdrNew.delete('content-security-policy')
  resHdrNew.delete('content-security-policy-report-only')
  resHdrNew.delete('clear-site-data')
  return new Response(res.body, { status, headers: resHdrNew })
}

function isProxyResponseValid(response) {
  if (response.status >= 400) return false
  const ct = response.headers.get('content-type') || ''
  if (response.status === 200 && ct.includes('text/html')) return false
  return true
}

function convertRawToJsDelivrUrl(rawUrl) {
  const m = rawUrl.match(/^https?:\/\/raw\.(?:githubusercontent|github)\.com\/([^\/]+)\/([^\/]+)\/(.+?)\/(.+)$/)
  if (!m) return rawUrl
  let branch = m[3]
  const r = branch.match(/^refs\/heads\/([^\/]+)$/)
  if (r) branch = r[1]
  return `https://cdn.jsdelivr.net/gh/${m[1]}/${m[2]}@${branch}/${m[4]}`
}

async function httpHandler(req, pathname) {
  const reqHdrRaw = req.headers
  if (req.method === 'OPTIONS' && reqHdrRaw.has('access-control-request-headers')) {
    return new Response(null, { status: 204, headers: new Headers({
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
      'access-control-max-age': '1728000',
    }) })
  }
  const reqHdrNew = new Headers(reqHdrRaw)
  let urlStr = pathname
  urlStr = urlStr.replace(/^@+/, '')
  urlStr = urlStr.replace(/^https?:\/\/https?:\/:\//, 'https://')
  if (urlStr.search(/^https?:\/\//) !== 0) urlStr = 'https://' + urlStr
  const urlObj = new URL(urlStr)
  const reqInit = { method: req.method, headers: reqHdrNew, redirect: 'manual', body: req.body }
  return proxy(urlObj, reqInit)
}

async function handleWhitelistWithFallback(req, path) {
  try {
    const modified = path.replace('/blob/', '/raw/')
    const resp = await httpHandler(req, modified)
    if (isProxyResponseValid(resp)) return resp
    let to
    if (/^https?:\/\/raw\.(?:githubusercontent|github)\.com\//.test(path)) to = convertRawToJsDelivrUrl(path)
    else to = path.replace('/blob/', '@').replace(/^(?:https?:\/\/)?github\.com/, 'https://cdn.jsdelivr.net/gh')
    const h = new Headers({ 'location': to, 'access-control-allow-origin': '*', 'access-control-expose-headers': '*' })
    return new Response(null, { status: 302, headers: h })
  } catch {
    let to
    if (/^https?:\/\/raw\.(?:githubusercontent|github)\.com\//.test(path)) to = convertRawToJsDelivrUrl(path)
    else to = path.replace('/blob/', '@').replace(/^(?:https?:\/\/)?github\.com/, 'https://cdn.jsdelivr.net/gh')
    const h = new Headers({ 'location': to, 'access-control-allow-origin': '*', 'access-control-expose-headers': '*' })
    return new Response(null, { status: 302, headers: h })
  }
}

// ===== 配置加载（从同源 /config.json 读取，带简单缓存）
let _cfgCache = null; let _cfgAt = 0;
async function loadConfig(env, urlObj){
  const now = Date.now();
  if (_cfgCache && (now - _cfgAt) < 60000) return _cfgCache;
  try {
    const cfgReq = new Request(new URL('/config.json', urlObj.origin).toString(), { method: 'GET' });
    const res = await env.ASSETS.fetch(cfgReq);
    if (res.ok) { _cfgCache = await res.json(); _cfgAt = now; return _cfgCache; }
  } catch(_){ }
  _cfgCache = { enabled: false, strictMode: false, jsDelivr: true, whiteList: [] };
  _cfgAt = now; return _cfgCache;
}

function isWhitelisted(path, whiteList){
  if (!Array.isArray(whiteList) || whiteList.length === 0) return false;
  try{
    // raw.githubusercontent.com/{owner}/{repo}/...
    const mRaw = path.match(/raw\.(?:githubusercontent|github)\.com\/([^\/]+)\/([^\/]+)\//);
    if (mRaw) {
      const owner = mRaw[1]; const repo = mRaw[2];
      return whiteList.some(w=> w.endsWith('/') ? (path.includes(`/${w.slice(0,-1)}/`)) : (path.includes(`/${owner}/${repo}/`) || path.includes(`/${owner}/${repo}@`)) );
    }
    // github.com/{owner}/{repo}/...
    const mGh = path.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (mGh) {
      const owner = mGh[1]; const repo = mGh[2];
      return whiteList.some(w=> w.endsWith('/') ? (path.includes(`/${w.slice(0,-1)}/`)) : (path.includes(`/${owner}/${repo}/`) || path.includes(`/${owner}/${repo}@`)) );
    }
  }catch(_){ }
  return false;
}

async function fetchHandler(request, env) {
  const req = request
  const urlObj = new URL(req.url)
  const cfg = await loadConfig(env, urlObj)

  // 仅处理代理路径，其它仍交给 Pages 静态资源
  let path = urlObj.searchParams.get('q')
  if (path) return Response.redirect('https://' + urlObj.host + PREFIX + path, 301)
  path = urlObj.href.substr(urlObj.origin.length + PREFIX.length).replace(/^https?:\/+/, 'https://')
  path = path.replace(/^@+/, '')
  path = path.replace(/^https?:\/\/https?:\/:\//, 'https://')

  if (path.search(exp1) === 0 || path.search(exp5) === 0 || path.search(exp6) === 0 || path.search(exp3) === 0) {
    if (cfg.enabled && cfg.strictMode && !isWhitelisted(path, cfg.whiteList)) {
      return makeResponse('403 Forbidden: Repository not in whitelist', 403, { 'content-type': 'text/plain; charset=utf-8' })
    }
    return httpHandler(req, path)
  } else if (path.search(exp2) === 0) {
    if (cfg.enabled && cfg.strictMode && !isWhitelisted(path, cfg.whiteList)) {
      return makeResponse('403 Forbidden: Repository not in whitelist', 403, { 'content-type': 'text/plain; charset=utf-8' })
    }
    // 严格模式下白名单通过才尝试代理并回退；否则直接拒绝
    return handleWhitelistWithFallback(req, path)
  } else if (path.search(exp4) === 0) {
    if (cfg.enabled && cfg.strictMode && !isWhitelisted(path, cfg.whiteList)) {
      return makeResponse('403 Forbidden: Repository not in whitelist', 403, { 'content-type': 'text/plain; charset=utf-8' })
    }
    return handleWhitelistWithFallback(req, path)
  } else {
    // 非代理路径：交给 Pages 静态资源
    return env.ASSETS.fetch(req)
  }
}

export default {
  async fetch(request, env, ctx) {
    try { return await fetchHandler(request, env) }
    catch (err) { return makeResponse(`GitHub-Proxy Error: ${err.message}`, 502) }
  }
}


