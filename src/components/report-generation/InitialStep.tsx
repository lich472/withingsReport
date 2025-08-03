
'use client';

import { FormEvent, useState } from "react";
import Papa from "papaparse";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ApiResult, AvailableDates } from "@/app/page";
import type { AccessRules } from "@/lib/access-control";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { AlertCircle, Calendar as CalendarIcon, Check, Clipboard, HelpCircle, Loader2, Upload } from "lucide-react";

interface InitialStepProps {
  handleEmailSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  apiResult: ApiResult | null;
  setApiResult: (result: ApiResult | null) => void;
  accessRulesResult: { rules: AccessRules | null; message: string; } | null;

  // CSV Props
  handleGenerateFromCsv: (e: FormEvent) => void;
  csvLabel: string;
  setCsvLabel: (label: string) => void;
  setSummaryFile: (file: File | null) => void;
  csvAvailableDates: AvailableDates | null;
  setCsvAvailableDates: (dates: AvailableDates | null) => void;
  csvSelectedRange?: DateRange;
  setCsvSelectedRange: (range?: DateRange) => void;
  csvApplyTimezone: boolean;
  setCsvApplyTimezone: (checked: boolean) => void;
  includeEpochData: boolean;
  setIncludeEpochData: (checked: boolean) => void;
  epochFile: File | null;
  setEpochFile: (file: File | null) => void;
}

export function InitialStep({
  handleEmailSubmit,
  isLoading,
  apiResult,
  setApiResult,
  accessRulesResult,
  handleGenerateFromCsv,
  csvLabel,
  setCsvLabel,
  setSummaryFile,
  csvAvailableDates,
  setCsvAvailableDates,
  csvSelectedRange,
  setCsvSelectedRange,
  csvApplyTimezone,
  setCsvApplyTimezone,
  includeEpochData,
  setIncludeEpochData,
  epochFile,
  setEpochFile,
}: InitialStepProps) {
  const [isDetailsCopied, setIsDetailsCopied] = useState(false);
  const [isCsvLoading, setIsCsvLoading] = useState(false);

  const handleCopyDetails = () => {
    if (apiResult?.details) {
      navigator.clipboard.writeText(apiResult.details);
      setIsDetailsCopied(true);
      setTimeout(() => {
        setIsDetailsCopied(false);
      }, 2000);
    }
  };

  const handleSummaryFileChange = async (file: File | null) => {
    setSummaryFile(file);
    if (!file) {
      setCsvAvailableDates(null);
      setCsvSelectedRange(undefined);
      return;
    }

    setIsCsvLoading(true);
    setApiResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        const headers = results.meta.fields || [];

        const dateColumn = headers.includes('w_enddate') ? 'w_enddate' : headers.includes('enddate_utc') ? 'enddate_utc' : null;

        if (dateColumn) {
          const dates = data
            .map(row => new Date(row[dateColumn]))
            .filter(d => !isNaN(d.getTime()));

          if (dates.length > 0) {
            const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
            const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
            maxDate.setHours(23, 59, 59, 999);

            setCsvAvailableDates({ minDate, maxDate });
            setCsvSelectedRange({ from: minDate, to: maxDate });
          } else {
            setApiResult({ message: 'No valid dates found in the date column of the summary CSV.', isError: true });
            setCsvAvailableDates(null);
          }
        } else {
          setApiResult({ message: 'Could not find a valid date column (w_enddate or enddate_utc) in the summary CSV.', isError: true });
          setCsvAvailableDates(null);
        }
        setIsCsvLoading(false);
      },
      error: (error: any) => {
        setApiResult({ message: `Error parsing CSV: ${error.message}`, isError: true });
        setIsCsvLoading(false);
      }
    });
  };

  return (
    <Tabs defaultValue="withings" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="withings">From Withings</TabsTrigger>
        <TabsTrigger value="csv">From CSV</TabsTrigger>
      </TabsList>
      <TabsContent value="withings">
        <form onSubmit={handleEmailSubmit}>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Withings User Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="user@example.com"
                required
              />
            </div>
            <Button type="submit" className="w-full font-headline" aria-disabled={isLoading} disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking...</> : 'Continue'}
            </Button>
          </div>
        </form>
      </TabsContent>
      <TabsContent value="csv">
        <form onSubmit={handleGenerateFromCsv}>
          {!csvAvailableDates ? (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="csvLabel">Report Label</Label>
                <Input id="csvLabel" value={csvLabel} onChange={(e) => setCsvLabel(e.target.value)} placeholder="e.g., my-report-1" required />
                <p className="text-xs text-muted-foreground">This will be used for the report filename.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="summaryFile">Summary CSV</Label>
                <Input id="summaryFile" type="file" accept=".csv" required onChange={(e) => handleSummaryFileChange(e.target.files ? e.target.files[0] : null)} />
                <p className="text-xs text-muted-foreground">Uploading this will reveal date selection.</p>
              </div>
              {isCsvLoading && <div className="flex justify-center pt-2"><Loader2 className="h-6 w-6 animate-spin" /></div>}
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <div className='space-y-2'>
                <Label>Select Date Range from CSV</Label>
                <p className="text-xs text-muted-foreground">
                  Data available from {format(csvAvailableDates.minDate, "LLL dd, y")} to {format(csvAvailableDates.maxDate, "LLL dd, y")}.
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="csvDate"
                      variant={"outline"}
                      className={cn("w-full justify-start text-left font-normal", !csvSelectedRange && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {csvSelectedRange?.from ? (
                        csvSelectedRange.to ? (
                          <>
                            {format(csvSelectedRange.from, "LLL dd, y")} -{" "}
                            {format(csvSelectedRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(csvSelectedRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={csvAvailableDates.maxDate}
                      selected={csvSelectedRange}
                      onSelect={setCsvSelectedRange}
                      numberOfMonths={2}
                      fromDate={csvAvailableDates.minDate}
                      toDate={csvAvailableDates.maxDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="csvTimezone" checked={csvApplyTimezone} onCheckedChange={(checked) => setCsvApplyTimezone(!!checked)} />
                <div className="flex items-center gap-1.5">
                  <label htmlFor="csvTimezone" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Apply timezone conversion
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="w-80">
                        <p>When checked, dates and times are adjusted from UTC to the local timezone in your CSV's 'timezone' column. Uncheck if your data (e.g., from SNAPI or YawnLabs) is already in the correct local time.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="includeEpoch" checked={includeEpochData} onCheckedChange={(checked) => setIncludeEpochData(!!checked)} />
                <label htmlFor="includeEpoch" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Include epoch data for nightly analysis
                </label>
              </div>
              {includeEpochData && (
                <div className="space-y-2">
                  <Label htmlFor="epochFile">Epoch CSV</Label>
                  <Input id="epochFile" type="file" accept=".csv" onChange={(e) => setEpochFile(e.target.files ? e.target.files[0] : null)} />
                </div>
              )}
              <Button type="submit" className="w-full font-headline" disabled={isLoading || !csvSelectedRange?.from || !csvSelectedRange?.to}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Upload className="mr-2 h-4 w-4" /> Generate from CSVs</>}
              </Button>
              <Button variant="link" size="sm" onClick={() => { setCsvAvailableDates(null); setSummaryFile(null); }} className="w-full h-auto py-1">
                Use a different CSV
              </Button>
            </div>
          )}
        </form>
      </TabsContent>
      {accessRulesResult && (
        <Alert variant={accessRulesResult.rules ? 'default' : 'destructive'} className="w-full mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Rules</AlertTitle>
          <AlertDescription>
            <pre className="text-xs whitespace-pre-wrap"><code>{JSON.stringify(accessRulesResult.rules, null, 2)}</code></pre>
          </AlertDescription>
        </Alert>
      )}
      {apiResult?.isError && (
        <Alert variant='destructive' className="w-full mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {apiResult.message}
          </AlertDescription>
          {apiResult.details && (
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
      )}
    </Tabs>
  );
}
