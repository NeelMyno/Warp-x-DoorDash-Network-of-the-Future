"use client";

import * as React from "react";
import { HelpCircle, X, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

interface SfsCalculatorHelpDialogProps {
  onStartTour?: () => void;
}

export function SfsCalculatorHelpDialog({ onStartTour }: SfsCalculatorHelpDialogProps) {
  const [open, setOpen] = React.useState(false);

  const handleStartTour = () => {
    setOpen(false);
    // Small delay to let dialog close before tour starts
    setTimeout(() => {
      onStartTour?.();
    }, 150);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" />
          Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>How to use the SFS Calculator</DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground hover:bg-background/20 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          {/* Quick summary */}
          <p className="text-sm text-muted-foreground">
            Three steps: upload stores, set assumptions, review savings.
          </p>

          <ol className="list-inside list-decimal space-y-1.5 text-sm text-foreground">
            <li>Download template, add anchors + satellites</li>
            <li>Upload CSV and pick market/vehicle</li>
            <li>Click an anchor to see savings breakdown</li>
          </ol>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Tip:</span> Every satellite needs{" "}
              <span className="font-medium text-primary">distance_miles</span> or it will not calculate.
            </p>
          </div>

          {/* Start guided tips */}
          {onStartTour && (
            <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
              <p className="text-xs text-muted-foreground">
                Want a quick walkthrough?
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleStartTour}
                className="w-full gap-2"
              >
                <PlayCircle className="h-4 w-4" />
                Start guided tips
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

