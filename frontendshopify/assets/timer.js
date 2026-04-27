/**
 * SessionTimer — AstroJap
 *
 * Usage:
 *   const timer = new SessionTimer(remainingSeconds, onEndCallback);
 *   timer.start();
 *
 * NOTE: remainingSeconds should always come from the backend's
 * /api/sessions/validate-session response (remaining_seconds),
 * NOT from a URL parameter — this prevents client-side manipulation.
 */
class SessionTimer {
  constructor(durationSeconds, onEnd) {
    // Guard against null / NaN — treat as 0 so onEnd fires immediately
    this.remaining      = (Number.isFinite(durationSeconds) && durationSeconds > 0)
      ? Math.floor(durationSeconds)
      : 0;
    this.onEnd          = onEnd;
    this.interval       = null;
    this.displayElement = document.getElementById('chat-timer-display');
    this.warnElement    = document.getElementById('timer-warning');
  }

  start() {
    // If time is already up, call onEnd immediately
    if (this.remaining <= 0) {
      this.updateDisplay();
      if (this.onEnd) this.onEnd();
      return;
    }

    this.updateDisplay();

    this.interval = setInterval(() => {
      this.remaining--;
      this.updateDisplay();

      // 5-minute warning
      if (this.remaining === 300) {
        this._showWarning('⚠️ 5 minutes remaining!');
      }

      // 1-minute critical warning
      if (this.remaining === 60) {
        this._showWarning('🔴 1 minute remaining!');
      }

      if (this.remaining <= 0) {
        this.stop();
        if (this.onEnd) this.onEnd();
      }
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  updateDisplay() {
    if (!this.displayElement) return;
    const mins = Math.floor(this.remaining / 60);
    const secs = this.remaining % 60;
    this.displayElement.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  _showWarning(message) {
    if (this.warnElement) {
      this.warnElement.textContent = message;
      this.warnElement.style.display = 'block';
    }
  }
}

window.SessionTimer = SessionTimer;
