
'use client';

import { Progress } from "@/components/ui/progress";

interface GeneratingStepProps {
  progress: number;
  progressText: string;
}

export function GeneratingStep({ progress, progressText }: GeneratingStepProps) {
  return (
    <div className="w-full text-center space-y-2 pt-2">
      <Progress value={progress} className="w-full" />
      <p className="text-sm text-muted-foreground">{progressText}</p>
    </div>
  );
}
