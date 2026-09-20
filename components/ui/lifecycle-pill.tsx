import { getLifecycleById } from "@/config/lifecycle";
import { cn } from "@/lib/utils";

// Avancement produit — pill teintée (dev amber, bêta sky, live emerald).
// Distincte de la pill de revue (pending/published/rejected).
export function LifecyclePill({
  lifecycleId,
  className,
}: {
  lifecycleId: string;
  className?: string;
}) {
  const status = getLifecycleById(lifecycleId);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] leading-none shrink-0",
        status.pillClass,
        className,
      )}
    >
      <status.icon weight="fill" className="w-3 h-3" aria-hidden="true" />
      {status.label}
    </span>
  );
}
