
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Bed, User as UserIcon, LogOut } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateParticipantForm } from '@/components/create-participant-form';
import { CheckUserStatusForm } from '@/components/check-user-status-form';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

import type { WithingsUser } from '@/lib/withings/types';
import type { AccessRules } from '@/lib/access-control';
import { DateRange } from 'react-day-picker';
import { differenceInDays, format } from 'date-fns';

import { InitialStep } from '@/components/report-generation/InitialStep';
import { UserSelectionStep } from '@/components/report-generation/UserSelectionStep';
import { DateSelectionStep } from '@/components/report-generation/DateSelectionStep';
import { PermissionStep } from '@/components/report-generation/PermissionStep';
import { GeneratingStep } from '@/components/report-generation/GeneratingStep';
import { CompleteStep } from '@/components/report-generation/CompleteStep';
import { cn } from '@/lib/utils';


export type Step = 'initial' | 'userSelection' | 'dateSelection' | 'generating' | 'complete';

export interface ApiResult {
  message: string | null;
  isError: boolean;
  details?: string;
}

export interface AvailableDates {
  minDate: Date;
  maxDate: Date;
  previewData?: { enddate: number, timezone: string }[];
}

const progressSteps = [
  { text: 'Initializing...', progress: 10 },
  { text: 'Requesting sleep data from Withings API...', progress: 30 },
  { text: 'Processing detailed epoch data...', progress: 60 },
  { text: 'Generating summary plots...', progress: 80 },
];


export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('initial');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiResult, setApiResult] = useState<ApiResult | null>(null);
  
  const [availableDates, setAvailableDates] = useState<AvailableDates | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);
  const [timeEstimate, setTimeEstimate] = useState('');
  const [downloadOnly, setDownloadOnly] = useState(false);
  const [reportLabel, setReportLabel] = useState('');
  const [applyTimezoneConversion, setApplyTimezoneConversion] = useState(true);

  // User Selection State
  const [userSelection, setUserSelection] = useState<WithingsUser[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [isFullyOwned, setIsFullyOwned] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);

  // Access Rules state
  const [accessRulesResult, setAccessRulesResult] = useState<{rules: AccessRules | null, message: string} | null>(null);

  // CSV Flow State
  const [csvLabel, setCsvLabel] = useState('');
  const [summaryFile, setSummaryFile] = useState<File | null>(null);
  const [epochFile, setEpochFile] = useState<File | null>(null);
  const [includeEpochData, setIncludeEpochData] = useState(true);
  const [csvAvailableDates, setCsvAvailableDates] = useState<AvailableDates | null>(null);
  const [csvSelectedRange, setCsvSelectedRange] = useState<DateRange | undefined>();
  const [csvApplyTimezone, setCsvApplyTimezone] = useState(true);

  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [generatedReportHtml, setGeneratedReportHtml] = useState<string | null>(null);

  // Card flip state
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Text animation state
  const [isAnimatingText, setIsAnimatingText] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    let timeouts: NodeJS.Timeout[] = [];
    if (step === 'generating') {
      setProgress(5);
      setProgressText("Initializing...");
      let totalNights = 0;
      if (selectedRange?.from && selectedRange.to) {
        totalNights = differenceInDays(selectedRange.to, selectedRange.from) + 1;
      }
      
      let cumulativeDelay = 1000;
      let lastProgress = 0;

      // Static progress steps
      timeouts = progressSteps.map(stepInfo => {
        const timeout = setTimeout(() => {
          setProgress(stepInfo.progress);
          setProgressText(stepInfo.text);
          lastProgress = stepInfo.progress;
        }, cumulativeDelay);
        cumulativeDelay += 1800;
        return timeout;
      });

      // Dynamic progress for nightly views
      if (totalNights > 0 && !downloadOnly) {
        const assembleStepTimeout = setTimeout(() => {
          const finalProgress = 95;
          const progressIncrement = (finalProgress - lastProgress) / totalNights;
          
          for (let i = 1; i <= totalNights; i++) {
            const nightTimeout = setTimeout(() => {
              const currentProgress = Math.min(lastProgress + (i * progressIncrement), finalProgress);
              const percentage = Math.round((i / totalNights) * 100);
              setProgressText(`Assembling interactive nightly views... (${percentage}%)`);
              setProgress(currentProgress);
            }, (i - 1) * 200);
            timeouts.push(nightTimeout);
          }

        }, cumulativeDelay);
        timeouts.push(assembleStepTimeout);
      }
    }
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [step, selectedRange, downloadOnly]);
  
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    
    if (authRequired) {
        console.log('🔍 Starting to poll for auth result...');
        
        pollInterval = setInterval(() => {
            const authResult = localStorage.getItem('withings_auth_result');
            
            if (authResult) {
                try {
                    const result = JSON.parse(authResult);
                    const age = Date.now() - result.timestamp;
                    
                    if (age < 5 * 60 * 1000) {
                        if (result.success && result.token && result.userid) {
                            console.log('✅ Found auth success in localStorage');
                            
                            sessionStorage.setItem('withings_temp_token', result.token);
                            localStorage.removeItem('withings_auth_result');
                            
                            const numericUserId = parseInt(result.userid, 10);
                            if (!isNaN(numericUserId)) {
                                setActiveUserId(numericUserId);
                                setIsFullyOwned(false); 
                                setAuthRequired(false);
                                fetchDateRange(numericUserId); 
                            } else {
                                throw new Error("Invalid user ID received from auth callback.");
                            }

                        } else if (!result.success) {
                            console.log('❌ Found auth error in localStorage:', result.error);
                            
                            localStorage.removeItem('withings_auth_result');
                            
                            setApiResult({ 
                                message: `Authentication failed: ${result.error}`, 
                                isError: true 
                            });
                            setIsLoading(false);
                            setAuthRequired(false);
                        }
                    } else {
                        console.log('⏰ Auth result is too old, clearing');
                        localStorage.removeItem('withings_auth_result');
                    }
                } catch (error: any) {
                    console.log('❌ Error parsing auth result:', error);
                    setApiResult({ message: `Error processing authentication: ${error.message}`, isError: true });
                    localStorage.removeItem('withings_auth_result');
                    setAuthRequired(false);
                }
            }
        }, 1000); 
    }
    
    return () => {
        if (pollInterval) {
            console.log('🛑 Stopping auth polling');
            clearInterval(pollInterval);
        }
    };
  }, [authRequired]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };
  
  const checkLocalAccess = (rules: AccessRules | null, targetEmail: string): boolean => {
      if (!rules) return false;
      if (rules.role === 'admin') return true;
      if (!rules.allowed_patterns) return false;

      return rules.allowed_patterns.some(pattern => {
          const regexPattern = '^' + pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^.]*') + '$';
          const regex = new RegExp(regexPattern);
          return regex.test(targetEmail);
      });
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setApiResult(null);
    setAccessRulesResult(null);
    const formData = new FormData(event.currentTarget);
    const formEmail = (formData.get('email') as string).trim();
    setEmail(formEmail);

    if (!user?.email) {
      setApiResult({ message: 'Could not determine logged-in user. Please log in again.', isError: true });
      setIsLoading(false);
      return;
    }
    
    try {
      // Step 1: Check access rules first
      const rulesResponse = await fetch('/api/get-access-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterEmail: user.email }),
      });
      const rulesResult = await rulesResponse.json();
      if (!rulesResponse.ok) {
          // If rules not found, it's an error for non-admins.
          if (rulesResponse.status === 404) throw new Error(`Access Denied: No access rules found for ${user.email}.`);
          throw rulesResult;
      }
      setAccessRulesResult({ rules: rulesResult, message: rulesResult.message || `Rules found for ${user.email}` });

      // Step 1.5: Check if the requested email aligns with user's access rules
      const hasAccess = checkLocalAccess(rulesResult, formEmail);
      if (!hasAccess) {
          throw new Error(`Access Denied: You do not have permission to generate reports for ${formEmail}.`);
      }

      // Step 2: Check user status with Withings
      const statusResponse = await fetch('/api/check-user-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail }),
      });
      const result = await statusResponse.json();
      if (!statusResponse.ok) throw result;

      if (result.needsOAuth) {
          setActiveUserId(null);
          setAuthRequired(true);
          setStep('dateSelection');
          return;
      }
      
      if (result.users && result.users.length === 1) {
          const user = result.users[0];
          setActiveUserId(user.userid);
          setIsFullyOwned(user.fully_owned);
          if (user.fully_owned) {
            fetchDateRange(user.userid);
          } else {
            setAuthRequired(true);
            setStep('dateSelection');
          }
      } else if (result.users && result.users.length > 1) {
          setUserSelection(result.users);
          setStep('userSelection');
      } else {
          throw new Error("No user found with that email address.");
      }
    } catch (error: any) {
      setApiResult({ message: error.message, isError: true, details: error.details || error.stack || JSON.stringify(error, null, 2) });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDateRange = async (userid: number | null) => {
    setIsLoading(true);
    setApiResult(null);
    try {
        const temp_access_token = sessionStorage.getItem('withings_temp_token');
        const body: { userid?: number, temp_access_token?: string | null } = {};
        if (userid) {
            body.userid = userid;
        }
        if (temp_access_token) {
            body.temp_access_token = temp_access_token;
        }

        const response = await fetch('/api/get-summary-dates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok) throw result;
        
        if (result.userid && !activeUserId) {
            const numericUserId = parseInt(result.userid, 10);
            if (!isNaN(numericUserId)) {
                setActiveUserId(numericUserId);
            }
        }

        setAvailableDates({
            minDate: new Date(result.minDate),
            maxDate: new Date(result.maxDate),
            previewData: result.previewData,
        });
        setStep('dateSelection');
    } catch (error: any) {
        if (error.needsOAuth) {
            setAuthRequired(true);
            setStep('dateSelection');
        } else {
            setApiResult({ message: error.message, isError: true, details: error.details || error.stack || JSON.stringify(error, null, 2) });
            setStep('initial');
        }
    } finally {
        setIsLoading(false);
    }
  }

  const handleUserSelectionSubmit = () => {
    if (selectedUserId) {
        const numericUserId = Number(selectedUserId);
        const selectedUser = userSelection?.find(u => u.userid === numericUserId);
        
        if (selectedUser) {
            setActiveUserId(numericUserId);
            setIsFullyOwned(selectedUser.fully_owned);
            if (selectedUser.fully_owned) {
                fetchDateRange(numericUserId);
            } else {
                setAuthRequired(true);
                setStep('dateSelection');
            }
        }
    }
  }
  
  const triggerDownload = (dataUri: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const showReportInNewTab = (htmlContent: string) => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    } else {
      setApiResult({ message: 'Could not open new tab. Please disable your pop-up blocker.', isError: true, details: 'Browser security settings prevented opening a new tab.' });
    }
  };

  const triggerHtmlDownload = (htmlContent: string) => {
    const filename = `report-${reportLabel || 'user'}-${new Date().toISOString().split('T')[0]}.html`;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerateReport = async (rangeToProcess: DateRange) => {
    if (!rangeToProcess.from || !rangeToProcess.to || !user?.email) return;
    
    setStep('generating');
    setApiResult(null);

    if (!activeUserId) {
        setApiResult({ message: 'Could not determine the user ID for the report.', isError: true });
        setStep('complete');
        return;
    }

    if (!reportLabel) {
        setApiResult({ message: 'A report label is required.', isError: true });
        setStep('complete');
        return;
    }
    
    const temp_access_token = sessionStorage.getItem('withings_temp_token');

    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow: 'withings',
          userid: activeUserId,
          email: email,
          reportLabel: reportLabel,
          startDate: format(rangeToProcess.from, 'yyyy-MM-dd'),
          endDate: format(rangeToProcess.to, 'yyyy-MM-dd'),
          downloadOnly,
          applyTimezone: applyTimezoneConversion,
          temp_access_token,
          requesterEmail: user.email, 
        }),
      });
      const result = await response.json();
      if (!response.ok) throw result;
      
      if (result.summaryCsvUri && result.epochCsvUri) {
          triggerDownload(result.summaryCsvUri, 'summary.csv');
          triggerDownload(result.epochCsvUri, 'epoch.csv');
          setGeneratedReportHtml(null);
          setApiResult({ message: 'Data downloaded successfully!', isError: false });
      } else if (result.reportHtml) {
          setGeneratedReportHtml(result.reportHtml);
          setApiResult({ message: 'Report generated successfully! Click below to view or download.', isError: false });
      } else {
          throw new Error('API returned an unexpected response.');
      }

    } catch (error: any) {
      setApiResult({ message: error.message, isError: true, details: error.details || error.stack || JSON.stringify(error, null, 2) });
    } finally {
      setProgress(100);
      setStep('complete');
    }
  };

  const handleGenerateFromCsv = async (e: FormEvent) => {
    e.preventDefault();
    if (!summaryFile || !csvLabel || (includeEpochData && !epochFile)) {
      setApiResult({ message: "Please provide a label, a summary CSV, and an epoch CSV if selected.", isError: true });
      return;
    }
    
    setStep('generating');
    setProgressText('Reading files...');
    setApiResult(null);

    try {
      const summaryCsv = await summaryFile.text();
      const epochCsv = includeEpochData && epochFile ? await epochFile.text() : "";

      setProgressText('Uploading and processing...');
      
      const body: any = {
          flow: 'csv',
          label: csvLabel,
          summaryCsv,
          epochCsv,
          applyTimezone: csvApplyTimezone,
      };

      if (csvSelectedRange?.from && csvSelectedRange?.to) {
          body.startDate = format(csvSelectedRange.from, 'yyyy-MM-dd');
          body.endDate = format(csvSelectedRange.to, 'yyyy-MM-dd');
      }

      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw result;

      if (result.reportHtml) {
          setGeneratedReportHtml(result.reportHtml);
          setApiResult({ message: 'Report generated successfully! Click below to view.', isError: false });
      } else {
          throw new Error('API did not return a report.');
      }
    } catch (error: any) {
      setApiResult({ message: error.message, isError: true, details: error.details || error.stack || JSON.stringify(error, null, 2) });
    } finally {
      setProgress(100);
      setStep('complete');
    }
  };

  const handleReset = () => {
    setStep('initial');
    setEmail('');
    setIsLoading(false);
    setApiResult(null);
    setAvailableDates(null);
    setSelectedRange(undefined);
    setIsWarningDialogOpen(false);
    setTimeEstimate('');
    setProgress(0);
    setProgressText('');
    setDownloadOnly(false);
    setReportLabel('');
    setCsvLabel('');
    setSummaryFile(null);
    setEpochFile(null);
    setIncludeEpochData(true);
    setGeneratedReportHtml(null);
    setUserSelection(null);
    setSelectedUserId(null);
    setActiveUserId(null);
    setIsFullyOwned(false);
    setCsvAvailableDates(null);
    setCsvSelectedRange(undefined);
    setApplyTimezoneConversion(true);
    setCsvApplyTimezone(true);
    setAuthRequired(false);
    setAccessRulesResult(null);
    sessionStorage.removeItem('withings_temp_token');
    sessionStorage.removeItem('withings_oauth_state');
  };

  const onDateSelectionSubmit = () => {
    if (!selectedRange || !selectedRange.from || !selectedRange.to) return;
    
    const days = differenceInDays(selectedRange.to, selectedRange.from);
    if (days > 14 && !downloadOnly) {
      const seconds = days * 2;
      const roundedSeconds = Math.round(seconds / 30) * 30;
      const minutes = Math.floor(roundedSeconds / 60);
      const remainingSeconds = roundedSeconds % 60;
      const formattedTime = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
      setTimeEstimate(formattedTime);
      setIsWarningDialogOpen(true);
    } else {
      handleGenerateReport(selectedRange);
    }
  };
  
  const onConfirmLongReport = () => {
      if (selectedRange) {
        handleGenerateReport(selectedRange);
        setIsWarningDialogOpen(false);
      }
  }

  const handleGrantPermission = () => {
    const state = Math.random().toString(36).substring(2);
    sessionStorage.setItem('withings_oauth_state', state);

    const redirectUri = process.env.NODE_ENV === 'production'
      ? 'https://studio--withings-sleeper.us-central1.hosted.app/auth/withings/callback'
      : `${window.location.origin}/auth/withings/callback`;

    const clientId = process.env.NEXT_PUBLIC_WITHINGS_OAUTH_CLIENT_ID;
    const scope = "user.info,user.metrics,user.activity";
    
    if (!clientId) {
        setApiResult({ message: "OAuth Client ID is not configured on the client.", isError: true });
        return;
    }

    const authUrl = `https://account.withings.com/oauth2_user/authorize2?response_type=code&client_id=${clientId}&state=${state}&scope=${scope}&redirect_uri=${redirectUri}`;
    
    console.log('🪟 Opening popup with auth URL:', authUrl);
    const popup = window.open(authUrl, 'WithingsAuth', 'width=600,height=700');
    
    if (popup) {
        console.log('✅ Popup opened successfully');
        
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                console.log('🚪 Popup was closed manually');
                clearInterval(checkClosed);
            }
        }, 1000);
    } else {
        console.log('❌ Failed to open popup - check popup blocker');
        setApiResult({ message: "Failed to open popup. Please disable popup blocker and try again.", isError: true });
    }
  };

  const handleToggleFlip = () => {
    setIsAnimatingText(true);
    setTimeout(() => {
      setIsFlipped(!isFlipped);
      setIsAnimatingText(false);
    }, 150);
  }

  const renderFrontContent = () => {
    switch (step) {
      case 'initial':
        return (
          <InitialStep
            handleEmailSubmit={handleEmailSubmit}
            isLoading={isLoading}
            apiResult={apiResult}
            setApiResult={setApiResult}
            accessRulesResult={accessRulesResult}
            handleGenerateFromCsv={handleGenerateFromCsv}
            csvLabel={csvLabel}
            setCsvLabel={setCsvLabel}
            setSummaryFile={setSummaryFile}
            csvAvailableDates={csvAvailableDates}
            setCsvAvailableDates={setCsvAvailableDates}
            csvSelectedRange={csvSelectedRange}
            setCsvSelectedRange={setCsvSelectedRange}
            csvApplyTimezone={csvApplyTimezone}
            setCsvApplyTimezone={setCsvApplyTimezone}
            includeEpochData={includeEpochData}
            setIncludeEpochData={setIncludeEpochData}
            epochFile={epochFile}
            setEpochFile={setEpochFile}
          />
        );
      case 'userSelection':
        return (
          <UserSelectionStep
            userSelection={userSelection}
            selectedUserId={selectedUserId}
            setSelectedUserId={setSelectedUserId}
            onSubmit={handleUserSelectionSubmit}
          />
        );
      case 'dateSelection':
        if (authRequired) {
          return (
            <PermissionStep
              isLoading={isLoading}
              handleGrantPermission={handleGrantPermission}
            />
          );
        }
        return (
          <DateSelectionStep
            availableDates={availableDates}
            selectedRange={selectedRange}
            setSelectedRange={setSelectedRange}
            reportLabel={reportLabel}
            setReportLabel={setReportLabel}
            applyTimezoneConversion={applyTimezoneConversion}
            setApplyTimezoneConversion={setApplyTimezoneConversion}
            downloadOnly={downloadOnly}
            setDownloadOnly={setDownloadOnly}
            onSubmit={onDateSelectionSubmit}
          />
        );
      case 'generating':
        return (
          <GeneratingStep progress={progress} progressText={progressText} />
        );
      case 'complete':
        return (
          <CompleteStep
            apiResult={apiResult}
            generatedReportHtml={generatedReportHtml}
            showReportInNewTab={showReportInNewTab}
            triggerHtmlDownload={triggerHtmlDownload}
            onReset={handleReset}
          />
        );
      default:
        return null;
    }
  }

  const renderBackContent = () => (
    <div className="overflow-y-auto p-6 pt-0">
        <Tabs defaultValue="check-status" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="check-status">Check Status</TabsTrigger>
                <TabsTrigger value="create-participant">Create Participant</TabsTrigger>
            </TabsList>
            <TabsContent value="check-status">
                <CheckUserStatusForm />
            </TabsContent>
            <TabsContent value="create-participant">
                <CreateParticipantForm />
            </TabsContent>
        </Tabs>
    </div>
  );

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  const headerTextClasses = cn(
    "transition-opacity duration-150 ease-in-out",
    isAnimatingText ? "opacity-0" : "opacity-100"
  );
  
  const contentClasses = cn(
    "transition-opacity duration-150 ease-in-out p-6 pt-0 h-full overflow-y-auto",
    isAnimatingText ? "opacity-0" : "opacity-100"
  );

  return (
    <>
      <main className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-body animate-fade-in">
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 cursor-default">
                    <UserIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{user.email}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
            </Button>
        </div>
        <div className="w-full max-w-md">
            <Card className="shadow-xl rounded-2xl flex flex-col h-[85vh]">
              <CardHeader className="text-center shrink-0">
                  <div className="mx-auto mb-4">
                    <button
                      onClick={handleToggleFlip}
                      aria-label={isFlipped ? "Switch to report generation" : "Switch to participant management"}
                      className="relative flex h-12 w-24 items-center rounded-full bg-muted p-1 transition-colors"
                    >
                      <span className={cn("absolute left-1 flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-md transition-transform duration-300 ease-in-out", isFlipped && "translate-x-14")}>
                         {isFlipped ? <UserIcon className="h-6 w-6 text-primary" /> : <Bed className="h-6 w-6 text-primary" />}
                      </span>
                      <span className="flex w-full justify-around">
                        <Bed className={cn("h-6 w-6 text-muted-foreground transition-colors", !isFlipped && "text-transparent")} />
                        <UserIcon className={cn("h-6 w-6 text-muted-foreground transition-colors", isFlipped && "text-transparent")} />
                      </span>
                    </button>
                  </div>

                  <div className="h-20"> {/* Container to prevent layout shift during text animation */}
                     <CardTitle className={cn("font-headline text-3xl", headerTextClasses)}>
                       {isFlipped ? 'Participant Management' : 'Withings Report'}
                     </CardTitle>
                     <CardDescription className={cn("text-base pt-1", headerTextClasses)}>
                       {!isFlipped && (
                         <>
                           {step === 'initial' && 'Get your personalized sleep report.'}
                           {step === 'userSelection' && 'Please select the correct user account.'}
                           {step === 'dateSelection' && (authRequired ? 'This user needs to grant permission.' : 'Select a period for detailed analysis.')}
                           {step === 'generating' && 'Your report is being generated...'}
                           {step === 'complete' && 'Your report is ready!'}
                         </>
                       )}
                       {isFlipped && 'Check user status or create a new participant.'}
                     </CardDescription>
                  </div>
              </CardHeader>

              <div className="grow overflow-hidden">
                <div className={contentClasses}>
                  {isFlipped ? renderBackContent() : renderFrontContent()}
                </div>
              </div>

            </Card>
        </div>
      </main>

      <Dialog open={isWarningDialogOpen} onOpenChange={setIsWarningDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Long Date Range Selected</DialogTitle>
                <DialogDescription>
                    You've selected a period longer than 14 days. This may take a while to process.
                    <br/><br/>
                    Estimated generation time: <strong>~{timeEstimate}</strong>
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button onClick={() => setIsWarningDialogOpen(false)} variant="outline">Cancel</Button>
                <Button onClick={onConfirmLongReport}>Proceed Anyway</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
