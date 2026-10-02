import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/hooks/use-auth";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Calendar, Shield, Camera, Loader2, Download, Smartphone } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/_dashboard/projetista/perfil")({
  component: PerfilPage,
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "erro desconhecido";
}

function PerfilPage() {
  const { user, setUser } = useAuthStore();
  const { isInstallable, isAppInstalled, handleInstallClick } = usePWAInstall();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [bio, setBio] = useState('');
  const [savedBio, setSavedBio] = useState('');
  const [nome, setNome] = useState(user?.nome || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase.from('users').select('bio').eq('id', user.id).single().then(({ data, error }) => {
      if (!cancelled && !error && data) { setBio(data.bio); setSavedBio(data.bio); }
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase.from("users").update({ nome: nome.trim(), bio }).eq("id", user.id);

      if (error) throw error;

      setUser({ ...user, nome: nome.trim() });
      setSavedBio(bio);
      toast.success("Perfil atualizado com sucesso!");
    } catch (error: unknown) {
      toast.error("Erro ao atualizar perfil: " + errorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error('Use uma imagem JPG, PNG ou WebP de até 5 MB.'); return;
    }
    setIsUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars") // Using existing bucket for convenience
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) { await supabase.storage.from('avatars').remove([filePath]); throw updateError; }
      if (user.avatar_url?.includes('/object/public/avatars/')) {
        const oldPath = user.avatar_url.split('/object/public/avatars/')[1];
        if (oldPath.startsWith(`${user.id}/`)) await supabase.storage.from('avatars').remove([oldPath]);
      }

      setUser({ ...user, avatar_url: publicUrl });
      toast.success("Foto de perfil atualizada!");
    } catch (error: unknown) {
      toast.error("Erro ao enviar foto: " + errorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground">
          Gerencie suas informações pessoais e configurações de conta.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="text-center">
            <div className="relative mx-auto w-24 h-24 mb-4">
              <UserAvatar
                src={user?.avatar_url}
                name={user?.nome}
                className="h-full w-full rounded-full border-4 border-background bg-primary/10 text-primary shadow-sm"
                iconClassName="h-11 w-11"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
            <CardTitle>{user?.nome}</CardTitle>
            <CardDescription>
              {user?.role === "PROJETISTA" ? "Projetista Especialista" : "Administrador"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                Membro desde {user ? new Date(user.created_at).toLocaleDateString("pt-BR") : "-"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span>Acesso: {user?.role}</span>
            </div>
            <div className="pt-4 border-t mt-4">
              {isAppInstalled ? (
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium bg-green-50 p-3 rounded-lg border border-green-100">
                  <Smartphone className="h-4 w-4" />
                  <span>Aplicativo Instalado</span>
                </div>
              ) : isInstallable ? (
                <Button
                  variant="default"
                  size="lg"
                  className="w-full justify-center gap-2 font-bold shadow-md hover:shadow-lg transition-all"
                  onClick={handleInstallClick}
                >
                  <Download className="h-5 w-5" />
                  <span>Instalar Aplicativo no PC / Celular</span>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Informações da Conta</CardTitle>
            <CardDescription>Atualize seus dados de contato e preferências.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail Profissional</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="email" value={user?.email} disabled className="pl-9 bg-muted/50" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Biografia / Especialidades</Label>
              <textarea
                id="bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Conte um pouco sobre suas especialidades em móveis planejados..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button onClick={handleUpdateProfile} disabled={isUpdating || !nome.trim() || (nome === user?.nome && bio === savedBio)}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
