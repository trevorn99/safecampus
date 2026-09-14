import type { MetadataRoute } from "next";

// Makes the app installable to a phone's home screen, which is what turns
// /checkin from "a web page someone has to find" into something a volunteer
// opens like an app. Deliberately not a separate native build: sign-in here
// is a passwordless emailed link, and a native shell would mean rebuilding
// deep links, token storage and session lifecycle before writing a line of
// check-in logic.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SafeCampus",
    short_name: "SafeCampus",
    description: "Scheduling and check-in for safety teams.",
    // Opens straight to check-in. Someone installing this to their phone is
    // almost always doing it to check in on arrival, not to read the roster.
    start_url: "/checkin",
    display: "standalone",
    background_color: "#f4f6f4",
    theme_color: "#0f7568",
    icons: [
      { src: "/images/logo-mark.png", sizes: "720x720", type: "image/png", purpose: "any" },
      { src: "/images/logo-mark.png", sizes: "720x720", type: "image/png", purpose: "maskable" },
    ],
  };
}
