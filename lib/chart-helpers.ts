// Shared helpers for the recharts-based analytics and store charts

// One distinct color per category so pie slices never share a color
export const CATEGORY_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#a855f7', // violet
  '#eab308', // yellow
  '#64748b', // slate
];

// Shortens long axis labels; the full name still shows in the tooltip
export function truncateLabel(label: string, maxLength = 18): string {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

// Formats a YYYY-MM key as e.g. "Sep 2026" (built locally to avoid UTC shifts)
export function formatMonthForDisplay(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1); // month is 0-indexed

  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}
