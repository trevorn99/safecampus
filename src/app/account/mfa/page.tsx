import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getAvatarUrlMap } from "@/lib/avatars";
import { MfaManager } from "./MfaManager";
import { ProfilePictureForm } from "./ProfilePictureForm";
import { ForgetDevicesButton } from "./ForgetDevicesButton";
import styles from "@/styles/ui.module.css";

export default async function MfaSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Deliberately not requireMembership() here — that redirects admins
  // without MFA to this exact page, which would loop.
  const { data: member } = await supabase
    .from("members")
    .select("id, name, organization_id, profile_picture_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    redirect("/onboarding");
  }

  const [{ data: isAdmin }, { data: privilegedRole }, { data: isPlatformAdmin }] = await Promise.all([
    supabase.rpc("is_org_admin", { target_org: member.organization_id }),
    supabase
      .from("role_assignments")
      .select("id")
      .eq("member_id", member.id)
      .in("role", ["org_admin", "location_manager"])
      .limit(1)
      .maybeSingle(),
    supabase.rpc("is_platform_admin"),
  ]);

  const avatarUrls = await getAvatarUrlMap(supabase, [member.profile_picture_url]);

  return (
    <>
      <AppHeader isAdmin={Boolean(isAdmin)} isPlatformAdmin={Boolean(isPlatformAdmin)} />
      <main className={styles.appMain}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>Account</h1>
        </div>

        <ProfilePictureForm
          memberId={member.id}
          organizationId={member.organization_id}
          name={member.name}
          currentUrl={member.profile_picture_url ? (avatarUrls.get(member.profile_picture_url) ?? null) : null}
        />

        <div className={styles.pageHeading}>
          <h2 className={styles.pageTitle}>Two-factor authentication</h2>
          <p className={styles.subtitle}>
            {privilegedRole
              ? "Required for your role — protects the organization's most sensitive data."
              : "Add an extra layer of protection to your account."}
          </p>
        </div>
        <MfaManager />
        <ForgetDevicesButton />
      </main>
    </>
  );
}
