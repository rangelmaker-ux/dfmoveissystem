import type { QueryClient } from "@tanstack/react-query";
export function invalidateOperation(queryClient: QueryClient) {
  return Promise.all(
    [
      "meus-projetos",
      "projects",
      "commissions",
      "admin-stats",
      "projetista-stats",
      "designer-operation",
      "admin-operation",
      "distribution-projects",
      "clientes-global",
      "orcamento-clientes-projetos",
      "agendamentos",
    ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  );
}
