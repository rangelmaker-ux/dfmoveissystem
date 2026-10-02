!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "DF Móveis Planejados"
  !define MUI_WELCOMEPAGE_TEXT "Bem-vindo ao aplicativo interno da DF Móveis Planejados.$\r$\n$\r$\nGestão de clientes, projetos, orçamentos e vendas.$\r$\n$\r$\nO aplicativo utiliza internet para acessar os dados da loja e receber atualizações.$\r$\n$\r$\n© 2026 DF Móveis Planejados. Todos os direitos reservados."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Existing clients pass --updated even if their updater requests an assisted UI.
; Upgrade silently and launch again; first installation keeps the branded wizard.
!macro customInit
  ${if} ${isUpdated}
    SetSilent silent
    SetAutoClose true
  ${endIf}
!macroend
