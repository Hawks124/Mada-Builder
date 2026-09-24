import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import { getMakersCount, getRecentMakers } from "@/services/users.service";

// Stack avatars du hero — données vivantes (5 derniers inscrits + total),
// fallback mock documenté sans backend (même pattern que le middleware).
// avatarUrl NULL (jamais uploadé) = INITIALES, jamais un visage d'emprunt
// (coller un pravatar à un vrai user = fausse identité — bug QA).
// Pas de push temps réel : revalidation à la navigation suffit à ce rythme.
const FALLBACK_AVATARS = [
  {
    username: "kaliana",
    displayName: "Kaliana R.",
    avatarUrl: "https://i.pravatar.cc/150?u=a042581f4e29026024d",
  },
  {
    username: "bryl",
    displayName: "Bryl Lim",
    avatarUrl: "https://i.pravatar.cc/150?u=a04258a2462d826712d",
  },
  {
    username: "jas",
    displayName: "Jas Apusaga",
    avatarUrl: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
  },
  {
    username: "lorenz-edward",
    displayName: "Lorenz Edward",
    avatarUrl: "https://i.pravatar.cc/150?u=a04258114e29026702d",
  },
  {
    username: "mauries-lopez",
    displayName: "Mauries Lopez",
    avatarUrl: "https://i.pravatar.cc/150?u=b042581f4e29026704d",
  },
];
const FALLBACK_COUNT = 1200;

type HeroMaker = { username: string; displayName: string; avatarUrl: string | null };

export async function HeroMakers() {
  let avatars: HeroMaker[] = FALLBACK_AVATARS;
  let total = FALLBACK_COUNT;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const [recent, count] = await Promise.all([
        getRecentMakers(5),
        getMakersCount(),
      ]);
      if (recent.length > 0) {
        avatars = recent.map((m) => ({
          username: m.username,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl,
        }));
      }
      if (count > 0) total = count;
    } catch {
      // Backend indisponible : fallback mock ci-dessus.
    }
  }

  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="flex -space-x-2.5">
        {avatars.map((maker, i) => {
          return (
            <Link
              key={maker.username}
              href={`/makers/${maker.username}`}
              aria-label={`Voir le profil de ${maker.username}`}
              className="relative transition-transform duration-300 hover:-translate-y-1 hover:z-20"
              style={{ zIndex: 10 - i }}
            >
              <AvatarImage
                src={maker.avatarUrl}
                name={maker.displayName}
                size={32}
                className="border-[2.5px] border-background"
              />
            </Link>
          );
        })}
      </div>
      <p className="text-[13px] font-bold text-muted-foreground whitespace-pre">
        Rejoignez{"   "}
        <span className="text-foreground">
          +{total.toLocaleString("fr-FR")}
        </span>{" "}
        makers
      </p>
    </div>
  );
}
