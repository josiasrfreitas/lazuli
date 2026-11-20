"use client";

import type { ReactElement } from "react";
import { Search } from "lucide-react";
import { Input } from "@lazuli/ui";
import { useSearchDraft } from "~/lib/use-search-draft";

type TableSearchProps = {
  label: string;
  placeholder: string;
  value: string;
  onCommit: (value: string) => void;
  name?: string;
  maxLength?: number;
};

/** Keeps typing immediate while the listing commits its own URL and pagination. */
export function TableSearch({ label, value, onCommit, ...input }: TableSearchProps): ReactElement {
  const [draft, setDraft] = useSearchDraft(value, onCommit);
  return (
    <Input
      {...input}
      type="search"
      autoComplete="off"
      size="compact-responsive"
      aria-label={label}
      leadingIcon={<Search aria-hidden="true" />}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}
