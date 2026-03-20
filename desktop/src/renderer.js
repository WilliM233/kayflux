const stateStarting = document.getElementById('state-starting');
const stateRunning = document.getElementById('state-running');
const stateError = document.getElementById('state-error');
const btnOpen = document.getElementById('btn-open');
const btnRetry = document.getElementById('btn-retry');
const btnLogs = document.getElementById('btn-logs');
const portDisplay = document.getElementById('port-display');
const errorMessage = document.getElementById('error-message');

function showState(state) {
  stateStarting.classList.toggle('active', state === 'starting');
  stateRunning.classList.toggle('active', state === 'running');
  stateError.classList.toggle('active', state === 'error');
}

window.kayflux.onStatus((status) => {
  showState(status.state);

  if (status.state === 'running') {
    portDisplay.textContent = `localhost:${status.port}`;
  }

  if (status.state === 'error' && status.error) {
    errorMessage.textContent = status.error;
  }
});

btnOpen.addEventListener('click', () => {
  window.kayflux.openBrowser();
});

btnRetry.addEventListener('click', () => {
  showState('starting');
  window.kayflux.restartServer();
});

btnLogs.addEventListener('click', (e) => {
  e.preventDefault();
  window.kayflux.openLogs();
});
