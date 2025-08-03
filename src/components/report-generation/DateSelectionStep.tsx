
'use client';

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AvailableDates } from "@/app/page";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Download, HelpCircle } from "lucide-react";
import type { DateRange } from "react-day-picker";

interface DateSelectionStepProps {
  availableDates: AvailableDates | null;
  selectedRange?: DateRange;
  setSelectedRange: (range?: DateRange) => void;
  reportLabel: string;
  setReportLabel: (label: string) => void;
  applyTimezoneConversion: boolean;
  setApplyTimezoneConversion: (checked: boolean) => void;
  downloadOnly: boolean;
  setDownloadOnly: (checked: boolean) => void;
  onSubmit: () => void;
}

export function DateSelectionStep({
  availableDates,
  selectedRange,
  setSelectedRange,
  reportLabel,
  setReportLabel,
  applyTimezoneConversion,
  setApplyTimezoneConversion,
  downloadOnly,
  setDownloadOnly,
  onSubmit,
}: DateSelectionStepProps) {

  const renderTimezonePreview = () => {
    if (!availableDates?.previewData) return 'Fetching preview...';
    return (
      <div className="text-left">
        <p className="font-bold mb-1">Example Wake Times:</p>
        <ul className="list-disc pl-4 space-y-1">
          {availableDates.previewData.map((item, index) => {
            const dateObj = new Date(item.enddate * 1000);
            const localTime = dateObj.toLocaleString('en-US', { timeZone: item.timezone, hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
            const utcTime = dateObj.toLocaleString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
            return (
              <li key={index}>
                {applyTimezoneConversion ? (
                  <><b>{localTime}</b> (Timezone: {item.timezone})</>
                ) : (
                  <><b>{utcTime}</b> (Original UTC)</>
                )}
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs">Dates are adjusted to the device's timezone.</p>
      </div>
    )
  }

  if (!availableDates) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className='space-y-2'>
        <Label>Select Date Range for Epoch Data</Label>
        <p className="text-xs text-muted-foreground">
          Data available from {format(availableDates.minDate, "LLL dd, y")} to {format(availableDates.maxDate, "LLL dd, y")}.
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn("w-full justify-start text-left font-normal", !selectedRange && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedRange?.from ? (
                selectedRange.to ? (
                  <>
                    {format(selectedRange.from, "LLL dd, y")} -{" "}
                    {format(selectedRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(selectedRange.from, "LLL dd, y")
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
              defaultMonth={availableDates.maxDate}
              selected={selectedRange}
              onSelect={setSelectedRange}
              numberOfMonths={2}
              fromDate={availableDates.minDate}
              toDate={availableDates.maxDate}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reportLabel">Report Label</Label>
        <Input
          id="reportLabel"
          value={reportLabel}
          onChange={(e) => setReportLabel(e.target.value)}
          placeholder="e.g., participant-01-pre"
          required
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="timezone" checked={applyTimezoneConversion} onCheckedChange={(checked) => setApplyTimezoneConversion(!!checked)} />
        <div className="flex items-center gap-1.5">
          <label htmlFor="timezone" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Apply timezone conversion
          </label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="w-80">
                {renderTimezonePreview()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="downloadOnly" checked={downloadOnly} onCheckedChange={(checked) => setDownloadOnly(!!checked)} />
        <label htmlFor="downloadOnly" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Download data only (skip report generation)
        </label>
      </div>
      <Button onClick={onSubmit} className="w-full font-headline" disabled={!selectedRange?.from || !selectedRange?.to || !reportLabel}>
        {downloadOnly ? <><Download className="mr-2 h-4 w-4" /> Download Data</> : 'Generate Report'}
      </Button>
    </div>
  );
}
