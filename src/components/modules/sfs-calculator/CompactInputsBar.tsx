"use client";

import * as React from "react";
import { FileUp, Check, AlertCircle } from "lucide-react";

import { Input } from "@/components/ui/input";

interface UploadSummary {
  anchors: number;
  satellites: number;
  rows: number;
  totalPackages: number;
}

interface CompactInputsBarProps {
  uploadedFileName: string | null;
  uploadSummary: UploadSummary | null;
  hasErrors: boolean;
  hasMissingDistances: boolean;
  onFileSelected: (file: File | null) => void;
}

export function CompactInputsBar({
  uploadedFileName,
  uploadSummary,
  hasErrors,
  hasMissingDistances,
  onFileSelected,
}: CompactInputsBarProps) {
  const hasIssues = hasErrors || hasMissingDistances;
  const isLoaded = uploadSummary && !hasIssues;

  return (
    <div
      data-tour="upload"
      className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card/50 p-3"
    >
      {/* File input + status */}
      <div className="flex items-center gap-3">
        <div
          className={[
            "flex h-9 w-9 items-center justify-center rounded-lg border",
            isLoaded
              ? "border-primary/30 bg-primary/10"
              : hasIssues
                ? "border-destructive/30 bg-destructive/10"
                : "border-border bg-background/20",
          ].join(" ")}
        >
          {isLoaded ? (
            <Check className="h-4 w-4 text-primary" />
          ) : hasIssues ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <FileUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {uploadedFileName ?? "No file"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isLoaded
              ? "CSV loaded"
              : hasIssues
                ? "Fix errors"
                : "Upload CSV"}
          </div>
        </div>
        <Input
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
          className="h-8 w-[140px] cursor-pointer text-xs"
        />
      </div>

      {/* Divider */}
      {uploadSummary && (
        <div className="hidden h-6 w-px bg-border sm:block" />
      )}

      {/* Summary chips */}
      {uploadSummary && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "Anchor Stores", value: uploadSummary.anchors },
            { label: "Satellites", value: uploadSummary.satellites },
            { label: "Stops", value: uploadSummary.rows },
            { label: "Packages", value: uploadSummary.totalPackages.toLocaleString() },
          ].map((chip) => (
            <div
              key={chip.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/10 px-2.5 py-1"
            >
              <span className="text-[11px] text-muted-foreground">
                {chip.label}
              </span>
              <span className="tabular-nums text-xs font-medium text-foreground">
                {chip.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

