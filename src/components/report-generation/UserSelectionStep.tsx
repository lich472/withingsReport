
'use client';

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { WithingsUser } from "@/lib/withings/types";

interface UserSelectionStepProps {
  userSelection: WithingsUser[] | null;
  selectedUserId: number | null;
  setSelectedUserId: (id: number | null) => void;
  onSubmit: () => void;
}

export function UserSelectionStep({ userSelection, selectedUserId, setSelectedUserId, onSubmit }: UserSelectionStepProps) {
  if (!userSelection) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Label>Multiple Users Found</Label>
      <p className="text-sm text-muted-foreground">
        More than one user is associated with this email. Please select which account to proceed with.
      </p>
      <RadioGroup value={selectedUserId?.toString() || undefined} onValueChange={(value) => setSelectedUserId(Number(value))}>
        <div className="space-y-2 rounded-md border p-2">
          {userSelection.map((user) => (
            <div key={user.userid} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
              <Label htmlFor={`user-${user.userid}`} className="font-normal flex-grow cursor-pointer">
                <div>User ID: {user.userid}</div>
                <div className="text-xs text-muted-foreground">Data Access: {user.fully_owned ? 'Full' : 'Limited'}</div>
              </Label>
              <RadioGroupItem value={String(user.userid)} id={`user-${user.userid}`} />
            </div>
          ))}
        </div>
      </RadioGroup>
      <Button onClick={onSubmit} className="w-full font-headline" disabled={!selectedUserId}>
        Continue
      </Button>
    </div>
  );
}
