const status = document.querySelector('#status');
const check = document.querySelector('#check');
const install = document.querySelector('#install');
const retry = document.querySelector('#retry');
function render(state) {
  status.textContent = state.message;
  install.hidden = !state.update;
  retry.hidden = !state.offline;
  check.disabled = state.busy;
  install.disabled = state.busy;
  retry.disabled = state.busy;
}
async function run(action) { try { render(await action()); } catch { status.textContent = 'Não foi possível concluir. Tente novamente.'; } }
check.addEventListener('click', () => run(window.dfDesktop.check));
install.addEventListener('click', () => run(window.dfDesktop.install));
retry.addEventListener('click', () => run(window.dfDesktop.retry));
window.dfDesktop.subscribe(render);
void run(window.dfDesktop.state);
