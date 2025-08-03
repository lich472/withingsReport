import { Suspense } from 'react';
import CallbackClient from './callback-client';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Force this page to be dynamic (not statically generated)
export const dynamic = 'force-dynamic';

function CallbackSuspenseFallback() {
    return (
        <main className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-body">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center">
                    <CardTitle>Withings Authentication</CardTitle>
                    <CardDescription>Please wait while we securely connect your account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p>Initializing...</p>
                    </div>
                </CardContent>
            </Card>
        </main>
    )
}

export default function WithingsCallbackPage() {
  return (
    <Suspense fallback={<CallbackSuspenseFallback />}>
      <CallbackClient />
    </Suspense>
  );
}