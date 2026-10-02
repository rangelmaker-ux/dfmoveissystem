import { useState, type ComponentProps, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";

// Keep the user's text while editing; numeric parents may still store an empty value as zero.
export function DecimalInput({ value, onChange, onFocus, onBlur, ...props }: ComponentProps<typeof Input>) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = String(value ?? "").replace(".", ",");
  return <Input {...props} type="text" inputMode="decimal" value={draft ?? display}
    onFocus={event => { setDraft(display); if (!props.readOnly) event.currentTarget.select(); onFocus?.(event); }}
    onChange={event => {
      const text = event.target.value;
      if (!/^\d*([.,]\d*)?$/.test(text)) return;
      setDraft(text);
      const normalized = text.replace(",", ".");
      onChange?.({ ...event, target: { ...event.target, value: normalized }, currentTarget: { ...event.currentTarget, value: normalized } } as ChangeEvent<HTMLInputElement>);
    }}
    onBlur={event => { setDraft(null); onBlur?.(event); }} />;
}
