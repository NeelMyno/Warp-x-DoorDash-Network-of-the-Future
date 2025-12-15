import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

function IconBase({
  title,
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? "Portal"}>
      <path d="M4 4h7v7H4z" />
      <path d="M13 4h7v7h-7z" />
      <path d="M4 13h7v7H4z" />
      <path d="M13 13h7v7h-7z" />
    </IconBase>
  );
}

export function IconStack(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? "Module"}>
      <path d="M12 3 4 7l8 4 8-4-8-4Z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 17l8 4 8-4" />
    </IconBase>
  );
}

export function IconShield(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? "Admin"}>
      <path d="M12 3 20 7v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4Z" />
      <path d="M9 12h6" />
      <path d="M12 9v6" />
    </IconBase>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? "Open"}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

export function IconLogOut(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? "Sign out"}>
      <path d="M10 17H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3" />
      <path d="M15 12H9" />
      <path d="m12 9 3 3-3 3" />
      <path d="M17 7h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
    </IconBase>
  );
}

export function IconUser(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? "Account"}>
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M20 21a8 8 0 1 0-16 0" />
    </IconBase>
  );
}

export function IconLink(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? "Link"}>
      <path d="M10 13a5 5 0 0 1 0-7l.8-.8a5 5 0 0 1 7 7l-1 1" />
      <path d="M14 11a5 5 0 0 1 0 7l-.8.8a5 5 0 0 1-7-7l1-1" />
    </IconBase>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? "Done"}>
      <path d="M20 6 9 17l-5-5" />
    </IconBase>
  );
}

export function IconDotsVertical(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? "More"}>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function IconEye(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? "Show"}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function IconEyeOff(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? "Hide"}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </IconBase>
  );
}
