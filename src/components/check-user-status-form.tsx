
'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Clipboard, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WithingsUser } from '@/lib/withings/types';

interface ApiResult {
  data?: { users: WithingsUser[] };
  message?: string;
  isError: boolean;
  details?: string;
}

export function CheckUserStatusForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;

    if (!email) {
      setResult({ isError: true, message: 'Please enter an email address.' });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/check-user-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw data;
      }
      
      if (!data.users || data.users.length === 0) {
        setResult({ isError: true, message: 'No user found with that email.' });
        return;
      }

      setResult({ isError: false, data });
    } catch (error: any) {
      setResult({ isError: true, message: error.message, details: error.details || error.stack || JSON.stringify(error, null, 2) });
    } finally {
      setIsLoading(false);
    }
  }

  const handleCopyDetails = () => {
    if (result?.details) {
      navigator.clipboard.writeText(result.details);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="check-email">Withings Email Address</Label>
            <Input
                id="check-email"
                name="email"
                type="email"
                placeholder="participant.email@example.com"
                required
            />
            <p className="text-xs text-muted-foreground">Check the status of a user registered with Withings.</p>
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...</> : 'Check User Status'}
        </Button>
      </form>
      {result && (
        <Alert variant={result.isError ? 'destructive' : 'default'} className="mt-4">
          {result.isError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <AlertTitle>{result.isError ? 'Error' : 'Status Found'}</AlertTitle>
          <AlertDescription>
            {result.isError ? (
              result.message
            ) : result.data?.users && result.data.users.length === 1 ? (
              <div>
                <p><strong>User ID:</strong> {result.data.users[0].userid}</p>
                <p><strong>Can Access Data:</strong> {result.data.users[0].fully_owned ? 'Yes' : 'No'}</p>
                {!result.data.users[0].fully_owned && (
                  <p className="mt-2 text-sm">
                    This user has not granted full ownership access, so their detailed sleep data cannot be retrieved via the API.
                  </p>
                )}
              </div>
            ) : result.data?.users && result.data.users.length > 1 ? (
                <div>
                    <p>Multiple users found for this email. Please resolve the ambiguity.</p>
                    <ul className="mt-2 list-disc pl-5 space-y-1">
                        {result.data.users.map(user => (
                            <li key={user.userid}>
                                <strong>User ID:</strong> {user.userid}, <strong>Can Access Data:</strong> {user.fully_owned ? 'Yes' : 'No'}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                'No user found.'
            )}
          </AlertDescription>
          {result.isError && result.details && (
            <Accordion type="single" collapsible className="w-full mt-2">
              <AccordionItem value="item-1" className="border-b-0">
                <AccordionTrigger className="text-sm py-1 hover:no-underline">View Details</AccordionTrigger>
                <AccordionContent>
                  <div className="relative">
                    <ScrollArea className="h-32 w-full rounded-md border p-2 pr-10 mt-1 bg-muted/50">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                        <code>{result.details}</code>
                      </pre>
                    </ScrollArea>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={handleCopyDetails}
                    >
                      <span className="sr-only">Copy details</span>
                      {isCopied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </Alert>
      )}
    </div>
  );
}
