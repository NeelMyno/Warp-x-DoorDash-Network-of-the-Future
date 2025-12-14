"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";

const HEIGHTS = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
} as const;

const LOGO_RATIO = 660 / 186;

export function BrandLogo({
  size = "md",
  variant = "lockup",
  href = "/",
  priority,
  className,
  alt = "Warp",
}: {
  size?: keyof typeof HEIGHTS;
  variant?: "mark" | "lockup";
  href?: string;
  priority?: boolean;
  className?: string;
  alt?: string;
}) {
  const height = HEIGHTS[size];
  const width = Math.max(1, Math.round(height * LOGO_RATIO));

  const decorative = alt === "";

  // `variant` reserved for future (mark vs lockup).
  void variant;

  return (
    <Link
      href={href}
      aria-label={decorative ? "Home" : alt}
      className={cn(
        "inline-flex items-center rounded-md px-2 py-2.5 sm:py-2",
        "min-h-[44px] sm:min-h-[40px]",
        "hover:bg-muted/40 active:opacity-90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Image
        src="/media/warp_logo.svg"
        alt={alt}
        aria-hidden={decorative ? true : undefined}
        width={width}
        height={height}
        priority={priority}
        className="block"
        style={{ height, width: "auto" }}
      />
    </Link>
  );
}

