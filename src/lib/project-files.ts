import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
export async function openProjectFile(projectId: string, name: string) {
  const download = /\.xml$/i.test(name);
  const windowHandle = download ? null : window.open("about:blank", "_blank");
  if (windowHandle) windowHandle.opener = null;
  try {
    const { data, error } = await supabase.storage
      .from("projetos_arquivos")
      .createSignedUrl(`${projectId}/${name}`, 300, download ? { download: name } : undefined);
    if (error) throw error;
    if (download) {
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else if (windowHandle) windowHandle.location.href = data.signedUrl;
    else window.location.assign(data.signedUrl);
  } catch {
    windowHandle?.close();
    toast.error(`Não foi possível ${download ? "baixar" : "abrir"} o arquivo. Verifique seu acesso e tente novamente.`);
  }
}
