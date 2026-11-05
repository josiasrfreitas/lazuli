import { useEffect, useState, type RefObject } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import type { AddressFields } from "./reducer";

const ADDRESS_SEARCH_DELAY_MS = 350;
const MIN_ADDRESS_QUERY_LENGTH = 3;

type LookupArgs = {
  address: AddressFields;
  onChange: (value: AddressFields) => void;
  onBusyChange: (busy: boolean) => void;
  root: RefObject<HTMLDivElement | null>;
  revision: RefObject<number>;
};

export type AddressLookup = {
  query: string;
  options: RouterOutputs["addresses"]["search"];
  searching: boolean;
  loading: boolean;
  failed: boolean;
  searchFailed: boolean;
  resolving: boolean;
  message: string;
  select: (placeId: string) => Promise<void>;
  changeQuery: (text: string) => void;
  clearQuery: () => void;
};

type SelectionArgs = LookupArgs & {
  placeId: string;
  resolve: (input: { placeId: string }) => Promise<AddressFields>;
  setSearching: (value: boolean) => void;
  setMessage: (value: string) => void;
};

function lookupDisplay({
  searching,
  current,
  options,
  isFetching,
  isError,
  isPending,
}: {
  searching: boolean;
  current: boolean;
  options: RouterOutputs["addresses"]["search"] | undefined;
  isFetching: boolean;
  isError: boolean;
  isPending: boolean;
}): Pick<AddressLookup, "options" | "loading" | "failed" | "searchFailed" | "resolving"> {
  return {
    options: searching && current ? (options ?? []) : [],
    loading: searching && (!current || isFetching || isPending),
    failed: searching && current && isError,
    searchFailed: searching && isError,
    resolving: isPending,
  };
}

async function selectAddress(args: SelectionArgs): Promise<void> {
  const request = ++args.revision.current;
  args.setMessage("");
  args.onBusyChange(true);
  try {
    const result = await args.resolve({ placeId: args.placeId });
    if (request !== args.revision.current) return;
    args.onChange(result);
    args.setSearching(false);
    args.setMessage(
      result.street
        ? "Endereço preenchido. Confira o número e acrescente o complemento, se houver."
        : "Localidade preenchida. Complete a rua ou avenida e o número.",
    );
    requestAnimationFrame(() =>
      args.root.current
        ?.querySelector<HTMLInputElement>(
          result.street ? 'input[name="address.number"]' : 'input[name="address.street"]',
        )
        ?.focus(),
    );
  } catch {
    if (request === args.revision.current)
      args.setMessage(
        "Não foi possível carregar o endereço. Tente novamente ou preencha os campos abaixo.",
      );
  } finally {
    args.onBusyChange(false);
  }
}

export function useAddressLookup(args: LookupArgs): AddressLookup {
  const query = args.address.street;
  const [searching, setSearching] = useState(false);
  const [debounced, setDebounced] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), ADDRESS_SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const search = trpc.addresses.search.useQuery(
    { query: debounced },
    {
      enabled:
        searching && debounced.length >= MIN_ADDRESS_QUERY_LENGTH && query.trim() === debounced,
      retry: false,
      gcTime: 0,
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  );
  const resolve = trpc.addresses.resolve.useMutation();
  const current = query.trim() === debounced;
  const display = lookupDisplay({
    searching,
    current,
    options: search.data,
    isFetching: search.isFetching,
    isError: search.isError,
    isPending: resolve.isPending,
  });
  const actions = addressLookupActions({
    ...args,
    resolve: resolve.mutateAsync,
    setSearching,
    setMessage,
  });
  return {
    query,
    ...display,
    searching,
    message,
    ...actions,
  };
}

function addressLookupActions(
  args: Omit<SelectionArgs, "placeId">,
): Pick<AddressLookup, "select" | "changeQuery" | "clearQuery"> {
  return {
    select: (placeId) => selectAddress({ ...args, placeId }),
    changeQuery: (text) => {
      args.revision.current += 1;
      args.setSearching(true);
      args.setMessage("");
      args.onChange({ ...args.address, street: text });
    },
    clearQuery: () => {
      args.revision.current += 1;
      args.setSearching(false);
      args.setMessage("");
      args.onChange({
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        postalCode: "",
      });
    },
  };
}
