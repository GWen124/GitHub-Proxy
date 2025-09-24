'use strict'

import { generateHomeHTML as UI_generateHomeHTML } from './index.js'

function generateHomeHTML(config, whitelist) {
    return UI_generateHomeHTML()
        .replace(/__CFG_ENABLED__/g, String(config.enabled))
        .replace(/__CFG_STRICT__/g, String(config.strictMode))
        .replace(/__CFG_JSDELIVR__/g, String(config.jsDelivr))
        .replace(/__WL__/g, JSON.stringify(whitelist))
}

// ===== 手动配置区（部署前可按需修改）=====
// 静态资源/默认域名（本地预览用；Workers 中仅用于前端展示）
const ASSET_URL = 'https://cdn.gw124.top'
// 反向代理前缀（一般保持 '/' 即可）
const PREFIX = '/'
// 全局 jsDelivr 开关：
// true  -> 白名单仓库优先走本代理，失败自动切 jsDelivr；非白名单直接 jsDelivr
// false -> 所有仓库都走本代理（可能受 Cloudflare 限制，建议配合前端 HEAD 检测）
const JSDELIVR_GLOBAL_SWITCH = false

// 白名单与防滥用总开关（建议保持开启）
const WHITELIST_CONFIG = {
    // 开关：是否启用白名单校验
    enabled: true,
    // 严格模式：仅允许白名单仓库
    strictMode: true,
    // 频率限制（按 IP 简单计数，Workers 内存级，重启/热更新会清空）
    rateLimitEnabled: true,
    rateLimitRequests: 100,
    rateLimitWindow: 60,
    // IP 白名单：需要精确控制来源时开启并填写 ipWhitelist
    ipWhitelistEnabled: false,
    // UA 黑名单：拦截常见抓取工具与脚本
    userAgentCheckEnabled: true,
    blockedUserAgents: ['curl','wget','python-requests','bot','spider','crawler','scraper','automated','test','monitor','scanner','probe'],
    // IP 白名单列表，支持单 IP 或 CIDR（如 '192.168.1.0/24'）
    ipWhitelist: []
}

// 仓库黑名单（默认关闭）。
// 用于临时封禁违反规则的仓库或组织。示例：['baduser/','baduser/badrepo']
const REPOSITORY_BLACKLIST_CONFIG = { enabled: false, repositories: [] }

// 关键字过滤（默认关闭）。
// - allowKeywords: 必须包含其一才允许
// - blockKeywords: 包含即拒绝
const KEYWORD_FILTER_CONFIG = { enabled: false, allowKeywords: [], blockKeywords: [] }

// 白名单仓库/组织（严格模式下仅允许这些）。
// 规则：以 '/' 结尾表示整个人/组织所有仓库；否则为精确仓库名。
// 示例：'user/' 允许 user 下所有仓库；'user/repo' 仅允许该仓库
const whiteList = [
    'GWen124/','SuiYue124/'
]

function makeResponse(body, status = 200, headers = {}) { headers['access-control-allow-origin'] = '*'; return new Response(body, { status, headers }) }

function getClientIP(request) { const a=request.headers.get('CF-Connecting-IP'); const b=request.headers.get('X-Forwarded-For'); const c=request.headers.get('X-Real-IP'); return a || b?.split(',')[0]?.trim() || c || 'unknown' }
function checkIPWhitelist(ip) { if (!WHITELIST_CONFIG.ipWhitelistEnabled || WHITELIST_CONFIG.ipWhitelist.length===0) return true; for (const allowed of WHITELIST_CONFIG.ipWhitelist){ if (allowed.includes('/')){ const [n,p]=allowed.split('/'); if (isIPInCIDR(ip,n,parseInt(p))) return true } else if (ip===allowed) return true } return false }
function isIPInCIDR(ip,network,prefix){ const i=ip.split('.').map(Number), n=network.split('.').map(Number); if(i.length!==4||n.length!==4) return false; const mask=(0xffffffff << (32-prefix))>>>0; const inum=(i[0]<<24)|(i[1]<<16)|(i[2]<<8)|i[3]; const nnum=(n[0]<<24)|(n[1]<<16)|(n[2]<<8)|n[3]; return (inum & mask)===(nnum & mask) }
function checkUserAgent(request){ if(!WHITELIST_CONFIG.userAgentCheckEnabled) return true; const ua=(request.headers.get('User-Agent')||'').toLowerCase(); return !WHITELIST_CONFIG.blockedUserAgents.some(b=>ua.includes(b.toLowerCase())) }

const rateLimitStorage = new Map()
function checkRateLimit(ip){ if(!WHITELIST_CONFIG.rateLimitEnabled) return true; const now=Date.now()/1000; const win=now-WHITELIST_CONFIG.rateLimitWindow; let reqs=rateLimitStorage.get(ip)||[]; reqs=reqs.filter(t=>t>win); if(reqs.length>=WHITELIST_CONFIG.rateLimitRequests) return false; reqs.push(now); rateLimitStorage.set(ip,reqs); return true }

function extractRepositoryFromUrl(url){ let m=url.match(/github\.com\/([^\/]+\/[^\/]+)/); if(m) return m[1]; m=url.match(/raw\.(?:githubusercontent|github)\.com\/([^\/]+)\/([^\/]+)/); if(m) return `${m[1]}/${m[2]}`; return null }
function checkRepositoryWhitelist(url){ if(!WHITELIST_CONFIG.enabled) return true; const repo=extractRepositoryFromUrl(url); if(!repo) return false; if(WHITELIST_CONFIG.strictMode){ for(const allowed of whiteList){ if(allowed.endsWith('/')){ if(repo.startsWith(allowed.slice(0,-1))) return true } else if(repo===allowed) return true } return false } return true }
function checkRepositoryBlacklist(url){ if(!REPOSITORY_BLACKLIST_CONFIG.enabled) return {allowed:true,reason:'仓库黑名单未启用'}; const repo=extractRepositoryFromUrl(url); if(!repo) return {allowed:true,reason:'无法提取仓库信息'}; for(const b of REPOSITORY_BLACKLIST_CONFIG.repositories){ if(b.endsWith('/')){ const u=b.slice(0,-1); if(repo.startsWith(u+'/')) return {allowed:false,reason:`仓库在黑名单中: ${b}`} } else if(repo===b) return {allowed:false,reason:`仓库在黑名单中: ${b}`} } return {allowed:true,reason:'通过仓库黑名单检查'} }
function checkKeywordFilter(path){ if(!KEYWORD_FILTER_CONFIG.enabled) return {allowed:true,reason:'关键字过滤未启用'}; const u=path.toLowerCase(); for(const k of KEYWORD_FILTER_CONFIG.blockKeywords){ if(u.includes(k.toLowerCase())) return {allowed:false,reason:`包含禁止关键字: ${k}`} } if(KEYWORD_FILTER_CONFIG.allowKeywords.length>0){ const ok=KEYWORD_FILTER_CONFIG.allowKeywords.some(k=>u.includes(k.toLowerCase())); if(!ok) return {allowed:false,reason:`不包含允许关键字: ${KEYWORD_FILTER_CONFIG.allowKeywords.join(', ')}`} } return {allowed:true,reason:'通过关键字过滤检查'} }

function securityCheck(request,url){ if(!WHITELIST_CONFIG.enabled) return null; const ip=getClientIP(request); const checks=[{check:()=>checkIPWhitelist(ip),message:'IP not in whitelist'},{check:()=>checkUserAgent(request),message:'User-Agent blocked'},{check:()=>checkRateLimit(ip),message:'Rate limit exceeded. Please try again later.',status:429},{check:()=>checkKeywordFilter(url),message:'keyword filter'},{check:()=>checkRepositoryBlacklist(url),message:'repository blacklist'},{check:()=>checkRepositoryWhitelist(url),message:'Repository not in whitelist'}]; for(const {check,message,status=403} of checks){ const r=check(); if(r===false) return makeResponse(`Access denied: ${message}`,status); else if(r && typeof r==='object' && !r.allowed) return makeResponse(`Access denied: ${r.reason}`,status) } return null }

const exp1=/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i
const exp2=/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i
const exp3=/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i
const exp4=/^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i
const exp5=/^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i
const exp6=/^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i

function checkUrl(url){ for(let exp of [exp1,exp2,exp3,exp4,exp5,exp6]){ if(url.search(exp)===0) return true } return false }

async function proxy(urlObj,reqInit){ const res=await fetch(urlObj.href,reqInit); const hdr=new Headers(res.headers); const status=res.status; if(hdr.has('location')){ let loc=hdr.get('location'); if(checkUrl(loc)) hdr.set('location',PREFIX+loc); else { reqInit.redirect='follow'; return proxy(new URL(loc),reqInit) } } hdr.set('access-control-expose-headers','*'); hdr.set('access-control-allow-origin','*'); hdr.delete('content-security-policy'); hdr.delete('content-security-policy-report-only'); hdr.delete('clear-site-data'); return new Response(res.body,{status,headers:hdr}) }

function isProxyResponseValid(response){ if(response.status>=400) return false; const ct=response.headers.get('content-type')||''; if(ct.includes('text/html')) return false; const cl=response.headers.get('content-length'); if(cl && parseInt(cl)<100) return false; return true }
function convertRawToJsDelivrUrl(rawUrl){ const m=rawUrl.match(/^https?:\/\/raw\.(?:githubusercontent|github)\.com\/([^\/]+)\/([^\/]+)\/(.+?)\/(.+)$/); if(!m) return rawUrl; let branch=m[3]; const r=branch.match(/^refs\/heads\/([^\/]+)$/); if(r) branch=r[1]; return `https://cdn.jsdelivr.net/gh/${m[1]}/${m[2]}@${branch}/${m[4]}` }

async function httpHandler(req,pathname){ const reqHdrRaw=req.headers; if(req.method==='OPTIONS' && reqHdrRaw.has('access-control-request-headers')) return new Response(null,{status:204,headers:new Headers({'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS','access-control-max-age':'1728000'})}); const reqHdrNew=new Headers(reqHdrRaw); let urlStr=pathname; if(urlStr.search(/^https?:\/\//)!==0) urlStr='https://'+urlStr; const sec=securityCheck(req,urlStr); if(sec) return sec; const urlObj=new URL(urlStr); const reqInit={method:req.method,headers:reqHdrNew,redirect:'manual',body:req.body}; return proxy(urlObj,reqInit) }

async function handleWhitelistWithFallback(req,path){ try{ const modified=path.replace('/blob/','/raw/'); const resp=await httpHandler(req,modified); if(isProxyResponseValid(resp)) return resp; let to; if(/^https?:\/\/raw\.(?:githubusercontent|github)\.com\//.test(path)) to=convertRawToJsDelivrUrl(path); else to=path.replace('/blob/','@').replace(/^(?:https?:\/\/)?github\.com/,'https://cdn.jsdelivr.net/gh'); return Response.redirect(to,302) } catch{ let to; if(/^https?:\/\/raw\.(?:githubusercontent|github)\.com\//.test(path)) to=convertRawToJsDelivrUrl(path); else to=path.replace('/blob/','@').replace(/^(?:https?:\/\/)?github\.com/,'https://cdn.jsdelivr.net/gh'); return Response.redirect(to,302) } }

async function handleRawGitHubUrl(req,path){ const isWL=checkRepositoryWhitelist(path); if(JSDELIVR_GLOBAL_SWITCH){ if(isWL) return handleWhitelistWithFallback(req,path); const to=convertRawToJsDelivrUrl(path); return Response.redirect(to,302) } else { // 全走本代理
  return httpHandler(req,path)
} }

async function fetchHandler(e){ const req=e.request; const urlObj=new URL(req.url);
  // 提供实时配置同步接口
  if (urlObj.pathname === PREFIX + 'config') {
    const data = { enabled: WHITELIST_CONFIG.enabled, strictMode: WHITELIST_CONFIG.strictMode, jsDelivr: JSDELIVR_GLOBAL_SWITCH, whiteList };
    return makeResponse(JSON.stringify(data), 200, { 'content-type': 'application/json; charset=utf-8' });
  }
  let path=urlObj.searchParams.get('q'); if(path) return Response.redirect('https://'+urlObj.host+PREFIX+path,301); path=urlObj.href.substr(urlObj.origin.length+PREFIX.length).replace(/^https?:\/+/, 'https://'); if(path===''||path==='/'||path===urlObj.origin+'/'){ const html=generateHomeHTML({enabled:WHITELIST_CONFIG.enabled,strictMode:WHITELIST_CONFIG.strictMode,jsDelivr:JSDELIVR_GLOBAL_SWITCH},whiteList); return makeResponse(html,200,{'content-type':'text/html; charset=utf-8'}) } if(path.search(exp1)===0 || path.search(exp5)===0 || path.search(exp6)===0 || path.search(exp3)===0) return httpHandler(req,path); else if(path.search(exp2)===0){ const isWL=checkRepositoryWhitelist(path); if(JSDELIVR_GLOBAL_SWITCH){ if(isWL) return handleWhitelistWithFallback(req,path); const to=path.replace('/blob/','@').replace(/^(?:https?:\/\/)?github\.com/,'https://cdn.jsdelivr.net/gh'); return Response.redirect(to,302) } else { path=path.replace('/blob/','/raw/'); return httpHandler(req,path) } } else if(path.search(exp4)===0) return handleRawGitHubUrl(req,path); else { const html=generateHomeHTML({enabled:WHITELIST_CONFIG.enabled,strictMode:WHITELIST_CONFIG.strictMode,jsDelivr:JSDELIVR_GLOBAL_SWITCH},whiteList); return makeResponse(html,200,{'content-type':'text/html; charset=utf-8'}) } }

addEventListener('fetch', e=>{ const ret=fetchHandler(e).catch(err=>makeResponse(`GitHub-Proxy Error: ${err.message}`,502)); e.respondWith(ret) })

export default null


