import type { SVGProps } from "react";

const Icon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  />
);

export const SelectIcon = () => (
  <Icon>
    <path d="M5 4l12 7-6 1 3 7-3 1-3-7-3 4z" />
  </Icon>
);

export const NoteIcon = () => (
  <Icon>
    <rect x="5" y="4" width="14" height="16" rx="2" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </Icon>
);

export const ImageIcon = () => (
  <Icon>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="M20 16l-4.5-4.5L7 20" />
  </Icon>
);

export const PdfIcon = () => (
  <Icon>
    <path d="M8 3h6l4 4v14H8z" />
    <path d="M14 3v4h4M10 13h4M10 17h4" />
  </Icon>
);

export const VideoIcon = () => (
  <Icon>
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="M10 9l5 3-5 3z" />
  </Icon>
);

export const HandIcon = () => (
  <Icon>
    <path d="M8 11V6a1 1 0 112 0v5" />
    <path d="M12 11V5a1 1 0 112 0v6" />
    <path d="M16 11V7a1 1 0 112 0v7a5 5 0 01-5 5h-1a6 6 0 01-6-6v-1a2 2 0 114 0v1" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const ChevronLeftIcon = () => (
  <Icon>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
);

export const ChevronRightIcon = () => (
  <Icon>
    <path d="M9 18l6-6-6-6" />
  </Icon>
);

export const ExternalIcon = () => (
  <Icon>
    <path d="M14 5h5v5" />
    <path d="M10 14L19 5" />
    <path d="M19 14v5H5V5h5" />
  </Icon>
);

export const PageIcon = () => (
  <Icon>
    <path d="M7 4h7l5 5v11H7z" />
    <path d="M14 4v5h5" />
  </Icon>
);

export const PlayIcon = () => (
  <Icon>
    <path d="M8 6l10 6-10 6z" fill="currentColor" stroke="none" />
  </Icon>
);
