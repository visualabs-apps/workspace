// KIEAI Gateway API Service
const API_KEY = 'apikey_visu4labsss_AImngerrz';
const BASE_URL = 'https://leb.visualabs.id/api/kieai-gateway/v1';

class KieAiGateway {
    constructor() {
        this.apiKey = API_KEY;
        this.baseUrl = BASE_URL;
    }

    /**
     * Get available models
     */
    async getModels() {
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return { success: true, models: data.models };
        } catch (error) {
            console.error('[KIEAI] Get models error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Submit chat request
     */
    async submitChat(model, messages, options = {}) {
        try {
            const requestBody = {
                model,
                messages,
                ...options
            };

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return { success: true, requestId: data.request_id, data };
        } catch (error) {
            console.error('[KIEAI] Submit chat error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check request status
     */
    async checkStatus(requestId) {
        try {
            const response = await fetch(`${this.baseUrl}/status/${requestId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            console.error('[KIEAI] Check status error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Poll for completion with timeout
     */
    async pollForCompletion(requestId, options = {}) {
        const maxAttempts = options.maxAttempts || 60; // 5 minutes
        const pollInterval = options.pollInterval || 5000; // 5 seconds
        const onProgress = options.onProgress || (() => {});

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Wait before polling (including first attempt to give server time to process)
            await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 2000 : pollInterval));

            const result = await this.checkStatus(requestId);

            if (!result.success) {
                return result;
            }

            const { status, result: resultData, error } = result.data;

            // Notify progress
            onProgress({ status, attempt: attempt + 1, maxAttempts });

            if (status === 'completed') {
                return { success: true, data: resultData };
            }

            if (status === 'failed') {
                return { 
                    success: false, 
                    error: error?.message || 'Request failed' 
                };
            }

            // Continue polling for 'queued' or 'processing' status
        }

        return { success: false, error: 'Request timeout' };
    }

    /**
     * Complete chat flow: submit + poll
     */
    async chat(model, messages, options = {}) {
        // Submit request
        const submitResult = await this.submitChat(model, messages, options.submitOptions);

        if (!submitResult.success) {
            return submitResult;
        }

        const { requestId } = submitResult;

        // Poll for completion
        const pollResult = await this.pollForCompletion(requestId, options.pollOptions);

        return pollResult;
    }
}

export const kieaiGateway = new KieAiGateway();
