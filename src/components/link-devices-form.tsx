
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Clipboard, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

const formSchema = z.object({
  participant_id: z.string().uuid({ message: 'Invalid Participant ID (must be a UUID).' }),
  mac_address_wsa: z.string().min(1, { message: 'WSA MAC address is required.' }),
  mac_address_hub: z.string().min(1, { message: 'Hub MAC address is required.' }),
  override_mac_address_wsa: z.boolean().default(false),
  override_mac_address_hub: z.boolean().default(false),
});

export function LinkDevicesForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [apiResult, setApiResult] = useState<{ message: string; isError: boolean; details?: string; } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      participant_id: '',
      mac_address_wsa: '',
      mac_address_hub: '',
      override_mac_address_wsa: false,
      override_mac_address_hub: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setApiResult(null);

    try {
      const response = await fetch('/api/link-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
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
            name="participant_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Participant ID</FormLabel>
                <FormControl>
                  <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mac_address_wsa"
            render={({ field }) => (
              <FormItem>
                <FormLabel>WSA MAC Address</FormLabel>
                <FormControl>
                  <Input placeholder="00:24:e4:xx:xx:xx" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mac_address_hub"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hub MAC Address</FormLabel>
                <FormControl>
                  <Input placeholder="00:24:e4:xx:xx:xx" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="space-y-2">
             <FormField
                control={form.control}
                name="override_mac_address_wsa"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Override existing WSA MAC address
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="override_mac_address_hub"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Override existing Hub MAC address
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Link Devices
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
                        <AccordionTrigger className="text-sm py-1 hover:no-underline">{apiResult.isError ? 'View Error Details' : 'View Response Data'}</AccordionTrigger>
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

    