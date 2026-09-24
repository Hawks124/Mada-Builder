"use client";

import { useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface AccordionItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function AccordionItem({ question, answer, isOpen, onToggle }: AccordionItemProps) {
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 py-4 text-left group cursor-pointer"
      >
        <span
          className={cn(
            "text-[13px] font-bold leading-snug transition-colors",
            isOpen ? "text-foreground" : "text-foreground/70 group-hover:text-foreground",
          )}
        >
          {question}
        </span>
        <CaretDownIcon
          weight="bold"
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <p className="pb-4 text-[13px] font-medium text-muted-foreground leading-relaxed pr-4">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

interface SidebarAccordionProps {
  items: { question: string; answer: string }[];
  /** Allow only one item open at a time (default: true) */
  singleOpen?: boolean;
}

export function SidebarAccordion({ items, singleOpen = true }: SidebarAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    if (singleOpen) {
      setOpenIndex(openIndex === index ? null : index);
    }
  };

  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <AccordionItem
          key={i}
          question={item.question}
          answer={item.answer}
          isOpen={openIndex === i}
          onToggle={() => handleToggle(i)}
        />
      ))}
    </div>
  );
}
