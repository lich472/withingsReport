
import { getNonce, sign } from './signature';
import type { SleepSummaryResponse, WithingsUser, WithingsDevice, SleepEpochsResponse, SleepEpochRecord } from './types';

const API_ENDPOINT = "https://wbsapi.withings.net";
const OAUTH2_GRANT_TYPE_AUTHORIZATION_CODE = "authorization_code";

export class WithingsClient {
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    if (!clientId || !clientSecret) {
      throw new Error("Withings Client ID and Secret are required.");
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }
  
  private async _fetchWithingsApi(url: string, options: RequestInit): Promise<any> {
    const response = await fetch(url, options);
    const responseText = await response.text();

    try {
        const data = JSON.parse(responseText);
        if (data.status !== 0) {
            const error: any = new Error(`Withings API Error: ${data.error || 'Unknown Error'}`);
            error.details = `API returned status ${data.status}. Full response: ${responseText}`;
            throw error;
        }
        return data;
    } catch (e: any) {
        // If it's already a detailed error, re-throw it.
        if(e.details) throw e;

        // If JSON parsing fails, it's likely an HTML error page.
        const error: any = new Error("Failed to parse Withings API response as JSON. The API may have returned an HTML error page.");
        error.details = `Raw Response from Withings: ${responseText}`;
        throw error;
    }
  }

  private async listUsers(): Promise<{ users: WithingsUser[] }> {
    const nonce = await getNonce(Math.floor(Date.now() / 1000), this.clientId, this.clientSecret);
    const params: Record<string, any> = {
      action: "listusers",
      client_id: this.clientId,
      nonce,
    };
    params.signature = sign(params, this.clientSecret);

    const data = await this._fetchWithingsApi(`${API_ENDPOINT}/v2/oauth2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });

    if (!data.body || !Array.isArray(data.body.users)) {
        throw new Error(`Invalid response body from listUsers. Expected 'body.users' to be an array. Full response: ${JSON.stringify(data)}`);
    }
    return data.body;
  }

  async findUserByEmail(email: string): Promise<WithingsUser[]> {
    const { users } = await this.listUsers();
    
    const matchingUsers = users.filter(user => user.email && user.email.toLowerCase() === email.toLowerCase());

    if (matchingUsers.length === 0) {
      const error: any = new Error(`Could not find user with email ${email}.`);
      error.details = `The API call to list users was successful and returned ${users.length} user(s), but none matched.`;
      throw error;
    }
    
    return matchingUsers;
  }

  async getAccessToken(userId: number): Promise<string> {
    const nonce = await getNonce(Math.floor(Date.now() / 1000), this.clientId, this.clientSecret);
    let params: Record<string, any> = {
      action: "recoverauthorizationcode",
      client_id: this.clientId,
      nonce,
      userid: userId,
    };
    params.signature = sign(params, this.clientSecret);

    let authData = await this._fetchWithingsApi(`${API_ENDPOINT}/v2/oauth2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params)
    });
    
    if (!authData.body?.user?.code) {
        throw new Error(`Cannot get authorization code. Full response: ${JSON.stringify(authData)}`);
    }
    const code = authData.body.user.code;
    
    params = {
      action: "requesttoken",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: OAUTH2_GRANT_TYPE_AUTHORIZATION_CODE,
      code,
    };
    
    const tokenData = await this._fetchWithingsApi(`${API_ENDPOINT}/v2/oauth2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params)
    });

    if (!tokenData.body?.access_token) {
        throw new Error(`Cannot get access token. Full response: ${JSON.stringify(tokenData)}`);
    }
    
    return tokenData.body.access_token;
  }
  
  async getUserIdFromToken(accessToken: string): Promise<number> {
    const data = await this._fetchWithingsApi(`${API_ENDPOINT}/user`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ action: 'getbyuserid' }),
    });

    if (!data.body?.users?.[0]?.id) {
        throw new Error(`Could not get user ID from token. Full response: ${JSON.stringify(data)}`);
    }
    return data.body.users[0].id;
  }

  private async getDevices(accessToken: string): Promise<{ devices: WithingsDevice[] }> {
    try {
        const data = await this._fetchWithingsApi(`${API_ENDPOINT}/v2/user`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ action: 'getdevice' }),
        });
        return data.body || { devices: [] };
    } catch (error: any) {
        console.warn(`Could not get devices: ${error.message}. Proceeding without device date range.`);
        return { devices: [] };
    }
  }

  async getSleepSummary(accessToken: string, startDateYmd?: string, endDateYmd?: string): Promise<SleepSummaryResponse> {
    let finalStartDate = startDateYmd;
    let finalEndDate = endDateYmd;
    
    if (!finalStartDate || !finalEndDate) {
        try {
            const { devices } = await this.getDevices(accessToken);
            const sleepDevices = devices?.filter(d => "last_session_date" in d) || [];
            const startTimestamps = sleepDevices.map(d => d.first_session_date).filter(Boolean) as number[];
            
            if (startTimestamps.length > 0) {
                const startTs = Math.min(...startTimestamps);
                finalStartDate = new Date(startTs * 1000).toISOString().split('T')[0];
            } else {
                console.log("No device session dates found, defaulting start date to 2021-01-01.");
                finalStartDate = '2021-01-01';
            }
        } catch (error: any) {
            console.warn(`Could not retrieve device information: ${error.message}. Proceeding with default date range.`);
            finalStartDate = '2021-01-01';
        }
        finalEndDate = new Date().toISOString().split('T')[0];
    }
    
    console.log(`Getting sleep summary from ${finalStartDate} to ${finalEndDate}`);

    const dataFields = "total_timeinbed,total_sleep_time,asleepduration,lightsleepduration,remsleepduration,deepsleepduration,sleep_efficiency,sleep_latency,wakeup_latency,wakeupduration,wakeupcount,waso,nb_rem_episodes,apnea_hypopnea_index,withings_index,durationtosleep,durationtowakeup,out_of_bed_count,hr_average,hr_min,hr_max,rr_average,rr_min,rr_max,snoring,snoringepisodecount,sleep_score,night_events,mvt_score_avg,mvt_active_duration,chest_movement_rate_average,chest_movement_rate_min,chest_movement_rate_max,breathing_sounds,breathing_sounds_episode_count";

    const params = new URLSearchParams({
      action: "getsummary",
      startdateymd: finalStartDate,
      enddateymd: finalEndDate,
      data_fields: dataFields,
    });

    const responseData = await this._fetchWithingsApi(`${API_ENDPOINT}/v2/sleep`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
    });
    
    if (responseData.status === 293) {
        console.log("Withings API returned status 293: No data found for this user in the specified range.");
    }
    
    return responseData;
  }

  async getSleepEpochs(accessToken: string, sleepSummary: SleepSummaryResponse): Promise<SleepEpochRecord[]> {
    const debugLog: string[] = [];

    if (sleepSummary.status !== 0 || !sleepSummary.body?.series || sleepSummary.body.series.length === 0) {
        debugLog.push("Epoch fetch failed: Invalid or empty sleep summary data provided.");
        return [];
    }

    const dataFields = "hr,rr,snoring,sdnn_1,rmssd,mvt_score,chest_movement_rate,withings_index,breathing_sounds";
    const allEpochs: SleepEpochRecord[] = [];

    let series = [...sleepSummary.body.series];
    series.sort((a, b) => b.startdate - a.startdate);
    
    debugLog.push(`Attempting to fetch epoch data for ${series.length} sleep records...`);

    for (let i = 0; i < series.length; i++) {
        const record = series[i];
        const logPrefix = `[Night ${i + 1}/${series.length}, ID ${record.id}]`;
        debugLog.push(`${logPrefix} Fetching from ${new Date(record.startdate * 1000).toISOString()} to ${new Date(record.enddate * 1000).toISOString()}`);
        
        const params = new URLSearchParams({
            action: 'get',
            startdate: record.startdate.toString(),
            enddate: record.enddate.toString(),
            data_fields: dataFields
        });
        
        try {
            const epochData: SleepEpochsResponse = await this._fetchWithingsApi(`${API_ENDPOINT}/v2/sleep`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            });
            
            if (Array.isArray(epochData.body.series) && epochData.body.series.length > 0) {
                debugLog.push(`${logPrefix} Success: Found ${epochData.body.series.length} epoch entries.`);
                allEpochs.push({
                    sleep_id: record.id,
                    series: epochData.body.series
                });
            } else {
                const errorReason = epochData.error ? `API Error: ${epochData.error}` : 'Response was empty or malformed.';
                debugLog.push(`${logPrefix} Failed: Status ${epochData.status}. ${errorReason}`);
            }
        } catch (e: any) {
             debugLog.push(`${logPrefix} Exception during fetch: ${e.message}`);
             // Re-throw with all the details for frontend display
             const error: any = new Error(e.message);
             error.details = e.details || debugLog.join('\\n');
             throw error;
        }
        
        if (i < series.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    debugLog.push(`Finished fetching epoch data. Found data for ${allEpochs.length} nights.`);

    if (allEpochs.length === 0 && series.length > 0) {
        const error: any = new Error("No epoch data was successfully collected for any of the sleep records.");
        error.details = debugLog.join('\\n');
        throw error;
    }

    return allEpochs;
  }
}
