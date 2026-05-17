const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs-extra');

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

class Aria2Manager {
    constructor() {
        this.process = null;
        this.rpcUrl = 'http://localhost:6800/jsonrpc';
        this.rpcSecret = 'visualbox-secret-' + Math.random().toString(36).substring(7);
        this.port = 6800;
        this.isReady = false;
        this.downloads = new Map(); // gid -> download info
        this.startAttempts = 0;
        this.maxStartAttempts = 3;
    }

    async start(downloadsPath) {
        if (this.process) {
            return;
        }

        // Try different ports if previous attempts failed
        if (this.startAttempts > 0) {
            this.port = 6800 + this.startAttempts;
            this.rpcUrl = `http://localhost:${this.port}/jsonrpc`;
        }

        this.startAttempts++;

        if (this.startAttempts > this.maxStartAttempts) {
            throw new Error('Failed to start aria2 after multiple attempts');
        }

        try {
            // Kill any existing aria2c processes first
            try {
                const { execSync } = require('child_process');
                execSync('taskkill /F /IM aria2c-64.exe 2>nul', { windowsHide: true });
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                // No existing process, ignore
            }

            // Get aria2c path
            const aria2cPath = path.join(__dirname, '..', 'bin', 'aria2', 'aria2c-64.exe');
            
            if (!fs.existsSync(aria2cPath)) {
                throw new Error('aria2c executable not found at: ' + aria2cPath);
            }


            // Ensure downloads directory exists
            fs.ensureDirSync(downloadsPath);

            // Start aria2c with RPC enabled
            this.process = spawn(aria2cPath, [
                '--enable-rpc=true',
                '--rpc-listen-all=false',
                '--rpc-listen-port=' + this.port,
                '--rpc-secret=' + this.rpcSecret,
                '--dir=' + downloadsPath,
                '--max-connection-per-server=16',
                '--min-split-size=1M',
                '--split=16',
                '--max-concurrent-downloads=5',
                '--continue=true',
                '--auto-file-renaming=true',
                '--allow-overwrite=false',
                '--disk-cache=32M',
                '--file-allocation=none',
                '--log-level=notice',
                '--console-log-level=notice',
                '--check-certificate=false',
                '--user-agent=' + CHROME_UA,
                '--disable-ipv6=true',
                '--async-dns=false'
            ], {
                windowsHide: true,
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    NO_PROXY: '*',
                    no_proxy: '*'
                }
            });

            this.process.stdout.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                }
            });

            this.process.stderr.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                }
            });

            this.process.on('error', (error) => {
                console.error('❌ Failed to start aria2c:', error);
                this.process = null;
                this.isReady = false;
            });

            this.process.on('exit', (code, signal) => {
                this.process = null;
                this.isReady = false;
            });

            // Wait for aria2 to be ready
            await this.waitForReady();

        } catch (error) {
            console.error('❌ Failed to start aria2:', error);
            throw error;
        }
    }

    async waitForReady(maxAttempts = 50) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const version = await this.call('aria2.getVersion');
                if (version) {
                    this.isReady = true;
                    return true;
                }
            } catch (error) {
                // Not ready yet, wait and retry
                if (i % 10 === 0) {
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        throw new Error('aria2 failed to start within timeout');
    }

    async stop() {
        if (!this.process) {
            return;
        }


        try {
            // Try graceful shutdown first
            await this.call('aria2.shutdown');
            
            // Wait a bit for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
        }

        // Force kill if still running
        if (this.process && !this.process.killed) {
            this.process.kill('SIGTERM');
            
            // Force kill after 2 seconds if still alive
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
            }, 2000);
        }

        this.process = null;
        this.isReady = false;
        this.downloads.clear();
    }

    async call(method, params = []) {
        if (!this.isReady && method !== 'aria2.getVersion') {
            throw new Error('aria2 is not ready');
        }

        // Add secret token to params
        const paramsWithSecret = ['token:' + this.rpcSecret, ...params];

        const payload = {
            jsonrpc: '2.0',
            id: Date.now().toString(),
            method: method,
            params: paramsWithSecret
        };

        return new Promise((resolve, reject) => {
            const data = JSON.stringify(payload);

            const options = {
                hostname: 'localhost',
                port: this.port,
                path: '/jsonrpc',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                },
                timeout: 5000
            };

            const req = http.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(responseData);
                        if (response.error) {
                            reject(new Error(response.error.message));
                        } else {
                            resolve(response.result);
                        }
                    } catch (error) {
                        console.error('Failed to parse aria2 response:', responseData);
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`aria2 RPC error (${method}):`, error.message);
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('aria2 RPC timeout'));
            });

            req.write(data);
            req.end();
        });
    }

    // Add download
    async addDownload(url, options = {}) {
        try {
            const aria2Options = {
                'out': options.filename || undefined,
                'dir': options.dir || undefined,
                'header': options.headers ? Object.entries(options.headers).map(([k, v]) => `${k}: ${v}`) : undefined
            };

            // Remove undefined values
            Object.keys(aria2Options).forEach(key => 
                aria2Options[key] === undefined && delete aria2Options[key]
            );

            const gid = await this.call('aria2.addUri', [[url], aria2Options]);
            
            // Store download info
            this.downloads.set(gid, {
                gid,
                url,
                filename: options.filename,
                startTime: Date.now()
            });

            return gid;
        } catch (error) {
            console.error('Failed to add download:', error);
            throw error;
        }
    }

    // Get download status
    async getStatus(gid) {
        try {
            return await this.call('aria2.tellStatus', [gid]);
        } catch (error) {
            console.error('Failed to get status:', error);
            throw error;
        }
    }

    // Pause download
    async pause(gid) {
        try {
            return await this.call('aria2.pause', [gid]);
        } catch (error) {
            console.error('Failed to pause, trying forcePause:', error);
            // Try force pause if normal pause fails
            try {
                return await this.call('aria2.forcePause', [gid]);
            } catch (forceError) {
                console.error('Failed to forcePause:', forceError);
                throw forceError;
            }
        }
    }

    // Resume download
    async resume(gid) {
        try {
            return await this.call('aria2.unpause', [gid]);
        } catch (error) {
            console.error('Failed to resume:', error);
            throw error;
        }
    }

    // Cancel download
    async cancel(gid) {
        try {
            const result = await this.call('aria2.remove', [gid]);
            this.downloads.delete(gid);
            return result;
        } catch (error) {
            console.error('Failed to cancel:', error);
            throw error;
        }
    }

    // Get all active downloads
    async getActive() {
        try {
            return await this.call('aria2.tellActive');
        } catch (error) {
            console.error('Failed to get active downloads:', error);
            return [];
        }
    }

    // Get waiting downloads
    async getWaiting() {
        try {
            return await this.call('aria2.tellWaiting', [0, 1000]);
        } catch (error) {
            console.error('Failed to get waiting downloads:', error);
            return [];
        }
    }

    // Get stopped downloads
    async getStopped() {
        try {
            return await this.call('aria2.tellStopped', [0, 1000]);
        } catch (error) {
            console.error('Failed to get stopped downloads:', error);
            return [];
        }
    }

    // Remove download result
    async removeResult(gid) {
        try {
            return await this.call('aria2.removeDownloadResult', [gid]);
        } catch (error) {
            console.error('Failed to remove result:', error);
            throw error;
        }
    }

    // Get global stats
    async getGlobalStats() {
        try {
            return await this.call('aria2.getGlobalStat');
        } catch (error) {
            console.error('Failed to get global stats:', error);
            return null;
        }
    }
}

module.exports = Aria2Manager;
