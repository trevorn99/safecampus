// event_types is now the source of truth for what's selectable — this file
// only carries display fallbacks. Existing rows written before custom types
// shipped still hold the old lowercase values, so this maps those to the
// same capitalized labels the seeded defaults use; anything else (a custom
// type, typed by an admin) is already human-readable and shown as-is, even
// after it's renamed or removed from the org's list.
const LEGACY_TYPE_LABEL: Record<string, string> = {
  service: "Service",
  drill: "Drill",
  meeting: "Meeting",
  training: "Training",
};

export function eventTypeLabel(type: string): string {
  return LEGACY_TYPE_LABEL[type] ?? type;
}
