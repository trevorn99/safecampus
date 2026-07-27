import styles from "@/styles/ui.module.css";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const AVATAR_CLASS = {
  sm: "avatarSmall",
  lg: "avatarLarge",
  xl: "avatarXl",
} as const;

const FALLBACK_CLASS = {
  sm: "avatarFallbackSmall",
  lg: "avatarFallbackLarge",
  xl: "avatarFallbackXl",
} as const;

export function Avatar({
  name,
  url,
  size = "sm",
}: {
  name: string;
  url?: string | null;
  size?: "sm" | "lg" | "xl";
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static/next-image-compatible asset
      <img src={url} alt="" className={styles[AVATAR_CLASS[size]]} />
    );
  }
  return <div className={styles[FALLBACK_CLASS[size]]}>{initials(name) || "?"}</div>;
}
