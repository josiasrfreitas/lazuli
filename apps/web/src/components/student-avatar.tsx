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
  type ReactElement,
} from "react";
import { Avatar } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

type Photo = { id: string; updatedAt: Date };
type Context = {
  register: (id: string) => () => void;
  photos: Map<string, Photo>;
  pending: boolean;
};
const PHOTO_BATCH_DELAY_MS = 40;
const PHOTO_BATCH_LIMIT = 500;
const Photos = createContext<Context | null>(null);

/** Collect mounted identities before issuing one independent metadata query. */
export function StudentAvatarProvider({ children }: { children: ReactNode }): ReactElement {
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
  const ids = useMemo(() => [...counts.keys()].toSorted(), [counts]);
  const [batch, setBatch] = useState<string[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => setBatch(ids), PHOTO_BATCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ids]);
  const query = trpc.studentDocuments.photos.useQuery(
    { studentIds: batch.slice(0, PHOTO_BATCH_LIMIT) },
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

function useStudentPhoto(id: string | undefined): { url: string | null; pending: boolean } {
  const context = useContext(Photos);
  const register = context?.register;
  useEffect(() => {
    if (id && register && /^[0-9a-f-]{36}$/i.test(id)) return register(id);
  }, [id, register]);
  const photo = context?.photos.get(id ?? "");
  const url = photo
    ? `/api/student-document-files/${photo.id}?v=${photo.updatedAt.getTime()}`
    : null;
  return { url, pending: context?.pending ?? false };
}

function usePhotoPresentation(
  url: string | null,
  pending: boolean,
): {
  loading: boolean;
  visible: boolean;
  ready: boolean;
  setLoaded: (url: string) => void;
  setFailed: (url: string) => void;
} {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const loading = pending || Boolean(url && url !== loaded && url !== failed);
  return {
    loading,
    visible: Boolean(url && failed !== url),
    ready: loaded === url,
    setLoaded,
    setFailed,
  };
}

export function StudentAvatar(props: ComponentProps<typeof Avatar>): ReactElement {
  const { url, pending } = useStudentPhoto(props.colorKey);
  const presentation = usePhotoPresentation(url, pending);
  return (
    <span className="relative inline-flex shrink-0" aria-busy={presentation.loading}>
      <span
        className={
          presentation.loading
            ? "inline-flex animate-pulse motion-reduce:animate-none"
            : "inline-flex"
        }
      >
        <Avatar {...props} />
      </span>
      {url && presentation.visible && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className={
            presentation.ready
              ? "absolute inset-0 size-full rounded-full object-cover"
              : "absolute inset-0 size-full rounded-full object-cover opacity-0"
          }
          onLoad={() => presentation.setLoaded(url)}
          onError={() => presentation.setFailed(url)}
        />
      )}
    </span>
  );
}
