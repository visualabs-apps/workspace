export function generateErrorPage({ icon, title, description, errorCode, url, theme }) {
    const isDark = theme === 'dark';
    const bg = isDark ? '#1a1a2e' : '#ffffff';
    const textPrimary = isDark ? '#e0e0e0' : '#1f2937';
    const textSecondary = isDark ? '#9ca3af' : '#6b7280';
    const textMuted = isDark ? '#6b7280' : '#9ca3af';
    const btnPrimaryBg = '#3b82f6';
    const btnPrimaryText = '#ffffff';
    const btnSecondaryBg = isDark ? '#374151' : '#f3f4f6';
    const btnSecondaryText = isDark ? '#d1d5db' : '#374151';
    const codeBg = isDark ? '#1f2937' : '#f3f4f6';
    const codeText = isDark ? '#9ca3af' : '#6b7280';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: ${bg};
            color: ${textPrimary};
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .container { text-align: center; max-width: 460px; }
        .icon { font-size: 64px; margin-bottom: 16px; }
        h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
        .desc { font-size: 14px; color: ${textSecondary}; margin-bottom: 16px; line-height: 1.5; }
        .url {
            font-size: 12px;
            color: ${textMuted};
            word-break: break-all;
            margin-bottom: 20px;
            padding: 0 16px;
        }
        .error-code {
            display: inline-block;
            font-size: 12px;
            background: ${codeBg};
            color: ${codeText};
            padding: 4px 10px;
            border-radius: 4px;
            font-family: 'SF Mono', 'Consolas', monospace;
            margin-bottom: 20px;
        }
        .buttons { display: flex; gap: 12px; justify-content: center; }
        .btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            border: none;
            cursor: pointer;
            transition: opacity 0.15s;
        }
        .btn:hover { opacity: 0.85; }
        .btn-primary { background: ${btnPrimaryBg}; color: ${btnPrimaryText}; }
        .btn-secondary { background: ${btnSecondaryBg}; color: ${btnSecondaryText}; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p class="desc">${description}</p>
        <p class="url">${url}</p>
        ${errorCode ? `<span class="error-code">ERR_${errorCode}</span>` : ''}
        <div class="buttons">
            <button class="btn btn-primary" onclick="retry()">Coba Lagi</button>
            <button class="btn btn-secondary" onclick="goHome()">Ke Beranda</button>
        </div>
    </div>
    <script>
        const targetUrl = ${JSON.stringify(url)};
        function retry() {
            window.location.href = targetUrl;
        }
        function goHome() {
            window.location.href = targetUrl;
        }
    </script>
</body>
</html>`;
}
