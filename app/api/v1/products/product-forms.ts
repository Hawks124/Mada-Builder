import { ApiError, iso } from "@/lib/api/response";
import { fetchMyProducts, parseProductLinkFields } from "@/services/products.service";

export type MyProductRow = Awaited<ReturnType<typeof fetchMyProducts>>["items"][number];

/** Miroir exact de la fiche privée maker (dashboard) — dates ISO. */
export function serializeMyProduct(r: MyProductRow) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    category: r.category,
    categories: r.categories,
    tags: r.tags,
    platforms: r.platforms,
    links: r.links,
    productType: r.productType,
    pricingModel: r.pricingModel,
    lifecycle: r.lifecycle,
    audience: r.audience,
    license: r.license,
    hasAds: r.hasAds,
    hasInAppPurchase: r.hasInAppPurchase,
    isChildDirected: r.isChildDirected,
    installCommand: r.installCommand,
    version: r.version,
    requirements: r.requirements,
    targetCountries: r.targetCountries,
    languagesSupported: r.languagesSupported,
    iconUrl: r.iconUrl,
    galleryOrientation: r.galleryOrientation,
    status: r.status,
    rejectionReason: r.rejectionReason,
    upvoteCount: r.upvoteCount,
    score: r.score,
    publishedAt: iso(r.publishedAt),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

/** Absent → undefined (PATCH : champ conservé) ; présent → tableau filtré. */
function jsonArr(fd: FormData, key: string): string[] | undefined {
  const raw = fd.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new ApiError("VALIDATION", 422, `Champ ${key} invalide.`);
    return parsed.filter((v): v is string => typeof v === "string");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("VALIDATION", 422, `Champ ${key} invalide.`);
  }
}

/**
 * Multipart mobile — MÊME contrat que le formulaire web (champs liens
 * individuels + fichiers `logo`/`screenshots`) : le service tranche
 * pareil (Zod, orientation pilotée, uniformité, quota 6, R2). Absent =
 * undefined (PATCH conserve) ; `hasInAppPurchase` = false comme le web
 * (non collecté en V1, des deux côtés).
 */
export function parseProductForm(fd: FormData) {
  const logoRaw = fd.get("logo");
  const logo = logoRaw instanceof File && logoRaw.size > 0 ? logoRaw : null;
  const screenshots = fd
    .getAll("screenshots")
    .filter((v): v is File => v instanceof File && v.size > 0);
  // Staging présigné (mobile) : clés R2 validées côté service (préfixe
  // maker, existence, pipeline complète). Jamais de confiance aveugle.
  const stagedLogoRaw = str(fd, "stagedLogo");
  const stagedScreenshots = jsonArr(fd, "stagedScreenshots") ?? [];
  const audience = str(fd, "audience");
  return {
    data: {
      name: str(fd, "name"),
      tagline: str(fd, "tagline"),
      description: str(fd, "description"),
      productType: str(fd, "productType"),
      lifecycle: str(fd, "lifecycle"),
      audience,
      category: str(fd, "category"),
      categories: jsonArr(fd, "categories"),
      tags: jsonArr(fd, "tags"),
      platforms: jsonArr(fd, "platforms"),
      pricingModel: str(fd, "pricing"),
      license: str(fd, "license"),
      installCommand: str(fd, "installCommand"),
      version: str(fd, "version"),
      requirements: str(fd, "requirements"),
      changelogUrl: str(fd, "changelogUrl"),
      hasAds: fd.get("hasAds") === null ? undefined : fd.get("hasAds") === "true",
      sharesData: fd.get("hasThirdParty") === null ? undefined : fd.get("hasThirdParty") === "true",
      hasInAppPurchase: false,
      // Absent (PATCH) = conservé — jamais de flip implicite vers false.
      isChildDirected: audience === undefined ? undefined : audience === "kids",
      targetCountries: jsonArr(fd, "targetCountries"),
      languagesSupported: jsonArr(fd, "languages"),
      galleryOrientation: str(fd, "galleryOrientation"),
      links: parseProductLinkFields(fd),
    },
    logo,
    screenshots,
    staged:
      stagedLogoRaw || stagedScreenshots.length > 0
        ? { logo: stagedLogoRaw ?? undefined, screenshots: stagedScreenshots }
        : undefined,
    /** Défaut brouillon (sûr) — `intent=publish` pour la file de revue. */
    asDraft: str(fd, "intent") !== "publish",
  };
}
