
'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ApiResult } from "@/app/page";
import { AlertCircle, Check, CheckCircle2, Clipboard, Download, ExternalLink } from "lucide-react";
import { useState } from "react";

interface CompleteStepProps {
  apiResult: ApiResult | null;
  generatedReportHtml: string | null;
  showReportInNewTab: (html: string) => void;
  triggerHtmlDownload: (html: string) => void;
  onReset: () => void;
}

export function CompleteStep({ apiResult, generatedReportHtml, showReportInNewTab, triggerHtmlDownload, onReset }: CompleteStepProps) {
  const [isDetailsCopied, setIsDetailsCopied] = useState(false);

  const handleCopyDetails = () => {
    if (apiResult?.details) {
      navigator.clipboard.writeText(apiResult.details);
      setIsDetailsCopied(true);
      setTimeout(() => {
        setIsDetailsCopied(false);
      }, 2000);
    }
  };

  if (!apiResult) {
    return null;
  }

  return (
    <div className="w-full space-y-4">
      <Alert variant={apiResult.isError ? 'destructive' : 'default'} className="w-full">
        {apiResult.isError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        <AlertTitle>{apiResult.isError ? 'Error' : 'Success!'}</AlertTitle>
        <AlertDescription>
          {apiResult.message}
        </AlertDescription>
        {apiResult.isError && apiResult.details && (
          <Accordion type="single" collapsible className="w-full mt-2">
            <AccordionItem value="item-1" className="border-b-0">
              <AccordionTrigger className="text-sm py-1 hover:no-underline">View Details</AccordionTrigger>
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
                    {isDetailsCopied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </Alert>
      <div className="flex flex-col gap-2">
        {!apiResult.isError && generatedReportHtml && (
          <>
            <Button onClick={() => showReportInNewTab(generatedReportHtml)}>
              <ExternalLink className="mr-2 h-4 w-4" /> View Report
            </Button>
            <Button onClick={() => triggerHtmlDownload(generatedReportHtml)} variant="secondary">
              <Download className="mr-2 h-4 w-4" /> Download Report
            </Button>
          </>
        )}
        <Button onClick={onReset} variant="outline">
          Generate Another
        </Button>
      </div>
    </div>
  );
}
