
import { createHmac } from 'crypto';

const API_ENDPOINT = 'https://wbsapi.withings.net';

export function sign(params: Record<string, any>, clientSecret: string): string {
    const paramsToSign: Record<string, any> = {
        action: params['action'],
        client_id: params['client_id'],
    };
    if ('timestamp' in params) {
        paramsToSign['timestamp'] = params['timestamp'];
    }
    if ('nonce' in params) {
        paramsToSign['nonce'] = params['nonce'];
    }
    
    const sortedValues = Object.keys(paramsToSign)
        .sort()
        .map(key => paramsToSign[key])
        .join(',');
        
    const hmac = createHmac('sha256', clientSecret);
    hmac.update(sortedValues);
    return hmac.digest('hex');
}

export async function getNonce(timestamp: number, clientId: string, clientSecret: string): Promise<string> {
    if (!clientId || !clientSecret) {
        throw new Error("WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET must be set.");
    }

    const params: Record<string, any> = {
        action: 'getnonce',
        client_id: clientId,
        timestamp: timestamp
    };

    params['signature'] = sign(params, clientSecret);

    const response = await fetch(`${API_ENDPOINT}/v2/signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
    });

    const data = await response.json();

    if (data.status !== 0) {
        throw new Error(`Withings API error when getting nonce: ${data.error || 'Unknown error'}`);
    }

    return data.body.nonce;
}
