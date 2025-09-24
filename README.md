# GitHub Proxy

基于 Cloudflare Pages Functions 的 GitHub 文件代理，支持 release、archive、raw/blob、gist 等链接的一键加速与智能回退。

## 特性
- **零后端维护**：使用 Pages Functions（`_worker.js`），同仓库提交即自动部署
- **统一配置源**：支持 Cloudflare Pages 环境变量或同源 `config.json`（字段完全一致，推荐使用环境变量）
- **白名单与严格模式**：仅允许指定组织/仓库走本代理；非白名单可选择回退或直接拒绝
- **智能回退**：代理失败时后端回退 jsDelivr；前端生成前也会做 HEAD 探测并优先切换
- **前端易用**：主页输入链接即生成代理/回退地址，支持复制、打开

## 快速开始
1) 部署到 Cloudflare Pages（推荐）
- 仓库包含：`index.html`、`_worker.js`（Functions 入口）、`config.json`（可选）
- Pages → Create application → 连接 GitHub 仓库 → Build command 留空、Output directory `/`
- Settings → Functions 默认开启
- 绑定自定义域名（可选）

2) 可选：设置环境变量（覆盖 config.json）
- ASSET_URL：你的代理基础域名（例如 `https://cdn.gw124.top`）
- ENABLED：是否启用策略开关（true/false）
- STRICT_MODE：严格白名单（true/false）
- JSDELIVR：允许回退 jsDelivr（true/false）
- WHITE_LIST：白名单，JSON 数组或逗号分隔字符串（如 `GWen124/,SuiYue124/,owner/repo`）

3) 直接使用
- 原链接：`https://github.com/user/repo/archive/main.zip`
- 代理：`https://你的域名/https://github.com/user/repo/archive/main.zip`

支持的 URL：release、archive、blob/raw、gist、tags、git-*

> 注：不提供私有仓库绕过能力。

## 配置说明（环境变量与 config.json 字段完全一致）
```json
{
  "ASSET_URL": "https://cdn.gw124.top",
  "ENABLED": true,
  "STRICT_MODE": true,
  "JSDELIVR": true,
  "WHITE_LIST": ["GWen124/", "SuiYue124/"]
}
```
- 以 `/` 结尾表示整个组织/用户；不以 `/` 结尾表示具体仓库
- 严格模式开启时：非白名单将直接 403 拒绝（后端强制）；前端也不会生成链接
- 非严格模式：非白名单也会尝试代理，失败回退 jsDelivr

## 工作机制
- 前端：从 `/config.json` 读取配置（或你也可以改为调用后端 `/config` 返回的同款配置）；生成链接前先对代理地址做 HEAD 探测，不可用则直接显示 jsDelivr
- 后端：
  - 命中 GitHub 规则 → 代理；`blob` 自动转 `raw` 重试；必要时回退 jsDelivr
  - 严格模式 + 非白名单 → 直接 403
  - 非代理路径 → 交给 Pages 静态资源（`env.ASSETS.fetch`）

## 迁移与拓展
- 仅静态托管（GitHub Pages）：页面可用，代理需指向你的 Worker/Pages Functions 域名
- 切换子路径路由：修改 `_worker.js` 中 `PREFIX`（例如 `/gh/`）并在域名路由上匹配对应前缀

## 免责声明
本项目仅用于公共开源内容的加速访问。请勿用于违规用途；使用造成的风险由使用者自负。




