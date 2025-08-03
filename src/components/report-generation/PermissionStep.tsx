
'use client';

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, KeyRound, Loader2 } from "lucide-react";

interface PermissionStepProps {
  isLoading: boolean;
  handleGrantPermission: () => void;
}

export function PermissionStep({ isLoading, handleGrantPermission }: PermissionStepProps) {
  return (
    <div className="space-y-4 text-center">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Permission Required</AlertTitle>
        <AlertDescription>
          This user has not granted this application permission to access their Withings data. Click below to open the Withings authorization page.
        </AlertDescription>
      </Alert>
      <Button onClick={handleGrantPermission} disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
        Grant Permission
      </Button>
    </div>
  );
}
