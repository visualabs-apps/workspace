// Secure Storage using Keytar for Electron
// Stores sensitive data (tokens, passwords) in OS keychain

const SERVICE_NAME = 'v-leb-workspace';

class SecureStorage {
    constructor() {
        this.keytar = null;
        this.isElectron = false;
        this.initialized = false;
        
        // Try to load keytar
        try {
            if (window.require) {
                this.keytar = window.require('keytar');
                this.isElectron = true;
                console.log('✅ Keytar initialized - using OS keychain');
            }
        } catch (error) {
            console.warn('⚠️ Keytar not available, falling back to localStorage');
        }
        
        this.initialized = true;
    }

    /**
     * Set a secure value
     */
    async setPassword(account, password) {
        if (this.isElectron && this.keytar) {
            try {
                await this.keytar.setPassword(SERVICE_NAME, account, password);
                return true;
            } catch (error) {
                console.error('Keytar setPassword error:', error);
                // Fallback to localStorage
                localStorage.setItem(`${SERVICE_NAME}:${account}`, password);
                return true;
            }
        } else {
            // Fallback to localStorage
            localStorage.setItem(`${SERVICE_NAME}:${account}`, password);
            return true;
        }
    }

    /**
     * Get a secure value
     */
    async getPassword(account) {
        if (this.isElectron && this.keytar) {
            try {
                const password = await this.keytar.getPassword(SERVICE_NAME, account);
                return password;
            } catch (error) {
                console.error('Keytar getPassword error:', error);
                // Fallback to localStorage
                return localStorage.getItem(`${SERVICE_NAME}:${account}`);
            }
        } else {
            // Fallback to localStorage
            return localStorage.getItem(`${SERVICE_NAME}:${account}`);
        }
    }

    /**
     * Delete a secure value
     */
    async deletePassword(account) {
        if (this.isElectron && this.keytar) {
            try {
                await this.keytar.deletePassword(SERVICE_NAME, account);
                return true;
            } catch (error) {
                console.error('Keytar deletePassword error:', error);
                // Fallback to localStorage
                localStorage.removeItem(`${SERVICE_NAME}:${account}`);
                return true;
            }
        } else {
            // Fallback to localStorage
            localStorage.removeItem(`${SERVICE_NAME}:${account}`);
            return true;
        }
    }

    /**
     * Store auth token securely
     */
    async setAuthToken(token) {
        return await this.setPassword('auth_token', token);
    }

    /**
     * Get auth token
     */
    async getAuthToken() {
        return await this.getPassword('auth_token');
    }

    /**
     * Delete auth token
     */
    async deleteAuthToken() {
        return await this.deletePassword('auth_token');
    }

    /**
     * Store refresh token securely
     */
    async setRefreshToken(token) {
        return await this.setPassword('refresh_token', token);
    }

    /**
     * Get refresh token
     */
    async getRefreshToken() {
        return await this.getPassword('refresh_token');
    }

    /**
     * Delete refresh token
     */
    async deleteRefreshToken() {
        return await this.deletePassword('refresh_token');
    }

    /**
     * Clear all auth data
     */
    async clearAuth() {
        await this.deleteAuthToken();
        await this.deleteRefreshToken();
        
        // Also clear localStorage for user data
        localStorage.removeItem('auth_user');
        localStorage.removeItem('token_expires_at');
    }

    /**
     * Check if using secure storage
     */
    isSecure() {
        return this.isElectron && this.keytar !== null;
    }
}

// Export singleton instance
export const secureStorage = new SecureStorage();
