export interface ModuleHeaderProps {
  title: string;
  description?: string;
}

/**
 * Premium module header with clear hierarchy.
 * Title is strong, subtitle is readable but secondary.
 */
export function ModuleHeader({ title, description }: ModuleHeaderProps) {
  return (
    <header className="space-y-3">
      <h1 className="text-[22px] font-semibold leading-[1.3] tracking-[-0.02em] text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="max-w-[60ch] text-[14px] leading-[1.65] text-muted-foreground/90">
          {description}
        </p>
      ) : null}
    </header>
  );
}

