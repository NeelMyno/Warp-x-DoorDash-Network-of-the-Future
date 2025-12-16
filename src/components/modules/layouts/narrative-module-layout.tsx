import * as React from "react";

import { ModuleHeader } from "@/components/modules/narrative/module-header";
import { SectionCard } from "@/components/modules/narrative/section-card";

export interface NarrativeModuleLayoutProps {
  title: string;
  description?: string;
  sections: {
    key: string;
    label: string;
    content: React.ReactNode;
    isEmpty?: boolean;
  }[];
}

/**
 * Premium one-column narrative layout for module pages.
 * Comfortable reading width (~70ch), consistent vertical rhythm.
 * Section anchors for direct linking.
 */
export function NarrativeModuleLayout({
  title,
  description,
  sections,
}: NarrativeModuleLayoutProps) {
  const showHeader = Boolean(title);

  return (
    <article className="max-w-[70ch] space-y-8">
      {showHeader && <ModuleHeader title={title} description={description} />}

      <div className="space-y-5">
        {sections.map((section) => (
          <SectionCard
            key={section.key}
            id={section.key}
            title={section.label}
            isEmpty={section.isEmpty}
          >
            {section.content}
          </SectionCard>
        ))}
      </div>
    </article>
  );
}

