"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { FieldBadge } from "@/components/ui/field-badge";
import {
  DEFAULT_OCCUPATION_ID,
  OCCUPATIONS,
} from "@/config/occupations";

// Occupation partagée — vocabulaire fermé (users.occupation backend).
// Pilotée par `defaultValue` + champ caché `occupation` (submit natif).
export function ProfileOccupation({
  defaultValue = DEFAULT_OCCUPATION_ID,
}: {
  defaultValue?: string;
}) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
        Occupation
        <FieldBadge variant="optional" />
      </label>
      <Select
        value={value}
        onChange={setValue}
        options={OCCUPATIONS.map((o) => ({
          id: o.id,
          label: o.label,
          description: o.description,
          icon: <o.icon weight="fill" className="w-4 h-4 shrink-0" />,
        }))}
      />
      <input type="hidden" name="occupation" value={value} />
      <span className="text-[12px] font-medium text-muted-foreground leading-relaxed">
        Visible sur votre profil public et dans les résultats de recherche.
      </span>
    </div>
  );
}
