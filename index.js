'use strict'

// 仅负责输出前端页面 HTML 模板
export function generateHomeHTML() {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Proxy</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #202124; }
        .wrap { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; padding: 0 16px; }
        .hero { position: fixed; left: 50%; top: 32vh; transform: translate(-50%, -50%); width: 100%; max-width: 860px; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 0 8px; }
        .logo { font-size: 42px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 28px; }
        .logo .accent { color: #1a73e8; }
        .search { width: 100%; max-width: 680px; display: flex; gap: 10px; }
        .search input { flex: 1; height: 48px; padding: 0 16px; border: 1px solid #dadce0; border-radius: 24px; font-size: 16px; outline: none; }
        .search input:focus { box-shadow: 0 1px 6px rgba(32,33,36,.28); border-color: transparent; }
        .search button { height: 48px; padding: 0 18px; border: none; background: #1a73e8; color: #fff; border-radius: 24px; cursor: pointer; font-size: 14px; }
        .search button:hover { background: #1765cc; }
        .result { margin-top: 20px; width: 100%; max-width: 680px; font-family: monospace; word-break: break-all; }
        .result-fixed { position: fixed; left: 50%; transform: translateX(-50%); top: calc(32vh + 120px); width: 100%; max-width: 680px; padding: 0; }
        .result-card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; background: #fafafa; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.04); }
        .result-card .url-line { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 13px; line-height: 1.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .result-card .note { color: #5f6368; font-size: 12px; margin-top: 8px; display: flex; gap: 8px; align-items: center; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; line-height: 1.4; }
        .badge.success { background: #e8f5e9; color: #1e8e3e; border: 1px solid #c8e6c9; }
        .badge.warn { background: #fff4e5; color: #b06a00; border: 1px solid #ffe0b2; }
        .result-card .actions { margin-top: 10px; display: flex; gap: 8px; }
        .result-card .actions .push-right { margin-left: auto; }
        .btn-copy { height: 36px; padding: 0 14px; border: 1px solid #dadce0; background: #fff; color: #202124; border-radius: 10px; cursor: pointer; font-size: 13px; }
        .btn-copy:hover { background: #f3f4f6; }
        .toast { position: fixed; right: 16px; top: 16px; background: #202124; color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 12px; opacity: 0; transform: translateY(-6px); transition: all .2s ease; pointer-events: none; }
        .toast.show { opacity: 1; transform: translateY(0); }
        @media (prefers-color-scheme: dark) {
          body { background: #fff; color: #202124; }
          .search input { border-color: #2d333b; background: #0f1115; color: #e5e7eb; }
          .search input:focus { box-shadow: 0 1px 6px rgba(0,0,0,.5); }
          .result-card { background: #121721; border-color: #283042; box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 4px 12px rgba(0,0,0,.2); }
          .btn-copy { background: #0f1115; color: #e5e7eb; border-color: #2d333b; }
          .btn-copy:hover { background: #1b1f2a; }
          .footer .footer-line, .footer .link-green { color: #e5e7eb; }
        }
        .tip { margin-top: 16px; color: #5f6368; font-size: 12px; }
        .footer { position: fixed; bottom: 10px; left: 0; right: 0; text-align: center; color: #5f6368; font-size: 12px; }
        .footer .footer-line { color: #000; font-size: 12px; letter-spacing: 0.5px; line-height: 1.5; }
        .footer .link-green { color: #000; text-decoration: none; transition: color .2s ease; font-weight: 600; text-underline-offset: 2px; position: relative; }
        .footer .link-green::after { content: ""; position: absolute; left: 0; right: 0; bottom: -2px; height: 2px; background-color: currentColor; transform: scaleX(0); transform-origin: center; transition: transform .25s ease; border-radius: 2px; }
        .footer .link-green:hover::after { transform: scaleX(1); }
    </style>
    <meta name="description" content="GitHub 文件加速代理服务，纯代理，失败自动回退到 jsDelivr。">
    <meta name="robots" content="index,follow">
    <meta name="color-scheme" content="light dark">
</head>
<body>
    <div class="wrap">
        <div class="hero">
            <div class="logo">GitHub <span class="accent">Proxy</span></div>
            <div class="search">
            <input id="githubUrl" type="text" placeholder="粘贴 GitHub 链接，例如：https://github.com/user/repo/archive/main.zip" autofocus />
            <button onclick="generateProxyUrl()">生成链接</button>
            </div>
        </div>
        <div id="result" class="result result-fixed" style="display:none;"></div>
    </div>
    <footer class="footer">
        <div class="footer-line">© 2025 <a href="https://cdn.gw124.top/" target="_blank" rel="noopener noreferrer" class="link-green">CDN.GW124.TOP</a>｜By <a href="https://gw124.top/" target="_blank" rel="noopener noreferrer" class="link-green">Wen</a></div>
    </footer>

    <script>
        let currentDomain = window.location.origin;
        if (currentDomain.startsWith('file://')) { currentDomain = 'https://cdn.gw124.top'; }

        function normalizeUrl(input) {
            let u = (input || '').trim();
            if (!u) return '';
            if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
            return u;
        }

        async function generateProxyUrl() {
            const input = document.getElementById('githubUrl');
            const result = document.getElementById('result');
            let url = normalizeUrl(input.value);
            if (!url) { showToast('请输入 GitHub 链接'); result.style.display='none'; return; }

            const patterns = ['github.com','raw.githubusercontent.com','gist.githubusercontent.com','raw.github.com','gist.github.com'];
            if (!patterns.some(p=>url.includes(p))) { showToast('请输入有效的 GitHub 链接'); result.style.display='none'; return; }

            const finalUrl = currentDomain + '/' + url;
            const note = '✅ 使用本代理（失败由后端自动切换 jsDelivr）';
            const badge = '<span class="badge success">本代理</span>';

            result.style.display='block';
            result.innerHTML = '<div class="result-card">'
              + '<div class="url-line"><a href="' + finalUrl + '" target="_blank" title="' + finalUrl + '">' + finalUrl + '</a></div>'
              + '<div class="note">' + badge + '<span>' + note + '</span></div>'
              + '<div class="actions"><button class="btn-copy" id="copyBtn">点击复制链接</button><button class="btn-copy push-right" id="openBtn">点击打开链接</button></div>'
              + '</div>';

            const copyBtn = document.getElementById('copyBtn');
            copyBtn?.addEventListener('click', () => copyToClipboard(finalUrl));
            const openBtn = document.getElementById('openBtn');
            openBtn?.addEventListener('click', () => window.open(finalUrl, '_blank'));
        }

        async function copyToClipboard(text) {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                showToast('已复制到剪贴板');
            } catch (e) {
                showToast('复制失败，请手动复制');
            }
        }

        function showToast(text){
            let el = document.getElementById('toast');
            if(!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
            el.textContent = text; el.classList.add('show');
            setTimeout(()=> el.classList.remove('show'), 1800);
        }

        document.getElementById('githubUrl').addEventListener('keypress', function(e){ if(e.key==='Enter'){ generateProxyUrl(); }});
        window.addEventListener('load', () => { document.getElementById('githubUrl')?.focus(); });
    </script>
</body>
</html>
    `
}


