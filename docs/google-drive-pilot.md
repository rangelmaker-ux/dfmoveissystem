# Teste privado do Google Drive

Somente a conta oculta ativa `rangelmaker@gmail.com`, autenticada no Supabase com ID `44d949bf-2c99-47c8-bdb6-9038bfd3c713`, pode usar `/admin/drive`. Outros administradores e projetistas são recusados pelo servidor, mesmo com um link direto. O teste não altera a autenticação nem os arquivos das telas atuais.

## Configuração

1. Habilite a Google Drive API no projeto do cliente OAuth Web existente.
2. Na tela de consentimento, adicione `rangelmaker@gmail.com` como usuário de teste se o aplicativo estiver no modo Testing. Os escopos são `openid`, `email` e `https://www.googleapis.com/auth/drive.file`.
3. Cadastre como URI de redirecionamento autorizada exatamente `https://dfmoveis-system.vercel.app/api/drive-pilot?action=callback`. Se usar outro domínio, ajuste também `DRIVE_APP_ORIGIN`. O fluxo é de servidor, sem necessidade de chave secreta no navegador.
4. Configure na Vercel (Production, ou Preview com origem e URI próprias):
   - `SUPABASE_URL`: URL do projeto atual.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave secreta do servidor, nunca uma variável VITE.
   - `GOOGLE_DRIVE_CLIENT_ID`: `300891852451-ct06sf3u8thblmroka5etf5cni4odepm.apps.googleusercontent.com` (cliente Aplicativo da Web).
   - `GOOGLE_DRIVE_CLIENT_SECRET`: segredo do cliente OAuth, armazenado como variável sensível.
   - `DRIVE_APP_ORIGIN`: `https://dfmoveis-system.vercel.app` (ou o domínio efetivamente utilizado).
   - `DRIVE_ENCRYPTION_KEY`: chave aleatória de 32 bytes em base64, armazenada como variável sensível. Gere localmente com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Não publique a chave.
5. Aplique a migração `admin_google_drive_pilot` ao banco e publique a versão com a função `/api/drive-pilot`.
6. Entre com o administrador oculto e clique em **Drive — teste privado**, depois **Conectar Google Drive**. Selecione a mesma conta Gmail. O consentimento cria uma pasta privada dedicada.

Os refresh tokens são criptografados com AES-256-GCM antes de serem salvos. As duas novas tabelas têm RLS e nenhum acesso de anon/authenticated. Somente o servidor acessa os registros. O fluxo OAuth usa nonce em cookie HttpOnly, validade de 10 minutos e PKCE. O ID do arquivo é registrado antes da transferência. Um retry de cópia usa o mesmo ID; nenhum original é apagado.

## Cópia automática no envio normal

Enquanto o piloto estiver restrito a Rangel Maker, cada arquivo enviado por essa conta em Clientes ou Meus projetos é salvo primeiro no Supabase e depois copiado automaticamente para o Drive, sem escolher novamente o cliente. O projeto do próprio envio determina a pasta de destino. Outros usuários continuam com o fluxo atual até a liberação explícita.

O sistema mostra a confirmação da cópia ou informa que ficou pendente. A fila guarda apenas referências dos originais neste navegador, sem tokens ou conteúdo de arquivos. Cópias interrompidas são repetidas quando o administrador volta ao sistema nesse navegador, recupera a internet ou a cada minuto com o sistema aberto. Fechar o navegador pausa as tentativas; isso ainda não é um worker independente nem um backup completo do banco. Não apague originais enquanto uma cópia estiver pendente.

A autorização OAuth é uma conexão central com o Drive do proprietário no servidor. A expansão para funcionários deve reutilizar essa conexão e verificar o acesso ao projeto; não exige autorização Google individual nem compartilhamento público da pasta.

## Teste sem perda de dados

- Escolha um projeto com um arquivo pequeno no Supabase e clique em **Copiar para o Drive**.
- Confira o status **Verificado**, baixe a cópia e compare com o original. Confira também a pasta do Drive.
- Envie um arquivo novo por esta área. Ele fica no Drive e aparece exclusivamente nesta área de teste.
- Em caso de interrupção, uma cópia pode ser tentada novamente. Use **Verificar envio** para conferir uma transferência que terminou antes de a tela receber a confirmação.
- Entre com outro administrador/projetista e confirme que o menu não aparece e a API recusa acesso.
- Os arquivos antigos continuam sendo usados pelas telas atuais. A migração geral e exclusão de originais não fazem parte deste teste.

## Limites e recuperação

O piloto limita arquivos a 100 MB e lista cópias por projeto. O upload vai diretamente do navegador ao Drive por uma sessão resumível específica; o refresh token não sai do servidor. O download passa pela função da Vercel e consome sua transferência. Credenciais revogadas, falta de espaço, arquivos alterados ou removidos no Drive produzem erro sem apagar originais.

Uma cópia já verificada não é atualizada silenciosamente se o original for substituído. O piloto faz cópias automáticas dos novos arquivos de projetos enviados pela conta oculta e permite cópias manuais dos arquivos antigos. Não é um backup completo do banco nem um sincronizador de versões. Fotos de perfil não fazem parte do piloto de arquivos de projetos. A extensão para rotinas independentes e os projetistas depende do resultado deste teste.

No modo Testing do OAuth, refresh tokens de escopos Drive podem expirar após sete dias: reconecte para continuar o piloto. Para uso contínuo, configure a publicação do consentimento conforme os requisitos do Google. Ao trocar `DRIVE_ENCRYPTION_KEY`, as conexões existentes precisarão ser reautorizadas; preserve a chave e mantenha uma cópia segura.

Para desativar, remova as credenciais GOOGLE_DRIVE da Vercel e publique novamente. Preserve as tabelas e a pasta do Drive; não apague originais. Revogue o acesso em sua Conta Google se desejar interromper a autorização. Nenhuma alteração no banco existente precisa ser revertida.

Documentação: https://developers.google.com/identity/protocols/oauth2/web-server e https://developers.google.com/workspace/drive/api/guides/manage-uploads

