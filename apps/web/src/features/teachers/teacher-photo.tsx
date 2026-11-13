"use client";
import { useState, type ReactElement } from "react";
import { toastManager } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ProfilePhotoView } from "../student-documents/profile-photo-view";

const MAX_PHOTO_BYTES = 5_242_880;

export function TeacherPhoto({ id, name }: { id: string; name: string }): ReactElement {
  const query = trpc.teachers.files.useQuery(
    { id },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const photo = query.data?.find((file) => file.kind === "PHOTO");
  const visiblePhoto = photo && photo.id !== failedId ? photo : undefined;
  const loaded = Boolean(visiblePhoto && loadedId === visiblePhoto.id);

  async function upload(file: File): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/teacher-files", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-Upload-Metadata": encodeURIComponent(
            JSON.stringify({
              teacherId: id,
              kind: "PHOTO",
              label: "Foto do professor",
              fileName: file.name,
              contentType: file.type,
              byteLength: file.size,
            }),
          ),
        },
        body: file,
      });
      if (!response.ok) {
        const failure = (await response.json()) as { message?: string };
        throw new Error(failure.message ?? "Não foi possível enviar a foto.");
      }
      setLoadedId(null);
      await utils.teachers.files.invalidate({ id });
      toastManager.add({ title: "Foto atualizada", type: "success" });
    } catch (error) {
      toastManager.add({
        title: "Não foi possível enviar a foto.",
        description: error instanceof Error ? error.message : "Tente novamente.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProfilePhotoView
      subjectLabel="professor"
      maxSize={MAX_PHOTO_BYTES}
      name={name}
      photoUrl={visiblePhoto ? `/api/teacher-files/${visiblePhoto.id}` : undefined}
      loaded={loaded}
      busy={busy}
      waitingForPhoto={false}
      loading={busy || query.isPending || Boolean(visiblePhoto && !loaded)}
      open={open}
      setOpen={setOpen}
      setLoaded={(value) => setLoadedId(value ? (visiblePhoto?.id ?? null) : null)}
      onPhotoError={() => setFailedId(photo?.id ?? null)}
      onUpload={upload}
    />
  );
}
