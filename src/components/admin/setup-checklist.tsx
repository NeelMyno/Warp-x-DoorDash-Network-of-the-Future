import { ContentPanel } from "@/components/panels/ContentPanel";
import { Badge } from "@/components/ui/badge";
import type { AdminDiagnostics, DiagnosticCheck, DiagnosticStatus } from "@/lib/diagnostics/admin";
import { CopyButton } from "@/components/account/CopyButton";
import { SetupOps } from "@/components/admin/setup-ops";
import { SfsRateCardEditor } from "@/components/admin/sfs-rate-card-editor";
import { NetworkEnhancementsSetupSection } from "@/components/admin/network-enhancements-setup";
import { PORTAL_ASSETS_BUCKET } from "@/lib/assets/constants";
import type { SfsRateCard } from "@/lib/sfs-calculator/types";

function formatTimestamp(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleString();
}

function StatusPill({ status }: { status: DiagnosticStatus }) {
  if (status === "pass") {
    return (
      <Badge variant="accent" className="px-2 py-0.5 text-[11px]">
        PASS
      </Badge>
    );
  }
  if (status === "warn") {
    return (
      <Badge
        variant="outline"
        className="border-primary/25 px-2 py-0.5 text-[11px] text-primary"
      >
        WARN
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-destructive/40 px-2 py-0.5 text-[11px] text-destructive"
    >
      FAIL
    </Badge>
  );
}

function PolicyChecklist() {
  const policies = `-- Storage bucket: ${PORTAL_ASSETS_BUCKET} (private)
-- storage.objects policies (via Supabase Dashboard → Storage → Policies)

-- SELECT (download/view) for authenticated
using (bucket_id = '${PORTAL_ASSETS_BUCKET}')

-- INSERT (upload) for admins
with check (bucket_id = '${PORTAL_ASSETS_BUCKET}' and public.is_admin())

-- UPDATE for admins
using (bucket_id = '${PORTAL_ASSETS_BUCKET}' and public.is_admin())
with check (bucket_id = '${PORTAL_ASSETS_BUCKET}' and public.is_admin())

-- DELETE for admins
using (bucket_id = '${PORTAL_ASSETS_BUCKET}' and public.is_admin())
`;

  return (
    <ContentPanel
      title="Storage policy checklist"
      description="If storage checks fail, confirm these policies exist (extra SELECT policies are usually unnecessary but not harmful)."
      right={<CopyButton value={policies} label="Copy" />}
    >
      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
        {policies}
      </pre>
    </ContentPanel>
  );
}

function CheckCard({ check }: { check: DiagnosticCheck }) {
  return (
    <ContentPanel
      title={check.label}
      description={check.summary}
      right={<StatusPill status={check.status} />}
    >
      <div className="space-y-3">
        {check.details ? (
          <div className="rounded-xl border border-border bg-background/15 px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Details</div>
            <div className="mt-1 font-mono">{check.details}</div>
          </div>
        ) : null}

        {check.remediation ? (
          <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
            <div className="text-sm font-semibold text-foreground">
              {check.remediation.title}
            </div>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {check.remediation.steps.map((s, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-border" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>

            {check.remediation.snippet ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    Copy snippet
                  </div>
                  <CopyButton value={check.remediation.snippet} label="Copy" />
                </div>
                <pre className="whitespace-pre-wrap break-words rounded-xl border border-border bg-background/15 px-3 py-2 font-mono text-xs text-foreground">
                  {check.remediation.snippet}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </ContentPanel>
  );
}

function StatusSummary({ diagnostics }: { diagnostics: AdminDiagnostics }) {
  const items = [
    { label: "PASS", value: String(diagnostics.stats.pass) },
    { label: "WARN", value: String(diagnostics.stats.warn) },
    { label: "FAIL", value: String(diagnostics.stats.fail) },
    {
      label: "Assets",
      value:
        typeof diagnostics.counts?.assets === "number"
          ? String(diagnostics.counts.assets)
          : "—",
    },
  ];

  return (
    <ContentPanel title="System status">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-2xl font-semibold text-foreground">{item.value}</div>
            <div className="text-xs text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>
    </ContentPanel>
  );
}

interface SetupChecklistProps {
  diagnostics: AdminDiagnostics;
  rateCards: SfsRateCard[];
}

export function SetupChecklist({ diagnostics, rateCards }: SetupChecklistProps) {
  return (
    <div className="space-y-4">
      <StatusSummary diagnostics={diagnostics} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Generated:{" "}
          <span className="font-mono text-foreground">
            {formatTimestamp(diagnostics.generatedAt)}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
            Module sections:{" "}
            <span className="ml-1 font-mono">
              {diagnostics.counts?.moduleSections ?? "—"}
            </span>
          </Badge>
          <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
            Module audit:{" "}
            <span className="ml-1 font-mono">
              {diagnostics.counts?.auditEvents ?? "—"}
            </span>
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {diagnostics.checks.map((check) => (
          <CheckCard key={check.id} check={check} />
        ))}
      </div>

      <PolicyChecklist />

      <NetworkEnhancementsSetupSection />

      <SfsRateCardEditor rateCards={rateCards} />

      <SetupOps />
    </div>
  );
}
