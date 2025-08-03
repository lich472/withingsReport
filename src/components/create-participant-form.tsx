
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, HelpCircle, Clipboard, Check } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  first_name: z.string().min(1, { message: 'First name is required.' }),
  last_name: z.string().min(1, { message: 'Last name is required.' }),
  short_name: z.string().min(1, { message: 'Short name is required.' }),
  study_code: z.string().min(1, { message: 'Study code is required.' }),
});

export function CreateParticipantForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [apiResult, setApiResult] = useState<{ message: string; isError: boolean; details?: string; } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const { user } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      short_name: '',
      study_code: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setApiResult(null);

    if (!user?.email) {
      setApiResult({ message: 'You must be logged in to create a participant.', isError: true });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/create-participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, requesterEmail: user.email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw result;
      }

      setApiResult({ message: result.message, isError: false, details: JSON.stringify(result.data, null, 2) });
      form.reset();
    } catch (error: any) {
      setApiResult({ message: error.message, isError: true, details: error.details || error.stack || JSON.stringify(error, null, 2) });
    } finally {
      setIsLoading(false);
    }
  }

  const handleCopyDetails = () => {
    if (apiResult?.details) {
      navigator.clipboard.writeText(apiResult.details);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="participant@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="STUDYNAME" {...field} />
                </FormControl>
                <FormDescription>
                  Used for app display. E.g., "STUDYNAME"
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="P01" {...field} />
                </FormControl>
                 <FormDescription>
                  Used for app display. E.g., "P01"
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="short_name"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-1.5">
                  <FormLabel>Short Name / Label</FormLabel>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This must be 3 letters and will be displayed on device screens.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <FormControl>
                  <Input placeholder="ABC" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="study_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Study Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., aish-clinic-study" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Participant
          </Button>
        </form>
      </Form>
      {apiResult && (
        <Alert variant={apiResult.isError ? 'destructive' : 'default'} className="mt-4">
          {apiResult.isError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <AlertTitle>{apiResult.isError ? 'Error' : 'Success!'}</AlertTitle>
          <AlertDescription>
            {apiResult.message}
            {apiResult.details && (
                <Accordion type="single" collapsible className="w-full mt-2">
                    <AccordionItem value="item-1" className="border-b-0">
                        <AccordionTrigger className="text-sm py-1 hover:no-underline">{apiResult.isError ? 'View Error Details' : 'View Participant Data'}</AccordionTrigger>
                        <AccordionContent>
                            <div className="relative">
                                <ScrollArea className="h-32 w-full rounded-md border p-2 pr-10 mt-1 bg-muted/50">
                                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                        <code>{apiResult.details}</code>
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
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
