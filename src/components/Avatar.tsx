import styles from "@/styles/ui.module.css";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Avatar({
  name,
  url,
  size = "sm",
}: {
  name: string;
  url?: string | null;
  size?: "sm" | "lg";
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static/next-image-compatible asset
      <img src={url} alt="" className={size === "lg" ? styles.avatarLarge : styles.avatarSmall} />
    );
  }
  return (
    <div className={size === "lg" ? styles.avatarFallbackLarge : styles.avatarFallbackSmall}>
      {initials(name) || "?"}
    </div>
  );
}
