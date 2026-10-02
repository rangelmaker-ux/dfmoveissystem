const status = document.querySelector('#status');
const updateBar = document.querySelector('#update-bar');
const install = document.querySelector('#install');
const retry = document.querySelector('#retry');
const title = document.querySelector('#loading-title');
const message = document.querySelector('#loading-message');
function render(state) {
  updateBar.hidden = !state.update && !state.busy;
  status.textContent = state.message;
  install.disabled = state.busy;
  install.textContent = state.busy ? 'Instalando…' : 'Instalar atualizações';
  retry.hidden = !state.loadFailed;
  retry.disabled = state.busy;
  title.textContent = state.loadFailed ? 'Não foi possível abrir o sistema' : 'Conectando ao sistema…';
  message.textContent = state.loadFailed ? 'Verifique sua conexão com a internet e tente novamente.' : 'Aguarde enquanto abrimos sua área de trabalho.';
}
async function run(action) { try { render(await action()); } catch { message.textContent = 'Não foi possível concluir. Tente novamente.'; } }
install.addEventListener('click', () => run(window.dfDesktop.install));
retry.addEventListener('click', () => run(window.dfDesktop.retry));
window.dfDesktop.subscribe(render);
void run(window.dfDesktop.state);
