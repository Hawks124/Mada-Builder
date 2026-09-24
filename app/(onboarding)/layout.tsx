/**
 * Groupe onboarding — passe-plat VOLONTAIRE : /bienvenue est une page
 * standalone qui possède tout son viewport (logo, identité, titre,
 * formulaire). Aucun chrome ici : un second centrage casserait le layout.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
