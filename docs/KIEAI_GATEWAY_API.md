# KIE AI Gateway - Client Integration Guide

Panduan integrasi KIE AI Gateway untuk aplikasi desktop (Electron) dan mobile (Android/iOS).

## Base URL

```
https://leb.visualabs.id/api/kieai-gateway/v1
```Quick Start

### Base URL
```
https://your-domain.com/api/kieai-gateway/v1
```

### Authentication
Semua request memerlukan API key via Bearer token:
```
Authorization: Bearer YOUR_API_KEY
```

### Flow Dasar
1. **Submit** request chat → dapat `request_id`
2. **Poll** status dengan `request_id` setiap 5 detik
3. **Ambil** hasil saat status = `completed`

---

## Endpoints

### 1. Submit Chat Request
```
POST /chat/completions
```

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "model": "claude-sonnet-4-6",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "max_tokens": 2048
}
```

**Response (202):**
```json
{
  "request_id": "kieai_chat_abc123",
  "status": "queued",
  "model": "claude-sonnet-4-6",
  "poll_url": "/api/kieai-gateway/v1/status/kieai_chat_abc123"
}
```

### 2. Check Status
```
GET /status/{request_id}
```

**Response (Completed):**
```json
{
  "status": "completed",
**Example cURL:**
```bash
curl -X POST https://leb.visualabs.id/api/kieai-gateway/v1/chat/completions \
  -H "Authorization: Bearer apikey_visu4labsss_AImngerrzz" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-6",
    "messages": [
      {"role": "user", "content": "Explain quantum computing"}
    ],
    "max_tokens": 2048
  }'
```
### 3. List Models
```
GET /models
```

**Response:**
```json
{
  "models": [
    {
      "id": "claude-sonnet-4-6",
      "family": "claude",
      "pricing": {
        "input_usd_per_1m": 0.850,
        "output_usd_per_1m": 4.275
      }
    }
  ],
  "total": 12
}
```

---

## Electron Integration

### Install Dependencies
```bash
npm install axios
```

### Implementation

```javascript
// src/services/kieai-gateway.js
const axios = require('axios');

class KieAiGateway {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async chat(model, messages, options = {}) {
    try {
      // Submit request
      const { data } = await this.client.post('/chat/completions', {
        model,
        messages,
        max_tut_tokens": 500,
        "total_tokens": 650,
        "cost_usd": {
          "input": 0.0001275,
          "output": 0.0021375,
          "total": 0.002265
        },
        "rate_per_1m_tokens": {
          "input_usd": 0.850,
          "output_usd": 4.275,
          "input_credits": 170,
          "output_credits": 855
        },
        "credits_consumed": 0.45
      },
      "stop_reason": "end_turn"
    },
    "usage": {
      "input_tokens": 150,
      "output_tokens": 500,
      "total_tokens": 650
    },
    "credits_consumed": 0.45,
    "response_time_ms": 3450
  }
}
```

**Response (Failed):**
```json
{
  "request_id": "kieai_chat_abc123",
  "status": "failed",
  "model": "claude-sonnet-4-6",
  "created_at": "2026-05-25T10:30:00Z",
  "updated_at": "2026-05-25T10:30:15Z",
  "error": {
    "message": "API rate limit exceeded",
    "details": {
      "message": "API rate limit exceeded",
      "file": "/path/to/file.php",
      "line": 123
    }
  }
}
```

**Example cURL:**
```bash
curl -X GET https://leb.visualabs.id/api/kieai-gateway/v1/status/kieai_chat_abc123 \
  -H "Authorization: Bearer apikey_visu4labsss_AImngerrzz"
```

**Polling Strategy:**
```javascript
async function waitForCompletion(requestId, apiKey) {
  const maxAttempts = 60; // 5 minutes max
  const pollInterval = 5000; // 5 seconds
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://leb.visualabs.id/api/kieai-gateway/v1/status/${requestId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    const data = await response.json();
    
    if (data.status === 'completed') {
      return data.result;
    }
    
    if (data.status === 'failed') {
      throw new Error(data.error.message);
    }
    
    // Still processing, wait and retry
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error('Request timeout');
}
```

---

### 3. List Available Models

Mendapatkan daftar semua model yang tersedia beserta pricing.

**Endpoint:** `GET /models`

**Request Headers:**
```
Authorization: Bearer YOUR_API_KEY
```

**Response:**
```json
{
  "models": [
    {
      "id": "claude-sonnet-4-6",
      "family": "claude",
      "version": "4.6",
      "tier": "sonnet",
      "max_tokens": 4096,
      "pricing": {
        "input_usd_per_1m": 0.850,
        "output_usd_per_1m": 4.275,
        "input_credits_per_1m": 170,
        "output_credits_per_1m": 855
      }
    },
    {
      "id": "gemini-2.5-flash",
      "family": "gemini",
      "version": "2.5",
      "tier": "flash",
      "max_tokens": null,
      "pricing": {
        "input_usd_per_1m": 0.09,
        "output_usd_per_1m": 0.75,
        "input_credits_per_1m": 18,
        "output_credits_per_1m": 150
      }
    }
  ],
  "total": 12
}
```

**Example cURL:**
```bash
curl -X GET https://leb.visualabs.id/api/kieai-gateway/v1/models \
  -H "Authorization: Bearer apikey_visu4labsss_AImngerrzz"
```

---

## Available Models

### Claude Models (5)

| Model ID | Version | Tier | Input ($/1M) | Output ($/1M) | Input Credits | Output Credits |
|----------|---------|------|--------------|---------------|---------------|----------------|
| `claude-sonnet-4-6` | 4.6 | Sonnet | $0.850 | $4.275 | 170 | 855 |
| `claude-opus-4-6` | 4.6 | Opus | $1.425 | $7.150 | 285 | 1430 |
| `claude-haiku-4-5` | 4.5 | Haiku | $0.275 | $1.425 | 55 | 285 |
| `claude-sonnet-4-5` | 4.5 | Sonnet | $0.850 | $4.275 | 170 | 855 |
| `claude-opus-4-5` | 4.5 | Opus | $1.425 | $7.150 | 285 | 1430 |

**Claude-specific Options:**
- `thinkingFlag`: Enable extended thinking mode
- `output_config`: Configure output format
- `tools`: Function calling support

### Gemini Models (5)

| Model ID | Version | Tier | Input ($/1M) | Output ($/1M) | Input Credits | Output Credits |
|----------|---------|------|--------------|---------------|---------------|----------------|
| `gemini-2.5-flash` | 2.5 | Flash | $0.09 | $0.75 | 18 | 150 |
| `gemini-2.5-pro` | 2.5 | Pro | $0.38 | $3.00 | 76 | 600 |
| `gemini-3-flash` | 3 | Flash | $0.15 | $0.90 | 30 | 180 |
| `gemini-3.1-pro` | 3.1 | Pro | $0.50 | $3.50 | 100 | 700 |
| `gemini-3-pro` | 3 | Pro | $0.50 | $3.50 | 100 | 700 |

**Gemini-specific Options:**
- `include_thoughts`: Include reasoning in response
- `reasoning_effort`: Control reasoning depth
- `response_format`: JSON schema for structured output
- `tools`: Function calling or Google Search

### GPT Models (2)

| Model ID | Version | Tier | Input ($/1M) | Output ($/1M) | Input Credits | Output Credits |
|----------|---------|------|--------------|---------------|---------------|----------------|
| `gpt-5-4` | 5.4 | Codex | $0.70 | $5.60 | 140 | 1120 |
| `gpt-5-2` | 5.2 | Standard | $0.44 | $3.50 | 87.5 | 700 |

**GPT-specific Options:**
- `reasoning_effort`: low, medium, high, xhigh
- `tools`: Function calling or web search
- `tool_choice`: auto, none, or specific function

---

## Error Responses

### 400 Bad Request
```json
{
  "error": {
    "message": "Invalid request parameters: The model field is required.",
    "type": "invalid_request_error"
  }
}
```

### 401 Unauthorized
```json
{
  "error": {
    "message": "Invalid or missing API key",
    "type": "authentication_error"
  }
}
```

### 403 Forbidden
```json
{
  "error": {
    "message": "Unauthorized access to this request",
    "type": "authorization_error"
  }
}
```

### 404 Not Found
```json
{
  "error": {
    "message": "Request not found",
    "type": "not_found_error"
  }
}
```

---

## Rate Limiting

Gateway menggunakan **global rate limiting** untuk semua request ke KIE AI:
- **Limit:** 20 requests per 10 seconds
- **Scope:** Shared across ALL KIE AI services (video, chat, image, etc.)
- **Behavior:** Request akan di-queue dan diproses sesuai rate limit

Jika rate limit tercapai, request akan tetap di-queue dan diproses setelah slot tersedia.

---

## Complete Example (Node.js)

```javascript
const axios = require('axios');

const API_KEY = 'apikey_visu4labsss_AImngerrzz';
const BASE_URL = 'https://leb.visualabs.id/api/kieai-gateway/v1';

async function chatWithAI(model, messages) {
  try {
    // 1. Submit request
    const submitResponse = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: model,
        messages: messages,
        max_tokens: 2048
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const { request_id } = submitResponse.data;
    console.log('Request submitted:', request_id);
    
    // 2. Poll for result
    let attempts = 0;
    const maxAttempts = 60;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      
      const statusResponse = await axios.get(
        `${BASE_URL}/status/${request_id}`,
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`
          }
        }
      );
      
      const { status, result, error } = statusResponse.data;
      
      if (status === 'completed') {
        console.log('Request completed!');
        console.log('Response:', result.data.content);
        console.log('Cost:', result.data.pricing.cost_usd);
        return result;
      }
      
      if (status === 'failed') {
        throw new Error(`Request failed: ${error.message}`);
      }
      
      console.log(`Status: ${status}, attempt ${attempts + 1}/${maxAttempts}`);
      attempts++;
    }
    
    throw new Error('Request timeout');
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
chatWithAI('claude-sonnet-4-6', [
  { role: 'user', content: 'Explain quantum computing in simple terms' }
])
.then(result => {
  console.log('Success!');
})
.catch(error => {
  console.error('Failed:', error);
});
```

---

## Complete Example (Python)

```python
import requests
import time

API_KEY = 'apikey_visu4labsss_AImngerrzz'
BASE_URL = 'https://leb.visualabs.id/api/kieai-gateway/v1'

def chat_with_ai(model, messages):
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    # 1. Submit request
    response = requests.post(
        f'{BASE_URL}/chat/completions',
        json={
            'model': model,
            'messages': messages,
            'max_tokens': 2048 // opsional, lebih baik tidak disertakan
        },
        headers=headers
    )
    response.raise_for_status()
    
    request_id = response.json()['request_id']
    print(f'Request submitted: {request_id}')
    
    # 2. Poll for result
    max_attempts = 60
    for attempt in range(max_attempts):
        time.sleep(5)  # Wait 5 seconds
        
        status_response = requests.get(
            f'{BASE_URL}/status/{request_id}',
            headers=headers
        )
        status_response.raise_for_status()
        
        data = status_response.json()
        status = data['status']
        
        if status == 'completed':
            print('Request completed!')
            result = data['result']
            print(f"Response: {result['data']['content']}")
            print(f"Cost: ${result['data']['pricing']['cost_usd']['total']}")
            return result
        
        if status == 'failed':
            raise Exception(f"Request failed: {data['error']['message']}")
        
        print(f"Status: {status}, attempt {attempt + 1}/{max_attempts}")
    
    raise Exception('Request timeout')

# Usage
try:
    result = chat_with_ai('claude-sonnet-4-6', [
        {'role': 'user', 'content': 'Explain quantum computing in simple terms'}
    ])
    print('Success!')
except Exception as e:
    print(f'Failed: {e}')
```

---

## Best Practices

1. **Always handle polling properly**
   - Set reasonable timeout (5 minutes recommended)
   - Use exponential backoff if needed
   - Handle all status states (queued, processing, completed, failed)

2. **Store request_id**
   - Save request_id untuk tracking
   - Gunakan untuk retry jika connection terputus

3. **Monitor pricing**
   - Response selalu include pricing information
   - Track total cost per request
   - Set budget alerts

4. **Error handling**
   - Implement proper retry logic
   - Log errors untuk debugging
   - Handle rate limiting gracefully

5. **Security**
   - Jangan expose API key di client-side
   - Gunakan environment variables
   - Rotate API keys secara berkala

---

## Support

Untuk pertanyaan atau issue, hubungi tim development.
