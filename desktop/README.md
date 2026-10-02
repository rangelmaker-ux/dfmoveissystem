# DF Móveis Planejados para Windows

Instalador Windows 64 bits, por usuário, com atalho na área de trabalho e menu Iniciar. Requer internet e usa o sistema oficial https://dfmoveis-system.vercel.app, com a mesma aprovação do administrador.

## Compilar

Dentro de `desktop`: `npm ci`, `npm test`, `npm run dist:win`. O instalador aparece em `desktop/release`. Não inclua service role, tokens GitHub ou senhas no aplicativo.

## Atualizações

As atualizações são verificadas somente ao abrir o aplicativo. Havendo uma nova versão, a tela inicial mostra “Atualizando…” e uma barra de progresso. Atualizações do sistema web limpam somente cache e service workers, preservando login e dados locais, antes de abrir a versão atual. Atualizações nativas são baixadas e instaladas silenciosamente, reiniciando o aplicativo automaticamente. Não há avisos, botões ou verificações periódicas durante o trabalho. Se o canal de atualização estiver indisponível, o sistema tenta abrir com a versão instalada e verifica novamente na próxima abertura.

Alterações no aplicativo Windows aumentam a versão de `desktop/package.json` e do lockfile. O workflow Windows compila, verifica e publica o canal nativo no armazenamento do Supabase, acessível por `/desktop-native/` no site. Nenhum instalador é publicado no Git ou em GitHub Releases. Nunca coloque tokens no instalador.

O binário inicial não possui certificado Authenticode, pois nenhum certificado foi fornecido. O Windows pode pedir confirmação de execução. Assinar a distribuição definitiva com certificado da empresa e validar upgrade em um computador Windows antes da distribuição ampla.

## Verificação

Testes de origem, documentos, comparação e validação de versões; compilação NSIS e inspeção do executável e recursos. O teste de instalar, autenticar e atualizar na máquina real Windows deve ser feito pelo usuário. Criador: Rangel Marques. © 2026 DF Móveis Planejados.

## Login e atualizações

A animação aprovada dura 2 segundos, sem som, e pertence ao sistema web: aparece depois de validar as credenciais e a aprovação do administrador, antes do painel. Não aparece ao abrir o executável nem ao restaurar uma sessão.

O sistema ocupa toda a janela, sem faixa superior. Se a página não carregar, a tela de recuperação oferece tentar novamente.
