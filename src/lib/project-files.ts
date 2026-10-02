import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
export async function openProjectFile(projectId: string, name: string) {
  const windowHandle = window.open("about:blank", "_blank");
  if (windowHandle) windowHandle.opener = null;
  try {
    const { data, error } = await supabase.storage
      .from("projetos_arquivos")
      .createSignedUrl(`${projectId}/${name}`, 300);
    if (error) throw error;
    if (windowHandle) windowHandle.location.href = data.signedUrl;
    else window.location.assign(data.signedUrl);
  } catch {
    windowHandle?.close();
    toast.error("Não foi possível abrir o arquivo. Verifique seu acesso e tente novamente.");
  }
}
