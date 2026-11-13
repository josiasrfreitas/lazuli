"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Avatar } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

type Photo = { id: string; updatedAt: Date };
type Context = {
  register: (id: string) => () => void;
  photos: Map<string, Photo>;
  pending: boolean;
};
const Photos = createContext<Context | null>(null);

/** Collect mounted identities before issuing one independent metadata query. */
export function StudentAvatarProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState(() => new Map<string, number>());
  const register = useCallback((id: string) => {
    setCounts((previous) => new Map(previous).set(id, (previous.get(id) ?? 0) + 1));
    return () =>
      setCounts((previous) => {
        const next = new Map(previous);
        const count = (next.get(id) ?? 1) - 1;
        if (count) next.set(id, count);
        else next.delete(id);
        return next;
      });
  }, []);
  const ids = useMemo(() => [...counts.keys()].sort(), [counts]);
  const [batch, setBatch] = useState<string[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => setBatch(ids), 40);
    return () => clearTimeout(timer);
  }, [ids]);
  const query = trpc.studentDocuments.photos.useQuery(
    { studentIds: batch.slice(0, 500) },
    {
      enabled: batch.length > 0,
      staleTime: 60_000,
      placeholderData: (previous) => previous,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const photos = useMemo(
    () => new Map((query.data ?? []).map((photo) => [photo.studentId, photo])),
    [query.data],
  );
  const value = useMemo(
    () => ({ register, photos, pending: query.isFetching }),
    [register, photos, query.isFetching],
  );
  return <Photos.Provider value={value}>{children}</Photos.Provider>;
}

export function StudentAvatar(props: ComponentProps<typeof Avatar>) {
  const context = useContext(Photos);
  const id = props.colorKey;
  const register = context?.register;
  useEffect(() => {
    if (id && register && /^[0-9a-f-]{36}$/i.test(id)) return register(id);
  }, [id, register]);
  const photo = id ? context?.photos.get(id) : undefined;
  const url = photo
    ? `/api/student-document-files/${photo.id}?v=${photo.updatedAt.getTime()}`
    : null;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span
      className="relative inline-flex shrink-0"
      aria-busy={Boolean(context?.pending || (url && url !== loaded && url !== failed))}
    >
      <span
        className={
          context?.pending || (url && url !== loaded && url !== failed)
            ? "inline-flex animate-pulse motion-reduce:animate-none"
            : "inline-flex"
        }
      >
        <Avatar {...props} />
      </span>
      {url && failed !== url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className={
            loaded === url
              ? "absolute inset-0 size-full rounded-full object-cover"
              : "absolute inset-0 size-full rounded-full object-cover opacity-0"
          }
          onLoad={() => setLoaded(url)}
          onError={() => setFailed(url)}
        />
      )}
    </span>
  );
}
