import { useState } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  hint?: string;
  max?: number;
}

/**
 * Chip-style input for short lists (skills, requirements). Commits on Enter,
 * comma, or the Add button; duplicate entries (case-insensitive) are ignored.
 */
export default function TagInput({
  id,
  label,
  values,
  onChange,
  placeholder,
  hint,
  max = 20,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  function addTags(raw: string) {
    const tags = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) return;

    const next = [...values];
    for (const tag of tags) {
      if (next.length >= max) break;
      if (!next.some((v) => v.toLowerCase() === tag.toLowerCase())) {
        next.push(tag);
      }
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTags(draft);
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => addTags(draft)}
          className="shrink-0 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-secondary"
        >
          Add
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${label} entries`}>
          {values.map((value, index) => (
            <li
              key={`${value}-${index}`}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
