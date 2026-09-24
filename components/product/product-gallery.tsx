import Image from "next/image";

export function ProductGallery() {
  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 scrollbar-hide">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="shrink-0 w-[85%] md:w-[65%] aspect-video rounded-[5px] bg-muted/30 border border-border/40 overflow-hidden snap-center relative"
          >
            <Image
              src={`https://picsum.photos/seed/tarsi${i}/800/450`}
              alt={`Screenshot ${i}`}
              fill
              sizes="(max-width: 768px) 85vw, 65vw"
              className="object-cover"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-black/5 dark:ring-white/5 rounded-[5px] pointer-events-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
