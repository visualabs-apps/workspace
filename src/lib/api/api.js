// API Client for v-box
import nativeApi from './nativeApi.js';

/**
 * Fetch subscriptions assigned to the logged-in admin
 * @param {Object} params - Query parameters
 * @param {number} params.advertiserId - Filter by advertiser ID (admin)
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @returns {Promise<Object>} Response with subscriptions data
 */
export async function getSubscriptions(params = {}) {
    try {
        const queryParams = new URLSearchParams();
        
        if (params.advertiserId) queryParams.append('advertiserId', params.advertiserId);
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.status !== undefined) queryParams.append('status', params.status);
        
        const endpoint = `/subscriptions${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await nativeApi.get(endpoint);
        
        return {
            success: true,
            data: response.data.data || [],
            page: response.data.page || {}
        };
    } catch (error) {
        console.error('Failed to fetch subscriptions:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch subscriptions',
            data: []
        };
    }
}

/**
 * Get unique clients from subscriptions
 * @param {number} advertiserId - Admin user ID
 * @returns {Promise<Array>} Array of unique clients
 */
export async function getClientsForAdmin(advertiserId) {
    try {
        const response = await getSubscriptions({ 
            advertiserId, 
            limit: 100 // Get more to ensure we have all clients
        });
        
        if (!response.success) {
            return [];
        }
        
        // Extract unique customers from subscriptions
        const clientsMap = new Map();
        
        response.data.forEach(subscription => {
            if (subscription.customer && subscription.customerId) {
                // Use customerId as key to ensure uniqueness
                if (!clientsMap.has(subscription.customerId)) {
                    clientsMap.set(subscription.customerId, {
                        id: subscription.customerId,
                        name: subscription.customer.profile?.name || subscription.customer.username || subscription.customer.email || `Customer #${subscription.customerId}`,
                        email: subscription.customer.email,
                        username: subscription.customer.username,
                        // Include subscription info for reference
                        subscriptionId: subscription.id,
                        brand: subscription.brand,
                        platform: subscription.platform
                    });
                }
            }
        });
        
        // Convert map to array and sort by name
        return Array.from(clientsMap.values()).sort((a, b) => 
            a.name.localeCompare(b.name)
        );
    } catch (error) {
        console.error('Failed to fetch clients:', error);
        return [];
    }
}

/**
 * Get chrome profiles
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Response with profiles data
 */
export async function getChromeProfiles(params = {}) {
    try {
        const queryParams = new URLSearchParams();
        
        if (params.userId) queryParams.append('userId', params.userId);
        if (params.customerId) queryParams.append('customerId', params.customerId);
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.q) queryParams.append('q', params.q);
        
        const endpoint = `/chrome-profiles${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await nativeApi.get(endpoint);
        
        return {
            success: true,
            data: response.data.data || [],
            page: response.data.page || {}
        };
    } catch (error) {
        console.error('Failed to fetch chrome profiles:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch chrome profiles',
            data: []
        };
    }
}

/**
 * Get single chrome profile by ID
 * @param {number} id - Profile ID
 * @returns {Promise<Object>} Response with profile data
 */
export async function getChromeProfile(id) {
    try {
        const response = await nativeApi.get(`/chrome-profiles/${id}`);
        return {
            success: true,
            data: response.data.data
        };
    } catch (error) {
        console.error('Failed to fetch chrome profile:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch chrome profile'
        };
    }
}

/**
 * Create chrome profile
 * @param {Object} payload - Profile data
 * @returns {Promise<Object>} Response with created profile
 */
export async function createChromeProfile(payload) {
    try {
        const response = await nativeApi.post('/chrome-profiles', payload);
        return {
            success: true,
            data: response.data.data
        };
    } catch (error) {
        console.error('Failed to create chrome profile:', error);
        return {
            success: false,
            error: error.message || 'Failed to create chrome profile'
        };
    }
}

/**
 * Update chrome profile
 * @param {number} id - Profile ID
 * @param {Object} payload - Profile data to update
 * @returns {Promise<Object>} Response with updated profile
 */
export async function updateChromeProfile(id, payload) {
    try {
        const response = await nativeApi.put(`/chrome-profiles/${id}`, payload);
        return {
            success: true,
            data: response.data.data
        };
    } catch (error) {
        console.error('Failed to update chrome profile:', error);
        return {
            success: false,
            error: error.message || 'Failed to update chrome profile'
        };
    }
}

/**
 * Delete chrome profile
 * @param {number} id - Profile ID
 * @returns {Promise<Object>} Response
 */
export async function deleteChromeProfile(id) {
    try {
        const response = await nativeApi.delete(`/chrome-profiles/${id}`);
        return {
            success: true,
            message: response.data.message
        };
    } catch (error) {
        console.error('Failed to delete chrome profile:', error);
        return {
            success: false,
            error: error.message || 'Failed to delete chrome profile'
        };
    }
}
