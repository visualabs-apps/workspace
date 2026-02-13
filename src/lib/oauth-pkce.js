// OAuth PKCE (Proof Key for Code Exchange) Implementation
// For secure OAuth2 flow in desktop apps without client secret

/**
 * Generate a random code verifier (43-128 characters)
 */
function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
}

/**
 * Generate code challenge from verifier using SHA-256
 */
async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(new Uint8Array(hash));
}

/**
 * Base64 URL encode (without padding)
 */
function base64URLEncode(buffer) {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Generate random state for CSRF protection
 */
function generateState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
}

/**
 * Create OAuth PKCE authorization URL
 */
export async function createAuthorizationUrl(config) {
    const {
        clientId,
        redirectUri,
        scope,
        authorizationEndpoint
    } = config;

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store verifier and state for later use
    sessionStorage.setItem('oauth_code_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    // Build authorization URL
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state,
        access_type: 'offline', // For refresh token
        prompt: 'consent' // Force consent to get refresh token
    });

    return `${authorizationEndpoint}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(config, authorizationCode, receivedState) {
    const {
        clientId,
        redirectUri,
        tokenEndpoint
    } = config;

    // Verify state to prevent CSRF
    const storedState = sessionStorage.getItem('oauth_state');
    if (storedState !== receivedState) {
        throw new Error('State mismatch - possible CSRF attack');
    }

    // Get stored code verifier
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
    if (!codeVerifier) {
        throw new Error('Code verifier not found');
    }

    // Exchange code for tokens
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code: authorizationCode,
        code_verifier: codeVerifier
    });

    const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Token exchange failed');
    }

    const tokens = await response.json();

    // Clean up stored values
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_state');

    return tokens;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(config, refreshToken) {
    const {
        clientId,
        tokenEndpoint
    } = config;

    const params = new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Token refresh failed');
    }

    return await response.json();
}

/**
 * Get user info from Google
 */
export async function getUserInfo(accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to get user info');
    }

    return await response.json();
}

// Google OAuth2 Configuration for Desktop App
export const GOOGLE_OAUTH_CONFIG = {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
    redirectUri: 'http://localhost:3000/oauth/callback', // Loopback server in Electron
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile'
};
