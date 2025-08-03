
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export const dynamic = 'force-dynamic';

export default function CallbackClient() {
  const [message, setMessage] = useState('Authenticating with Withings...');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('🔍 Callback params:', { code: code ? 'present' : 'missing', state: state ? 'present' : 'missing', error });

    if (error) {
      localStorage.setItem('withings_auth_result', JSON.stringify({
        success: false,
        error: error,
        timestamp: Date.now()
      }));
      setMessage(`Authentication failed: ${error}`);
      setStatus('error');
      return;
    }

    if (typeof code !== 'string' || code.length === 0 || typeof state !== 'string' || state.length === 0) {
      localStorage.setItem('withings_auth_result', JSON.stringify({
        success: false,
        error: 'Invalid callback parameters',
        timestamp: Date.now()
      }));
      setMessage('Invalid callback parameters received from Withings. This can happen if the Redirect URI in your Withings developer application settings does not exactly match the one used by this app.');
      setStatus('error');
      return;
    }

    const savedState = sessionStorage.getItem('withings_oauth_state');
    console.log('🔐 State validation:', { received: state, saved: savedState, match: state === savedState });
    
    if (state !== savedState) {
      localStorage.setItem('withings_auth_result', JSON.stringify({
        success: false,
        error: 'Invalid state parameter',
        timestamp: Date.now()
      }));
      setMessage('Invalid state parameter. Potential security risk. Please try again.');
      setStatus('error');
      return;
    }

    sessionStorage.removeItem('withings_oauth_state');

    const exchangeCodeForToken = async () => {
      try {
        const redirectUri = process.env.NODE_ENV === 'production'
          ? 'https://studio--withings-sleeper.us-central1.hosted.app/auth/withings/callback'
          : `${window.location.origin}/auth/withings/callback`;
        console.log('📤 Redirect URI being sent:', redirectUri);
        
        const response = await fetch('/api/withings/exchange-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });

        console.log('🌐 Exchange response status:', response.status);
        const result = await response.json();
        console.log('🌐 Exchange response data:', result);
        
        if (!response.ok || !result.access_token || !result.userid) {
          throw new Error(result.message || 'Failed to exchange authorization code for an access token or user ID.');
        }

        sessionStorage.setItem('withings_temp_token', result.access_token);
        console.log('💾 Token saved to sessionStorage');
        
        localStorage.setItem('withings_auth_result', JSON.stringify({
          success: true,
          token: result.access_token,
          userid: result.userid,
          timestamp: Date.now()
        }));
        console.log('📤 Success result (token and userid) stored in localStorage');
        
        setMessage('Authentication successful! You can now close this window.');
        setStatus('success');
        
        setTimeout(() => {
          console.log('🔚 Closing window');
          window.close();
        }, 1500);

      } catch (err: any) {
        console.log('❌ Exchange error:', err);
        
        localStorage.setItem('withings_auth_result', JSON.stringify({
          success: false,
          error: err.message,
          timestamp: Date.now()
        }));
        
        setMessage(`Error: ${err.message}`);
        setStatus('error');
      }
    };

    exchangeCodeForToken();
  }, [searchParams]);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-body">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle>Withings Authentication</CardTitle>
          <CardDescription>Please wait while we securely connect your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p>{message}</p>
            </div>
          )}
          {status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Authentication Failed</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {status === 'success' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
