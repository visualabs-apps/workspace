const { ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const { URL } = require('url');

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
                                // Forward log to renderer DevTools console (serialize data safely)
                                try {
                                    const safeData = typeof parsedData === 'object' ? JSON.stringify(parsedData).substring(0, 500) : String(parsedData);
                                    event.sender.send('api-log', { level: 'error', method, url, status: res.statusCode, duration, dataPreview: safeData });
                                } catch(e) {}

                                const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
                                error.response = response;
                                error.status = res.statusCode;
                                error.statusCode = res.statusCode;
                                error.statusText = res.statusMessage;
                                reject(error);
                            } else {
                                console.log(`[HTTP] ✓ ${method.toUpperCase()} ${url} → ${res.statusCode} (${duration}ms)`);
                                // Forward log to renderer DevTools console
                                try { event.sender.send('api-log', { level: 'info', method, url, status: res.statusCode, duration }); } catch(e) {}

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
                    try { event.sender.send('api-log', { level: 'error', method, url, status: 'ERR', duration, error: error.message }); } catch(e) {}
                    reject(error);
                });

                req.on('timeout', () => {
                    const duration = Date.now() - startTime;
                    console.error(`[HTTP] ✗ ${method.toUpperCase()} ${url} → TIMEOUT (${duration}ms)`);
                    try { event.sender.send('api-log', { level: 'error', method, url, status: 'TIMEOUT', duration }); } catch(e) {}
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
