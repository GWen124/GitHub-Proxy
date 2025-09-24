# GitHub Proxy

## 简介

GitHub 文件加速代理服务，支持 release、archive 以及项目文件的加速下载，基于 Cloudflare Workers 无服务器架构，专为 GitHub Pages 和 Cloudflare Pages 设计。


## 特性

- **无服务器架构** - 基于 Cloudflare Workers，无需维护服务器
- **全球 CDN 加速** - 利用 Cloudflare 全球网络，访问速度快
- **灵活访问控制** - 支持仓库白名单、黑名单、IP 过滤、User-Agent 检查、频率限制
- **智能回退机制** - 白名单仓库优先本代理，失败时切换 jsDelivr（可配置）
- **自动扩缩容** - 根据访问量自动调整资源
- **零成本部署** - 免费使用 Cloudflare Workers

## 使用方法

在 GitHub 文件 URL 前添加代理地址即可：

```
原地址：https://github.com/user/repo/archive/main.zip
代理后：https://your-proxy-domain.com/https://github.com/user/repo/archive/main.zip
```

### 支持的 URL 类型

- **分支源码**：`https://github.com/user/repo/archive/main.zip`
- **Release 源码**：`https://github.com/user/repo/archive/v1.0.0.tar.gz`
- **Release 文件**：`https://github.com/user/repo/releases/download/v1.0.0/file.zip`
- **分支文件**：`https://github.com/user/repo/blob/main/filename`
- **Commit 文件**：`https://github.com/user/repo/blob/commit-hash/filename`
- **Gist 文件**：`https://gist.githubusercontent.com/user/hash/raw/file`

> 注：本项目不提供私有仓库绕过功能。

### 前端页面

访问根路径即可使用搜索引擎式主页，输入 GitHub 链接生成加速地址，支持一键复制/打开，暗色模式自动适配。

## 部署方法

### Cloudflare Workers 部署

1. 访问 [Cloudflare Workers](https://workers.cloudflare.com)
2. 注册并登录，点击 `Start building`
3. 创建 Worker，复制 `script.js` 代码到编辑器
4. 根据注释配置开关（如 `JSDELIVR_GLOBAL_SWITCH`、`WHITELIST_CONFIG`）
5. 点击 `Save and deploy` 部署

### GitHub Pages 部署

1. Fork 本仓库到您的 GitHub 账户
2. 在仓库设置中启用 GitHub Pages
3. 选择 `index.html` 作为源文件（纯静态预览页面）
4. 访问 `https://your-username.github.io/gh-proxy` 即可使用

### 配置参数（在 `script.js` 顶部）

- `ASSET_URL`：静态资源 URL
- `PREFIX`：路径前缀，默认为 `/`，如果使用子路径如 `/gh/*`，则设置为 `/gh/`

### 白名单与防滥用

在 `script.js` 中修改白名单与安全策略：

```javascript
// 白名单配置
const WHITELIST_CONFIG = {
    enabled: true,                    // 是否启用白名单功能
    strictMode: true,                 // 严格模式：只允许白名单中的仓库
    rateLimitEnabled: true,           // 是否启用频率限制
    rateLimitRequests: 100,           // 每分钟最大请求数
    rateLimitWindow: 60,              // 时间窗口（秒）
    ipWhitelistEnabled: false,        // 是否启用IP白名单
    userAgentCheckEnabled: true,      // 是否检查User-Agent
    blockedUserAgents: [              // 禁止的User-Agent
        'curl', 'wget', 'python-requests', 'bot', 'spider', 'crawler'
    ],
    ipWhitelist: []                   // IP白名单
}

// 仓库白名单 - 只允许这些仓库被访问（以 / 结尾表示整个组织）
const whiteList = ['GWen124/','SuiYue124/']

### jsDelivr 回退策略

在 `script.js` 顶部配置：

```js
// 全局 jsDelivr 开关：
// true  -> 白名单仓库优先走本代理，失败自动切 jsDelivr；非白名单直接 jsDelivr
// false -> 所有仓库都走本代理（可能受 CF 限制，建议配合前端 HEAD 检测）
const JSDELIVR_GLOBAL_SWITCH = false
```

为本地/严格测试场景，此开关可设为 false（全部走本代理）。线上建议 true 保障可用性。
```




