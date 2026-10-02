const retry = document.querySelector('#retry');
const title = document.querySelector('#loading-title');
const message = document.querySelector('#loading-message');
const progress = document.querySelector('#loading-progress');
function render(state) {
  retry.hidden = !state.loadFailed;
  retry.disabled = state.busy;
  title.textContent = state.loadFailed ? 'Não foi possível abrir o sistema' : state.message;
  message.textContent = state.loadFailed ? 'Verifique sua conexão com a internet e tente novamente.' : 'Aguarde enquanto abrimos sua área de trabalho.';
  progress.hidden = state.loadFailed;
  if (Number.isFinite(state.progress)) progress.value = Math.max(0, Math.min(100, state.progress));
  else progress.removeAttribute('value');
}
async function run(action) { try { render(await action()); } catch { message.textContent = 'Não foi possível concluir. Tente novamente.'; } }
retry.addEventListener('click', () => run(window.dfDesktop.retry));
window.dfDesktop.subscribe(render);
void run(window.dfDesktop.state);
