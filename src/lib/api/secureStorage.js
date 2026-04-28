// Secure Storage using Electron safeStorage API
// Best practice: Use Electron's built-in encryption instead of keytar

const SERVICE_NAME = 'visualbox';

class SecureStorage {
    constructor() {
        this.safeStorage = null;
        this.isElectron = false;
        this.initialized = false;
        
        // Try to use Electron safeStorage (available via IPC)
        try {
            if (window.api?.safeStorage) {
                this.safeStorage = window.api.safeStorage;
                this.isElectron = true;
                console.log('✅ Electron safeStorage initialized');
            }
        } catch (error) {
            console.warn('⚠️ Electron safeStorage not available, falling back to localStorage');
        }
        
        this.initialized = true;
    }

    /**
     * Set a secure value using Electron safeStorage
     */
    async setPassword(account, password) {
        if (this.isElectron && this.safeStorage) {
            try {
                const result = await this.safeStorage.setItem(account, password);
                if (result.success) {
                    return true;
                }
                throw new Error(result.error || 'Failed to set item');
            } catch (error) {
                console.error('safeStorage setItem error:', error);
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
     * Get a secure value from Electron safeStorage
     */
    async getPassword(account) {
        if (this.isElectron && this.safeStorage) {
            try {
                const result = await this.safeStorage.getItem(account);
                if (result.success) {
                    return result.value;
                }
                throw new Error(result.error || 'Failed to get item');
            } catch (error) {
                console.error('safeStorage getItem error:', error);
                // Fallback to localStorage
                return localStorage.getItem(`${SERVICE_NAME}:${account}`);
            }
        } else {
            // Fallback to localStorage
            return localStorage.getItem(`${SERVICE_NAME}:${account}`);
        }
    }

    /**
     * Delete a secure value from Electron safeStorage
     */
    async deletePassword(account) {
        if (this.isElectron && this.safeStorage) {
            try {
                const result = await this.safeStorage.removeItem(account);
                if (result.success) {
                    return true;
                }
                throw new Error(result.error || 'Failed to remove item');
            } catch (error) {
                console.error('safeStorage removeItem error:', error);
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
     * Clear all auth data
     * Note: Refresh token is handled by httpOnly cookie from backend
     */
    async clearAuth() {
        await this.deleteAuthToken();
        
        // Clear localStorage for user data
        localStorage.removeItem('auth_user');
        localStorage.removeItem('token_expires_at');
    }

    /**
     * Check if using secure storage
     */
    isSecure() {
        return this.isElectron && this.safeStorage !== null;
    }
}

// Export singleton instance
export const secureStorage = new SecureStorage();
