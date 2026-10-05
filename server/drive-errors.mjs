// Only expose classified provider errors, never raw Google responses or tokens.
export function describeDriveError(status, body) {
  const error = body?.error || {};
  const reasons = [...(error.errors || []).map(item => item.reason), ...(error.details || []).map(item => item.reason)].filter(value => typeof value === 'string');
  if (reasons.some(reason => ['accessNotConfigured', 'SERVICE_DISABLED', 'serviceDisabled'].includes(reason)) || /has not been used|is disabled/i.test(String(error.message || ''))) {
    return 'A Google Drive API está desativada no projeto do Google. Abra https://console.cloud.google.com/apis/library/drive.googleapis.com?project=cinemakerpro e clique em Ativar. Depois volte ao sistema e conecte o Drive novamente.';
  }
  if (status === 401) return 'O acesso ao Google expirou. Volte ao sistema e conecte o Drive novamente.';
  if (reasons.includes('storageQuotaExceeded')) return 'O Google informou que o espaço desta conta do Drive acabou. Confira o armazenamento da conta rangelmaker@gmail.com.';
  if (status === 429 || reasons.some(reason => ['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded'].includes(reason))) return 'O Google limitou temporariamente as solicitações. Aguarde e tente novamente.';
  if (reasons.some(reason => ['insufficientPermissions', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'].includes(reason))) return 'O Google não concedeu a permissão necessária. Volte ao sistema, reconecte o Drive e autorize o acesso aos arquivos.';
  if (status === 404) return 'Arquivo ou pasta não encontrado no Drive. Os originais do Supabase foram preservados.';
  const reason = reasons.find(value => /^[a-zA-Z_]{1,80}$/.test(value));
  return `O Google recusou a operação (HTTP ${status}${reason ? `, ${reason}` : ''}). Envie essa mensagem para verificar a causa. Os originais foram preservados.`;
}
