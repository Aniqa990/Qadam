/**
 * Shared Tailwind class strings for consistent civic-tech UI.
 * Prefer these (or `.qadam-*` CSS utilities) over one-off class soup.
 */
export const ui = {
  page: "qadam-page",
  pageNarrow: "qadam-page-narrow",
  pageWide: "mx-auto w-full max-w-6xl px-4 py-8 sm:px-6",
  card: "qadam-card p-5 sm:p-6",
  cardInteractive: "qadam-card-interactive p-5 sm:p-6",
  sectionTitle: "qadam-section-title",
  sectionSub: "qadam-section-sub",
  label: "qadam-label",
  input: "qadam-input",
  btnPrimary: "qadam-btn-primary",
  btnSecondary: "qadam-btn-secondary",
  btnGhost: "qadam-btn-ghost",
  btnDanger: "qadam-btn-danger",
  chip: "qadam-chip",
} as const;
