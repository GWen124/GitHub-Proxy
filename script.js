'use strict'

import { generateHomeHTML as UI_generateHomeHTML } from './index.js'

function generateHomeHTML(config, whitelist) {
    return UI_generateHomeHTML()
        .replace(/__CFG_ENABLED__/g, String(config.enabled))
        .replace(/__CFG_STRICT__/g, String(config.strictMode))
        .replace(/__CFG_JSDELIVR__/g, String(config.jsDelivr))
        .replace(/__WL__/g, JSON.stringify(whitelist))
}

// ===== 手动配置区（部署前可按需修改）*****
// 静态资源/默认域名，用于本地测试
const ASSET_URL = 'https://cdn.gw124.top'
// 反向代理前缀（一般保持 '/' 即可）
const PREFIX = '/'

function makeResponse(body, status = 200, headers = {}) { headers['access-control-allow-origin'] = '*'; return new Response(body, { status, headers }) }

const exp1=/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i
const exp2=/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i
const exp3=/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i
const exp4=/^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i
const exp5=/^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i
const exp6=/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i

function checkUrl(url){ for(let exp of [exp1,exp2,exp3,exp4,exp5,exp6]){ if(url.search(exp)===0) return true } return false }

async function proxy(urlObj,reqInit){ const res=await fetch(urlObj.href,reqInit); const hdr=new Headers(res.headers); const status=res.status; if(hdr.has('location')){ let loc=hdr.get('location'); if(checkUrl(loc)) hdr.set('location',PREFIX+loc); else { reqInit.redirect='follow'; return proxy(new URL(loc),reqInit) } } hdr.set('access-control-expose-headers','*'); hdr.set('access-control-allow-origin','*'); hdr.set('x-proxy-source','local'); hdr.delete('content-security-policy'); hdr.delete('content-security-policy-report-only'); hdr.delete('clear-site-data'); return new Response(res.body,{status,headers:hdr}) }

function isProxyResponseValid(response){ if(response.status>=400) return false; const ct=response.headers.get('content-type')||''; if(response.status===200 && ct.includes('text/html')) return false; return true }
function convertRawToJsDelivrUrl(rawUrl){ const m=rawUrl.match(/^https?:\/\/raw\.(?:githubusercontent|github)\.com\/([^\/]+)\/([^\/]+)\/(.+?)\/(.+)$/); if(!m) return rawUrl; let branch=m[3]; const r=branch.match(/^refs\/heads\/([^\/]+)$/); if(r) branch=r[1]; return `https://cdn.jsdelivr.net/gh/${m[1]}/${m[2]}@${branch}/${m[4]}` }

async function httpHandler(req,pathname){ const reqHdrRaw=req.headers; if(req.method==='OPTIONS' && reqHdrRaw.has('access-control-request-headers')) return new Response(null,{status:204,headers:new Headers({'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS','access-control-max-age':'1728000'})}); const reqHdrNew=new Headers(reqHdrRaw); let urlStr=pathname; urlStr=urlStr.replace(/^@+/, ''); urlStr=urlStr.replace(/^https?:\/\/https?:\/:\//,'https://'); if(urlStr.search(/^https?:\/\//)!==0) urlStr='https://'+urlStr; const urlObj=new URL(urlStr); const reqInit={method:req.method,headers:reqHdrNew,redirect:'manual',body:req.body}; return proxy(urlObj,reqInit) }

async function handleWhitelistWithFallback(req,path){ try{ const modified=path.replace('/blob/','/raw/'); const resp=await httpHandler(req,modified); if(isProxyResponseValid(resp)) return resp; let to; if(/^https?:\/\/raw\.(?:githubusercontent|github)\.com\//.test(path)) to=convertRawToJsDelivrUrl(path); else to=path.replace('/blob/','@').replace(/^(?:https?:\/\/)?github\.com/,'https://cdn.jsdelivr.net/gh'); const h=new Headers({ 'location': to, 'access-control-allow-origin':'*', 'access-control-expose-headers':'*', 'x-proxy-source':'jsdelivr' }); return new Response(null,{status:302,headers:h}) } catch{ let to; if(/^https?:\/\/raw\.(?:githubusercontent|github)\.com\//.test(path)) to=convertRawToJsDelivrUrl(path); else to=path.replace('/blob/','@').replace(/^(?:https?:\/\/)?github\.com/,'https://cdn.jsdelivr.net/gh'); const h=new Headers({ 'location': to, 'access-control-allow-origin':'*', 'access-control-expose-headers':'*', 'x-proxy-source':'jsdelivr' }); return new Response(null,{status:302,headers:h}) } }
async function handleRawGitHubUrl(req,path){ return handleWhitelistWithFallback(req,path) }

async function fetchHandler(e){ const req=e.request; const urlObj=new URL(req.url);
  if (urlObj.pathname === PREFIX + 'config') { const data = { enabled: false, strictMode: false, jsDelivr: false, whiteList: [] }; return makeResponse(JSON.stringify(data), 200, { 'content-type': 'application/json; charset=utf-8' }); }
  let path=urlObj.searchParams.get('q'); if(path) return Response.redirect('https://'+urlObj.host+PREFIX+path,301); path=urlObj.href.substr(urlObj.origin.length+PREFIX.length).replace(/^https?:\/+/, 'https://'); path=path.replace(/^@+/, ''); path=path.replace(/^https?:\/\/https?:\/:\//,'https://'); if(path===''||path==='/'||path===urlObj.origin+'/'){ const html=generateHomeHTML({enabled:false,strictMode:false,jsDelivr:false},[]); return makeResponse(html,200,{'content-type':'text/html; charset=utf-8'}) } if(path.search(exp1)===0 || path.search(exp5)===0 || path.search(exp6)===0 || path.search(exp3)===0) return httpHandler(req,path); else if(path.search(exp2)===0){ return handleWhitelistWithFallback(req,path) } else if(path.search(exp4)===0) return handleRawGitHubUrl(req,path); else { const html=generateHomeHTML({enabled:false,strictMode:false,jsDelivr:false},[]); return makeResponse(html,200,{'content-type':'text/html; charset=utf-8'}) } }

addEventListener('fetch', e=>{ const ret=fetchHandler(e).catch(err=>makeResponse(`GitHub-Proxy Error: ${err.message}`,502)); e.respondWith(ret) })

export default null


