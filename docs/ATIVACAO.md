# Ativação da atualização

A checagem do Supabase real confirmou que o site usa o projeto `rcwilkmovlrdxhfviemo`. Foram encontrados campos e tabelas ausentes, uma estrutura legada diferente para `orcamento_budgets` e um administrador já existente no Auth com o mesmo ID do perfil. A atualização inclui compatibilidade para esses casos: preserva a tabela legada como cópia administrativa, importa seus registros, vincula a identidade já existente e substitui o trigger antigo de cadastro. O banco de produção não foi alterado durante essa conferência.

O preview inicial no Vercel foi bloqueado por `BLOCKED_PACKAGE`. O TanStack Start foi atualizado para `1.168.60`, com `start-server-core 1.169.39`, versões corrigidas do aviso GHSA-qx66-fv34-fjm8. Não usar a variável de bypass do bloqueio.

Esta versão altera autenticação e regras do banco. Não publique somente o frontend novo sobre o banco antigo.

## Ordem de ativação

1. Gerar backup do banco e testar a atualização em um projeto de homologação. As migrations antigas não documentam todas as alterações históricas feitas manualmente no banco; comparar o esquema real antes da aplicação. Verificar se já existem contas em Auth com os e-mails legados e comissões duplicadas por projeto. Resolver os conflitos antes de iniciar, sem apagar histórico.
2. Aplicar as três migrations `20261002010000`, `20261002011000` e `20261002012000` com o aplicativo em manutenção. A primeira revoga o acesso anônimo, cria o vínculo de Auth e mantém as regras de aprovação. Os orçamentos legados em `orcamento_workspace.saved_budgets` ficam preservados como cópia de recuperação e são importados em registros individuais.
3. Executar `npm run migrate:auth` em ambiente administrativo com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Não colocar a chave administrativa em variáveis `VITE_*`, no navegador, no repositório ou no chat. O script usa a API oficial de criação de usuários, mantém IDs de perfil, roles e status, e apaga a senha legada ao vincular a conta ao Auth. Se houver conta sem credencial legada, migrar pelo procedimento administrativo de recuperação antes de publicar. Não habilitar acesso por localStorage como fallback.
4. Publicar a função `team-auth` no Supabase. A função valida o token, papel e status da conta administradora e confirma a senha antes de criar ou bloquear uma conta. Cadastro comum usa Supabase Auth e continua PENDENTE até o administrador liberar. Configurar confirmação de e-mail conforme a política interna e SMTP para recuperação de senha. Adicionar a URL de `/redefinir-senha` à lista de redirects do Auth.
5. Publicar esta branch no Vercel, com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. O build usa `npm ci` e `package-lock.json`; não instalar com um lockfile de outro gerenciador.
6. Testar login do administrador migrado, cadastro/aprovação de projetista, bloqueio, orçamento salvo em outro dispositivo, catálogo simultâneo, proposta/contrato por cliente, anexos privados, comissão e agenda. Somente então encerrar manutenção.

Migrations de segurança e migração de credenciais devem ocorrer em manutenção: entre a revogação das políticas antigas e a publicação do frontend, a versão antiga não deve continuar operando.

## Comportamento da atualização

- Administrador continua autorizando cadastros; papel e status passam a ser verificados por sessão no banco.
- Bloquear/remover acesso preserva clientes, projetos, comissões e documentos. O usuário pode ser reativado pela equipe administrativa. Não há exclusão em cascata de histórico financeiro.
- Catálogo é compartilhado em tabela única com versão; rascunho pertence ao usuário. Orçamento/proposta/contrato são registros independentes com conflito de versão explícito.
- Não são importados automaticamente orçamentos anônimos de outro usuário guardados no mesmo navegador. Cópia nova de recuperação é separada por conta.
- Clientes ganha o botão Orçamentos / Contratos. A calculadora exporta documento interno; proposta ao cliente imprime apenas descritivos e valores dos ambientes.
- Contrato exige proposta fechada. Permite selecionar ambientes ou marcar todos; cláusulas e dados de assinatura são editáveis. Assinatura no PDF é um campo para assinatura, não certificação digital.
- Custos adicionais são internos. A edição de custo adicional ajusta o valor de venda do ambiente pelo delta do custo; o operador pode negociar o valor final. Margem extra específica deve ser refletida nesse valor.
- No fechamento financeiro, parcelas são calculadas automaticamente com distribuição dos centavos; não se digita um valor de parcela independente do saldo. A comissão é sincronizada na mesma transação e não duplica em atualizações.
- Agenda reserva reuniões em horário exclusivo da loja e respeita bloqueios também na aprovação de mudança.

## Verificação

Validação local: 49 testes aprovados; TypeScript sem erros; lint sem erros (6 avisos já existentes em componentes de UI); build de produção concluído.

A verificação visual automatizada não foi concluída: o download do Chromium neste ambiente retornou arquivos inválidos. Conferir a interface no navegador em homologação, inclusive em celular, antes de ativar produção.

Os testes de banco usam PostgreSQL embarcado com schemas Auth/Storage simulados. Não substituem o teste no Supabase real nem simulam entrega de e-mail ou a API GoTrue. A extensão btree_gist não é carregada no PostgreSQL embarcado; as constraints de intervalo usam a GiST de ranges do PostgreSQL core.

A regra comercial fixa de conversão de chapas e os preços finais importados do Promob foram preservados. A equivalência exata com o sistema legado ainda exige comparação com os PDFs/listas reais e validação comercial da loja. Não foram inventadas novas tabelas de preço, margem, prazo ou garantia.

## Próxima etapa, somente depois da aprovação do usuário

Avaliar proteção contra cópia e mudanças no repositório, visibilidade, acesso de colaboradores e regras de branch/deploy. Rangel pediu que essa etapa fique para depois que ele testar e disser que a versão está legal. Nenhuma alteração de visibilidade ou acesso ao GitHub faz parte desta atualização.
