import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, ImageOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/hooks/use-auth";
import { openProjectFile } from "@/lib/project-files";

export function ProjectFileThumbnail({ projectId, name }: { projectId: string; name: string }) {
  const userId = useAuthStore(state => state.user?.id);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const isImage = /\.(jpe?g|png|webp|gif|avif)$/i.test(name);

  useEffect(() => {
    const node = buttonRef.current;
    if (!node || !isImage) return;
    const observer = new IntersectionObserver(entries => {
      setVisible(entries.some(entry => entry.isIntersecting));
    }, { rootMargin: "100px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isImage]);

  const { data: url, isLoading } = useQuery({
    queryKey: ["project-file-preview", userId, projectId, name],
    enabled: Boolean(userId && isImage && visible),
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("projetos_arquivos")
        .createSignedUrl(`${projectId}/${name}`, 300);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 240_000,
    gcTime: 300_000,
    refetchInterval: visible ? 240_000 : false,
    retry: 1,
  });

  if (!isImage) return <FileText className="h-5 w-5 text-slate-600 shrink-0" />;

  return (
    <button ref={buttonRef} type="button" onClick={() => void openProjectFile(projectId, name)}
      aria-label={`Abrir imagem ${name.replace(/^\d+_/, "")}`}
      title="Abrir imagem em tamanho maior"
      className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
      {url && failedUrl !== url ? (
        <img src={url} alt={name.replace(/^\d+_/, "")} loading="lazy" decoding="async"
          className="h-full w-full object-contain" onError={() => setFailedUrl(url)} />
      ) : isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : (
        <ImageOff className="h-5 w-5 text-slate-400" />
      )}
    </button>
  );
}
