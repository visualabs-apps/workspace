import { secureStorage } from './secureStorage.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:2024/api';

class NativeApiService {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        };
        this.timeout = 10000;
    }

    buildUrl(endpoint) {
        if (endpoint.startsWith('http')) {
            return endpoint;
        }
        return `${this.baseURL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    }

    async request(method, endpoint, data = null, options = {}) {
        const url = this.buildUrl(endpoint);

        try {
            const headers = { ...this.defaultHeaders, ...options.headers };

            const token = await secureStorage.getAuthToken();
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const requestOptions = {
                method: method.toUpperCase(),
                url,
                data: data ? JSON.parse(JSON.stringify(data)) : data,
                headers,
                timeout: options.timeout || this.timeout,
                withCredentials: true
            };

            const response = await window.api.http.request(requestOptions);
            return response;

        } catch (error) {
            let extractedError = error;
            
            if (error.message && error.message.includes('Error invoking remote method')) {
                const match = error.message.match(/HTTP (\d+): (.+)/);
                if (match) {
                    extractedError = new Error(`HTTP ${match[1]}: ${match[2]}`);
                    extractedError.status = parseInt(match[1]);
                    extractedError.statusCode = parseInt(match[1]);
                    extractedError.statusText = match[2];
                }
            }

            if (extractedError.status === 401 && !options._retry) {
                try {
                    await this.refreshToken();
                    return this.request(method, endpoint, data, { ...options, _retry: true });
                } catch (refreshError) {
                    console.error('[API] Token refresh failed:', refreshError.message);
                    await this.clearAuth();
                    window.dispatchEvent(new CustomEvent('auth:logout'));
                    throw refreshError;
                }
            }
            throw extractedError;
        }
    }

    async get(endpoint, options = {}) {
        return this.request('GET', endpoint, null, options);
    }

    async post(endpoint, data = null, options = {}) {
        return this.request('POST', endpoint, data, options);
    }

    async put(endpoint, data = null, options = {}) {
        return this.request('PUT', endpoint, data, options);
    }

    async delete(endpoint, options = {}) {
        return this.request('DELETE', endpoint, null, options);
    }

    async refreshToken() {
        // Refresh token is handled by httpOnly cookie from backend
        // No need to send it manually - browser/Electron will send cookie automatically
        const response = await window.api.http.request({
            method: 'POST',
            url: `${this.baseURL}/auth/refresh`,
            data: {}, // Empty body - refresh token comes from cookie
            headers: this.defaultHeaders,
            timeout: this.timeout,
            withCredentials: true // Important: send cookies
        });

        const { accessToken, expiresIn } = response.data;

        await secureStorage.setAuthToken(accessToken);
        localStorage.setItem('token_expires_at', Date.now() + (expiresIn * 1000));

        return accessToken;
    }

    async clearAuth() {
        await secureStorage.clearAuth();
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token_expires_at');
    }
}

const nativeApi = new NativeApiService();

export const clearAuth = async () => {
    await nativeApi.clearAuth();
};

export const login = async (email, password) => {
    try {
        const response = await nativeApi.post('/auth/login', { 
            identifier: email, 
            password: password 
        });
        
        const { accessToken, expiresIn } = response.data;

        await secureStorage.setAuthToken(accessToken);
        localStorage.setItem('token_expires_at', Date.now() + (expiresIn * 1000));

        const userResponse = await nativeApi.get('/auth/profile');
        const user = userResponse.data.data;
        
        localStorage.setItem('auth_user', JSON.stringify(user));

        return { success: true, user };
    } catch (error) {
        let errorMessage = 'Login failed';
        
        if (error.status === 401 || error.statusCode === 401) {
            errorMessage = 'Invalid email or password. Please check your credentials.';
        } else if (error.status === 423 || error.statusCode === 423) {
            errorMessage = 'Account temporarily locked. Please try again later.';
        } else if (error.status === 429 || error.statusCode === 429) {
            errorMessage = 'Too many login attempts. Please try again later.';
        } else if ((error.status >= 500 && error.status < 600) || (error.statusCode >= 500 && error.statusCode < 600)) {
            errorMessage = 'Server error. Please try again later.';
        } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            errorMessage = 'Network error. Please check your connection.';
        } else if (error.message?.includes('timeout')) {
            errorMessage = 'Request timed out. Please try again.';
        } else if (error.message && !error.message.includes('Error invoking remote method')) {
            errorMessage = error.message;
        }
        
        return { success: false, error: errorMessage };
    }
};

export const logout = async () => {
    try {
        await nativeApi.post('/auth/logout');
    } finally {
        await clearAuth();
    }
};

export const checkToken = async () => {
    try {
        const response = await nativeApi.get('/auth/profile');
        return { success: true, user: response.data.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const getCurrentUser = async () => {
    try {
        const response = await nativeApi.get('/auth/profile');
        return { success: true, user: response.data.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const isAuthenticated = async () => {
    const token = await secureStorage.getAuthToken();
    const expiresAt = localStorage.getItem('token_expires_at');
    if (!token) return false;
    if (expiresAt && Date.now() > parseInt(expiresAt)) return false;
    return true;
};

export const getStoredUser = () => {
    try {
        const userStr = localStorage.getItem('auth_user');
        return userStr ? JSON.parse(userStr) : null;
    } catch {
        return null;
    }
};

export const updateProfile = async (data) => {
    try {
        const response = await nativeApi.put('/auth/profile', data);
        return { success: true, user: response.data.data };
    } catch (error) {
        return { success: false, error: error.response?.data?.message || error.message || 'Update failed' };
    }
};

export { API_BASE_URL };
export default nativeApi;