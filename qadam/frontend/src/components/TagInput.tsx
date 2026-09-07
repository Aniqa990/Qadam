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
      <label htmlFor={id} className="qadam-label">
        {label}
      </label>
      <div className="flex gap-2">
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
          className="qadam-input w-full"
        />
        <button
          type="button"
          onClick={() => addTags(draft)}
          className="qadam-btn-secondary shrink-0 px-3"
        >
          Add
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${label} entries`}>
          {values.map((value, index) => (
            <li
              key={`${value}-${index}`}
              className="qadam-chip"
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                className="rounded-full p-0.5 text-emerald-600 hover:bg-emerald-100"
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
