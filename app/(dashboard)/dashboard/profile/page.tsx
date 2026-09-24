import type { Metadata } from "next";
import {
  ProfileForm,
  type ProfileInitial,
} from "@/components/dashboard/profile-form";
import { fetchMyProfile } from "@/app/actions/profile";

// Auth pages are noindex (§7)
export const metadata: Metadata = {
  title: "Profil",
  robots: { index: false, follow: false },
};

// Fallback mock documenté (contributeur sans backend : la maquette reste
// démontrable, la sauvegarde répond "Connectez-vous", jamais de crash).
const MOCK_INITIAL: ProfileInitial = {
  username: "kaliana",
  displayName: "Kaliana R.",
  avatarUrl: "https://i.pravatar.cc/150?u=kaliana",
  bio: "Maker malgache — SaaS RH et outils fintech.",
  occupation: "maker",
  websiteUrl: null,
  location: "Antananarivo, Madagascar",
  socialLinks: {},
};

// Public maker profile edition — avatar, occupation, bio, links.
// Le public view vit à /makers/[username].
export default async function DashboardProfilePage() {
  let initial = MOCK_INITIAL;
  try {
    const row = await fetchMyProfile();
    if (row) {
      const location = [row.city, row.country].filter(Boolean).join(", ");
      const socialLinks: Record<string, string> = {};
      for (const [k, v] of Object.entries(row.socialLinks ?? {})) {
        if (typeof v === "string" && v !== "") socialLinks[k] = v;
      }
      initial = {
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        bio: row.bio,
        occupation: row.occupation,
        websiteUrl: row.websiteUrl,
        location,
        socialLinks,
      };
    }
  } catch {
    // Backend non configuré ou hors-ligne : mock ci-dessus.
  }
  return <ProfileForm initial={initial} />;
}
