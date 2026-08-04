export const EVENT_TYPES = ["service", "drill", "meeting", "training"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABEL: Record<string, string> = {
  service: "Service",
  drill: "Drill",
  meeting: "Meeting",
  training: "Training",
};
