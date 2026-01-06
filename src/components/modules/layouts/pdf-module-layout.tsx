import * as React from "react";
import Link from "next/link";
import { FileWarning, Settings } from "lucide-react";
import type { ContentBlock } from "@/config/modules";
import { PdfBlock } from "@/components/blocks/PdfBlock";
import { Button } from "@/components/ui/button";

export interface PdfModuleLayoutProps {
  title: string;
  description: string;
  /** All content blocks from the module (we extract first PDF from end-vision) */
  blocks: ContentBlock[];
  /** Module slug for admin link */
  moduleSlug?: string;
  /** Whether current user is admin */
  isAdmin?: boolean;
}

type PdfContentBlock = Extract<ContentBlock, { type: "pdf" }>;

/**
 * PDF-only module layout.
 * Displays a standard module header + a single PDF embed.
 * ENFORCES: Only renders the FIRST pdf block found. Ignores all other block types.
 */
export function PdfModuleLayout({
  title,
  description,
  blocks,
  moduleSlug,
  isAdmin = false,
}: PdfModuleLayoutProps) {
  // ENFORCE PDF-ONLY: Find only the first PDF block, ignore everything else
  const pdfBlock = blocks.find((b): b is PdfContentBlock => b.type === "pdf");

  // Determine PDF status for diagnostics
  const hasPdfBlock = !!pdfBlock;
  const hasPath = hasPdfBlock && !!pdfBlock.path;
  const hasSignedUrl = hasPdfBlock && !!pdfBlock.url;

  return (
    <div className="space-y-6">
      {/* Module header */}
      <header className="space-y-2">
        <h1 className="text-[length:var(--warp-fs-page-title)] font-semibold leading-[var(--warp-lh-page-title)] tracking-tight text-foreground">
          {title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </header>

      {/* Admin diagnostics (only visible to admins) */}
      {isAdmin && (
        <AdminDiagnostics
          hasPdfBlock={hasPdfBlock}
          hasPath={hasPath}
          hasSignedUrl={hasSignedUrl}
          moduleSlug={moduleSlug}
        />
      )}

      {/* PDF content - only renders first PDF block */}
      {pdfBlock && hasSignedUrl ? (
        <PdfBlock
          url={pdfBlock.url}
          title={pdfBlock.title}
          filename={pdfBlock.filename}
          caption={pdfBlock.caption}
          showAdminHint={isAdmin}
        />
      ) : (
        <EmptyState isAdmin={isAdmin} moduleSlug={moduleSlug} hasPath={hasPath} />
      )}
    </div>
  );
}

/** Admin-only diagnostics panel */
function AdminDiagnostics({
  hasPdfBlock,
  hasPath,
  hasSignedUrl,
  moduleSlug,
}: {
  hasPdfBlock: boolean;
  hasPath: boolean;
  hasSignedUrl: boolean;
  moduleSlug?: string;
}) {
  const status = !hasPdfBlock
    ? { label: "No PDF block", color: "text-amber-500" }
    : !hasPath
      ? { label: "PDF not selected", color: "text-amber-500" }
      : !hasSignedUrl
        ? { label: "URL signing failed", color: "text-red-500" }
        : { label: "PDF ready", color: "text-green-500" };

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-4 py-2 text-xs">
      <div className="flex items-center gap-4">
        <span className="font-medium text-muted-foreground">Admin Diagnostics:</span>
        <span className={status.color}>{status.label}</span>
        <span className="text-muted-foreground/60">
          Block: {hasPdfBlock ? "✓" : "✗"} | Path: {hasPath ? "✓" : "✗"} | URL: {hasSignedUrl ? "✓" : "✗"}
        </span>
      </div>
      {moduleSlug && (
        <Button variant="ghost" size="sm" asChild className="h-6 gap-1 px-2 text-xs">
          <Link href="/admin">
            <Settings className="h-3 w-3" />
            Content Studio
          </Link>
        </Button>
      )}
    </div>
  );
}

function EmptyState({
  isAdmin,
  moduleSlug,
  hasPath,
}: {
  isAdmin: boolean;
  moduleSlug?: string;
  hasPath: boolean;
}) {
  // Different messages based on state
  const message = hasPath
    ? {
        title: "Couldn't load PDF right now",
        body: "The PDF URL could not be signed. Try refreshing the page.",
      }
    : isAdmin
      ? {
          title: "No PDF configured",
          body: "This module displays a PDF. Select one in Admin → Content Studio.",
        }
      : {
          title: "Content coming soon",
          body: "This section will be available soon.",
        };

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <FileWarning className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="max-w-md space-y-1">
        <h4 className="text-sm font-medium text-foreground">{message.title}</h4>
        <p className="text-xs text-muted-foreground">{message.body}</p>
      </div>
      {isAdmin && moduleSlug && (
        <Button variant="outline" size="sm" asChild className="mt-2 gap-1.5">
          <Link href="/admin">
            <Settings className="h-3.5 w-3.5" />
            Open Admin Content Studio
          </Link>
        </Button>
      )}
      {hasPath && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="mt-2"
        >
          Try again
        </Button>
      )}
    </div>
  );
}

