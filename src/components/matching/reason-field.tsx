"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CUSTOM_REASON_VALUE } from "@/lib/matching/reason-templates";

export function ReasonField({
  id,
  label = "Begründung (Pflicht)",
  templates,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label?: string;
  templates: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [templateKey, setTemplateKey] = useState<string>(CUSTOM_REASON_VALUE);

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${id}-template`}>Textbaustein</Label>
      <Select
        value={templateKey}
        onValueChange={(v) => {
          if (!v) return;
          setTemplateKey(v);
          if (v === CUSTOM_REASON_VALUE) {
            onChange("");
            return;
          }
          const idx = Number(v);
          if (Number.isFinite(idx) && templates[idx]) {
            onChange(templates[idx]);
          }
        }}
      >
        <SelectTrigger id={`${id}-template`} className="w-full">
          <SelectValue placeholder="Textbaustein wählen…">
            {templateKey === CUSTOM_REASON_VALUE
              ? "Eigene Begründung…"
              : templates[Number(templateKey)]?.slice(0, 60) +
                (templates[Number(templateKey)]?.length > 60 ? "…" : "")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CUSTOM_REASON_VALUE}>
            Eigene Begründung…
          </SelectItem>
          {templates.map((t, i) => (
            <SelectItem key={i} value={String(i)}>
              <span className="line-clamp-2 text-left">{t}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // bei manueller Editierung Template auf „eigene“ belassen, wenn Text abweicht
          const idx = Number(templateKey);
          if (
            templateKey !== CUSTOM_REASON_VALUE &&
            templates[idx] &&
            e.target.value !== templates[idx]
          ) {
            setTemplateKey(CUSTOM_REASON_VALUE);
          }
        }}
        placeholder={
          placeholder ??
          "Textbaustein wählen oder eigene Begründung eingeben…"
        }
      />
    </div>
  );
}
