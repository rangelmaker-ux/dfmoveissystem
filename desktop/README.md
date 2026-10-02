# DF Móveis Planejados para Windows

Instalador Windows 64 bits, por usuário, com atalho na área de trabalho e menu Iniciar. Requer internet e usa o sistema oficial https://dfmoveis-system.vercel.app, com a mesma aprovação do administrador.

## Compilar

Dentro de `desktop`: `npm ci`, `npm test`, `npm run dist:win`. O instalador aparece em `desktop/release`. Não inclua service role, tokens GitHub ou senhas no aplicativo.

## Atualizações

Cada build web gera `desktop-release.json` com o commit publicado. O aplicativo verifica na abertura e a cada cinco minutos; alterações de clientes ou dados no Supabase aparecem pelo fluxo normal do sistema e não exigem instalador. Ao instalar uma atualização web, limpa somente cache e service workers, preserva o login, reinicia e carrega a versão atual da Vercel. Na primeira abertura inicializa a versão, sem aviso falso.

Alterações no próprio aplicativo Windows precisam aumentar `desktop/package.json` (por exemplo, 1.0.0 → 1.0.1) e atualizar o lockfile. O workflow Windows compila e publica um GitHub Release público com o instalador, blockmap e latest.yml. O electron-updater usa esse canal para baixar o novo instalador somente depois do clique do usuário e reiniciar após a instalação. A primeira publicação alimenta o canal; atualizar sempre com uma versão maior. Nunca coloque um token GitHub no instalador. Se o repositório tornar-se privado no futuro, migrar o canal de atualização para um endpoint público dedicado antes de mudar a visibilidade.

O binário inicial não possui certificado Authenticode, pois nenhum certificado foi fornecido. O Windows pode pedir confirmação de execução. Assinar a distribuição definitiva com certificado da empresa e validar upgrade em um computador Windows antes da distribuição ampla.

## Verificação

Testes de origem, documentos, comparação e validação de versões; compilação NSIS e inspeção do executável e recursos. O teste de instalar, autenticar e atualizar na máquina real Windows deve ser feito pelo usuário. Criador: Rangel Marques. © 2026 DF Móveis Planejados.
