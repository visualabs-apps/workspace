const { ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── In-Memory Cookie Jar ─────────────────────────────────────────────────────
// Node.js native http module does NOT handle cookies automatically.
// This jar captures Set-Cookie headers from responses and re-sends them on
// subsequent requests to the same origin — fixing /auth/refresh 400 errors.
//
// Note: Attributes like HttpOnly, Secure, SameSite are intentionally ignored
// here because we are running in the Electron main process (not a browser).

const cookieJar = new Map(); // Map<origin, Map<name, cookieObj>>

function getOrigin(url) {
    const u = new URL(url);
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    return `${u.protocol}//${u.hostname}:${port}`;
}

function parseSetCookie(str) {
    const parts = str.split(';').map(s => s.trim());
    const [nameValue, ...attrs] = parts;
    const eqIdx = nameValue.indexOf('=');
    if (eqIdx === -1) return null;

    const name  = nameValue.substring(0, eqIdx).trim();
    const value = nameValue.substring(eqIdx + 1).trim();
    const cookie = { name, value, path: '/', expires: null };

    for (const attr of attrs) {
        const [k, ...rest] = attr.split('=');
        const key = k.trim().toLowerCase();
        const val = rest.join('=').trim();
        if (key === 'path') {
            cookie.path = val || '/';
        } else if (key === 'max-age') {
            const n = parseInt(val, 10);
            cookie.expires = isNaN(n) ? null : Date.now() + n * 1000;
        } else if (key === 'expires' && !cookie.expires) {
            const t = new Date(val).getTime();
            cookie.expires = isNaN(t) ? null : t;
        }
        // HttpOnly / Secure / SameSite → intentionally ignored
    }
    return cookie;
}

function storeCookies(url, setCookieHeaders) {
    if (!setCookieHeaders) return;
    const origin = getOrigin(url);
    if (!cookieJar.has(origin)) cookieJar.set(origin, new Map());
    const jar = cookieJar.get(origin);

    const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const header of list) {
        if (!header) continue;
        const cookie = parseSetCookie(header);
        if (!cookie) continue;
        if (cookie.expires !== null && Date.now() > cookie.expires) {
            jar.delete(cookie.name); // expired → evict
        } else {
            jar.set(cookie.name, cookie);
        }
    }
}

function getCookieHeader(url) {
    const origin = getOrigin(url);
    const jar = cookieJar.get(origin);
    if (!jar || jar.size === 0) return '';

    const now   = Date.now();
    const valid = [];
    for (const [name, cookie] of jar) {
        if (cookie.expires === null || now < cookie.expires) {
            valid.push(`${name}=${cookie.value}`);
        } else {
            jar.delete(name); // prune expired
        }
    }
    return valid.join('; ');
}

// ─── IPC Handler ──────────────────────────────────────────────────────────────

function registerHttpHandler() {
    ipcMain.handle('http-request', async (event, options) => {
        const startTime = Date.now();
        const { method = 'GET', url } = options;

        return new Promise((resolve, reject) => {
            try {
                const {
                    data,
                    headers = {},
                    timeout = 10000,
                    withCredentials = true
                } = options;

                const urlObj = new URL(url);
                const isHttps = urlObj.protocol === 'https:';
                const httpModule = isHttps ? https : http;

                const defaultHeaders = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'User-Agent': 'VisualBox/1.0 (Electron)'
                };

                const requestHeaders = { ...defaultHeaders, ...headers };

                // ── Attach stored cookies (mirrors withCredentials behaviour) ──
                if (withCredentials) {
                    const cookieStr = getCookieHeader(url);
                    if (cookieStr) {
                        const existing = requestHeaders['Cookie'] || requestHeaders['cookie'] || '';
                        requestHeaders['Cookie'] = existing
                            ? `${existing}; ${cookieStr}`
                            : cookieStr;
                    }
                }

                let requestBody = '';
                if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                    if (typeof data === 'object') {
                        requestBody = JSON.stringify(data);
                    } else {
                        requestBody = data;
                    }
                    requestHeaders['Content-Length'] = Buffer.byteLength(requestBody);
                }

                const requestOptions = {
                    hostname: urlObj.hostname,
                    port: urlObj.port || (isHttps ? 443 : 80),
                    path: urlObj.pathname + urlObj.search,
                    method: method.toUpperCase(),
                    headers: requestHeaders,
                    timeout: timeout
                };

                const req = httpModule.request(requestOptions, (res) => {
                    let responseData = '';

                    // ── Capture Set-Cookie from every response ──
                    const setCookieHeader = res.headers['set-cookie'];
                    if (withCredentials && setCookieHeader) {
                        storeCookies(url, setCookieHeader);
                    }

                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });

                    res.on('end', () => {
                        try {
                            let parsedData;
                            try {
                                parsedData = JSON.parse(responseData);
                            } catch (e) {
                                parsedData = responseData;
                            }

                            const response = {
                                data: parsedData,
                                status: res.statusCode,
                                statusText: res.statusMessage,
                                headers: res.headers,
                                config: options
                            };

                            const duration = Date.now() - startTime;

                            if (res.statusCode >= 400) {
                                console.error(`[HTTP] ✗ ${method.toUpperCase()} ${url} → ${res.statusCode} (${duration}ms)`);

                                const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
                                error.response = response;
                                error.status = res.statusCode;
                                error.statusCode = res.statusCode;
                                error.statusText = res.statusMessage;
                                reject(error);
                            } else {
                                resolve(response);
                            }
                        } catch (parseError) {
                            reject(parseError);
                        }
                    });
                });

                req.on('error', (error) => {
                    const duration = Date.now() - startTime;
                    console.error(`[HTTP] ✗ ${method.toUpperCase()} ${url} → ERROR (${duration}ms)`, error.message);
                    reject(error);
                });

                req.on('timeout', () => {
                    const duration = Date.now() - startTime;
                    console.error(`[HTTP] ✗ ${method.toUpperCase()} ${url} → TIMEOUT (${duration}ms)`);
                    req.destroy();
                    reject(new Error('Request timeout'));
                });

                if (requestBody) {
                    req.write(requestBody);
                }

                req.end();

            } catch (error) {
                reject(error);
            }
        });
    });
}

module.exports = { registerHttpHandler };
