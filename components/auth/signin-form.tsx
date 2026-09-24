"use client";

import * as React from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import {
  GithubLogoIcon,
  EnvelopeIcon,
  SealWarningIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  requestEmailCodeAction,
  verifyEmailCodeAction,
} from "@/app/actions/auth";

import {
  readRememberedProvider,
  writeRememberedProvider,
  type RememberedProvider,
} from "@/components/auth/auth-remember";
import {
  clearOtpPending,
  readOtpPending,
  writeOtpPending,
} from "@/lib/otp-pending";

// Erreurs redirigées par /auth/callback (?error=) — libellés FR stables,
// jamais de reflet brut du provider (anti-fuite).
const CALLBACK_ERRORS: Record<string, string> = {
  provider_denied: "Connexion refusée côté fournisseur. Réessayez.",
  no_code: "Lien de connexion incomplet. Redemandez un code.",
  not_configured: "Authentification non configurée. Réessayez plus tard.",
  exchange_failed: "Session non établie. Redemandez une code de connexion.",
};

// Supabase Auth réel : OAuth (redirect callback) + OTP email.
// Le badge "Récent" lira max(user.identities[].last_sign_in_at) au backend ;
// localStorage reste le fallback immédiat.
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

export function SigninForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lastUsed, setLastUsed] = React.useState<RememberedProvider | null>(
    null,
  );
  const [email, setEmail] = React.useState("");
  const [emailSent, setEmailSent] = React.useState(false);
  // Saisie d'un code déjà reçu (autre onglet/appareil) — sans renvoi.
  const [codeEntry, setCodeEntry] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<RememberedProvider | null>(null);
  const [otp, setOtp] = React.useState<string[]>(
    new Array(OTP_LENGTH).fill(""),
  );
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [resendIn, setResendIn] = React.useState(0);
  const otpRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const startResendCooldown = () => {
    setResendIn(RESEND_COOLDOWN_S);
  };

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Badge = dernière auth COMPLÉTÉE (avec expiry 30 j), jamais un clic.
  // Ancien format purgé silencieusement par le lecteur.
  // Restauration "code envoyé" (refresh/retour onglet, close/reopen < 10
  // min) — sinon le code reçu n'a nulle part où être tapé (bug QA).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastUsed(readRememberedProvider());
    const pendingOtp = readOtpPending();
    if (pendingOtp) {
      setEmail(pendingOtp.email);
      setEmailSent(true);
    }
  }, []);

  // Destination post-login : ?next= validé same-origin, sinon dashboard.
  // Erreur callback (?error=) : message FR mappé, jamais brut.
  const nextPath = React.useMemo(() => {
    const raw = searchParams.get("next") ?? "/dashboard";
    return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
  }, [searchParams]);
  const callbackError = React.useMemo(() => {
    const code = searchParams.get("error");
    if (!code) return null;
    return CALLBACK_ERRORS[code] ?? "Connexion impossible. Réessayez.";
  }, [searchParams]);

  const signInWith = async (provider: Exclude<RememberedProvider, "email">) => {
    setError(null);
    setPending(provider);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) throw error;
      // PAS d'écriture ici : seul AuthRemember écrit, post-auth complétée.
      // Redirection OAuth : le navigateur quitte la page ici.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible.");
      setPending(null);
    }
  };

  // OTP custom via Resend (template FR, code 6 chiffres) — Supabase reste
  // la seule autorité de session (action_link rejoué après vérification).
  const sendEmailCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (email.trim() === "") return;
    setError(null);
    setPending("email");
    try {
      const result = await requestEmailCodeAction({
        email: email.trim(),
        next: nextPath,
      });
      if (!result.ok) throw new Error(result.error);
      setEmailSent(true);
      setCodeEntry(false);
      writeOtpPending(email.trim());
      setOtp(new Array(OTP_LENGTH).fill(""));
      setOtpError(null);
      startResendCooldown();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setPending(null);
    }
  };

  const verifyOtpCode = async (code: string) => {
    setOtpError(null);
    setPending("email");
    try {
      const result = await verifyEmailCodeAction({
        email: email.trim(),
        code,
        next: nextPath,
      });
      if (!result.ok) {
        setOtpError(result.error);
        return;
      }
      // Auth complétée ici même → écriture légitime du badge.
      // Session déjà posée server-side (échange hash) : simple navigation
      // interne, jamais de trip navigateur vers Supabase.
      writeRememberedProvider("email");
      router.push(nextPath);
      router.refresh();
    } catch {
      setOtpError("Code incorrect ou expiré.");
    } finally {
      setPending(null);
    }
  };

  // Sortie du mode vérification (Changer d'adresse / Abandonner) :
  // état local + persistance purgés, retour à l'écran d'accueil complet.
  const resetOtp = () => {
    clearOtpPending();
    setEmailSent(false);
    setCodeEntry(false);
    setEmail("");
    setOtp(new Array(OTP_LENGTH).fill(""));
    setOtpError(null);
  };

  // Écran vérification dédié (Zéro UI : pas de carte, providers masqués,
  // titre propre — l'ancien panneau incrusté prêtait à confusion).
  if (emailSent) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 mb-4">
          <h1 className="text-4xl font-black tracking-tight text-foreground inline-flex items-center gap-3">
            Vérifiez votre email
            {pending === "email" && <Spinner size="md" />}
          </h1>
          <p className="text-base text-muted-foreground font-medium leading-relaxed">
            Nous avons envoyé un code à 6 chiffres à{" "}
            <span className="font-bold text-foreground">{email}</span> (valable
            10 minutes). Vous préférez cliquer ? Le lien est dans le mail.
          </p>
        </div>

        <div
          role="group"
          aria-label="Code de vérification à 6 chiffres"
          className="flex items-center gap-3"
        >
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                otpRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              disabled={pending === "email"}
              aria-label={`Chiffre ${i + 1}`}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(-1);
                setOtp((prev) => {
                  const next = [...prev];
                  next[i] = v;
                  return next;
                });
                setOtpError(null);
                if (v !== "" && i < OTP_LENGTH - 1) {
                  otpRefs.current[i + 1]?.focus();
                }
                const code = [...otp.slice(0, i), v, ...otp.slice(i + 1)].join(
                  "",
                );
                if (code.length === OTP_LENGTH) {
                  void verifyOtpCode(code);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && otp[i] === "" && i > 0) {
                  otpRefs.current[i - 1]?.focus();
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData
                  .getData("text")
                  .replace(/\D/g, "")
                  .slice(0, OTP_LENGTH);
                if (text === "") return;
                setOtp(() => {
                  const next = new Array(OTP_LENGTH).fill("");
                  text.split("").forEach((c, j) => {
                    next[j] = c;
                  });
                  return next;
                });
                setOtpError(null);
                if (text.length === OTP_LENGTH) {
                  void verifyOtpCode(text);
                } else {
                  otpRefs.current[
                    Math.min(text.length, OTP_LENGTH - 1)
                  ]?.focus();
                }
              }}
              className="h-14 sm:h-16 w-full min-w-0 rounded-xl bg-neutral border border-zinc-200 dark:border-zinc-900  text-center text-2xl font-black tabular-nums text-foreground outline-none focus:border-foreground/60 transition-colors disabled:opacity-50"
            />
          ))}
        </div>

        {otpError && (
          <p
            role="alert"
            className="text-[13px] font-bold text-red-600 dark:text-red-400"
          >
            {otpError}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={resetOtp}
            className="text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Changer d&apos;adresse
          </button>
          <button
            type="button"
            disabled={resendIn > 0 || pending !== null}
            onClick={() => void sendEmailCode()}
            className="text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            {resendIn > 0
              ? `Renvoyer (0:${String(resendIn).padStart(2, "0")})`
              : "Renvoyer le code"}
          </button>
        </div>
        <button
          type="button"
          onClick={resetOtp}
          className="self-start text-[13px] font-bold text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
        >
          ← Choisir une autre méthode
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {(error ?? callbackError) && (
        <div className="flex flex-row  items-center ">
          <SealWarningIcon className="w-7 h-7 text-red-600 dark:text-red-400 leading-relaxed" />
          <p
            role="alert"
            className="px-5 py-3 text-[13px] font-medium text-red-600 dark:text-red-400 leading-relaxed"
          >
            {error ?? callbackError}
          </p>
        </div>
      )}
      {/* Titre d'accueil (état par défaut — la vérification a le sien). */}
      <div className="flex flex-col gap-2 mb-7">
        <h1 className="text-4xl font-black tracking-tight text-foreground">
          Bienvenue
        </h1>
        <p className="text-base text-muted-foreground font-medium">
          Connectez-vous pour voter, soumettre et suivre vos produits.
        </p>
      </div>
      {/* Google — spec officielle : fond blanc/bordure, G intact */}
      <button
        type="button"
        onClick={() => signInWith("google")}
        disabled={pending !== null}
        className="relative w-full flex items-center justify-center gap-3 rounded-full border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-black px-5 h-12 text-[15px] font-medium text-[#1f1f1f] dark:text-[#e3e3e3] hover:bg-[#f8fafc] dark:hover:bg-[#1f1f1f] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
      >
        <Image
          src="/logos/google.svg"
          alt=""
          width={18}
          height={18}
          className="h-4.5 w-4.5 shrink-0"
        />
        <span>Continuer avec Google</span>
        {pending === "google" && <Spinner size="sm" />}
        <RecentBadge visible={lastUsed === "google"} />
      </button>

      {/* GitHub — mark monochrome, bouton sombre theme-aware */}
      <button
        type="button"
        onClick={() => signInWith("github")}
        disabled={pending !== null}
        className="relative w-full flex items-center justify-center gap-3 rounded-full bg-[#24292f] dark:bg-foreground px-5 h-12 text-[15px] font-bold text-white dark:text-background hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
      >
        <GithubLogoIcon weight="fill" className="h-5 w-5 shrink-0" />
        <span>Continuer avec GitHub</span>
        {pending === "github" && <Spinner size="sm" />}
        <RecentBadge visible={lastUsed === "github"} />
      </button>

      {/* Divider */}
      <div className="flex items-center gap-4 my-2">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
          ou
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {/* Email — état par défaut (la vérification a son écran dédié
          plus haut : early return). "J'ai déjà un code" = porte de secours
          sans renvoi (autre onglet/appareil, throttle silencieux). */}
      {!codeEntry && (
        <form onSubmit={sendEmailCode} className="flex flex-col gap-3">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none">
              <EnvelopeIcon weight="thin" className="w-5 h-5" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              aria-label="Adresse email"
              className="w-full h-12  bg-muted/75 border border-zinc-200 dark:border-zinc-900  pl-11 pr-4 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none focus:border-foreground/40 hover:border-foreground/20 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="relative w-full flex items-center justify-center gap-3 rounded-full bg-foreground h-12 px-7 text-[15px] font-bold text-background hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
          >
            <EnvelopeIcon weight="bold" className="h-5 w-5 shrink-0" />
            <span>Continuer avec email</span>
            {pending === "email" && !emailSent && <Spinner size="sm" />}
            <RecentBadge visible={lastUsed === "email"} />
          </button>
          {/* <p className="text-[12px] font-medium text-muted-foreground">
            Lien magique, sans mot de passe. Valable 1 heure.
          </p> */}
          <p className="text-center text-xs text-muted-foreground font-medium leading-relaxed">
            En continuant, vous acceptez nos{" "}
            <Link
              href="/conditions"
              className="text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors"
            >
              Conditions
            </Link>{" "}
            et notre{" "}
            <Link
              href="/confidentialite"
              className="text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors"
            >
              Politique
            </Link>
            .
          </p>
        </form>
      )}
      {/* Porte de secours : code déjà reçu (autre onglet/appareil).
          Bascule sur l'écran vérification SANS renvoyer (throttle
          silencieux côté serveur — zéro spam Resend). */}
      {!codeEntry && !emailSent && (
        <button
          type="button"
          onClick={() => setCodeEntry(true)}
          className="self-center text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          J&apos;ai déjà reçu un code
        </button>
      )}
      {codeEntry && !emailSent && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim() === "") return;
            setOtp(new Array(OTP_LENGTH).fill(""));
            setOtpError(null);
            setEmailSent(true);
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Adresse ayant reçu le code"
            aria-label="Adresse ayant reçu le code"
            autoFocus
            className="w-full h-12  bg-muted/75 border border-zinc-200 dark:border-zinc-900  px-5 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none focus:border-foreground/40 transition-colors"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 rounded-full bg-foreground h-12 px-7 text-[15px] font-bold text-background hover:opacity-90 transition-all cursor-pointer"
            >
              Afficher la saisie
            </button>
            <button
              type="button"
              onClick={() => {
                setCodeEntry(false);
                setEmail("");
              }}
              className="rounded-full border border-border/60 px-5 h-12 text-[14px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Retour
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Stacked badge (langage dot-notif) — jamais inline dans le bouton.
function RecentBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span className="absolute -top-2 right-4 rounded-full bg-emerald-700 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest tabular-nums leading-none shadow-sm">
      Récent
    </span>
  );
}
