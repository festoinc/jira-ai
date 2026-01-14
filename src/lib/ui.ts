import ora, { Ora } from 'ora';

class UI {
  private spinnerInstance: Ora | null = null;

  startSpinner(message: string): Ora {
    if (this.spinnerInstance) {
      this.spinnerInstance.stop();
    }
    this.spinnerInstance = ora(message).start();
    return this.spinnerInstance;
  }

  stopSpinner(): void {
    if (this.spinnerInstance) {
      this.spinnerInstance.stop();
      this.spinnerInstance = null;
    }
  }

  succeedSpinner(message?: string): void {
    if (this.spinnerInstance) {
      this.spinnerInstance.succeed(message);
      this.spinnerInstance = null;
    }
  }

  failSpinner(message?: string): void {
    if (this.spinnerInstance) {
      this.spinnerInstance.fail(message);
      this.spinnerInstance = null;
    }
  }

  updateSpinner(message: string): void {
    if (this.spinnerInstance) {
      this.spinnerInstance.text = message;
    }
  }

  get spinner(): Ora | null {
    return this.spinnerInstance;
  }
}

export const ui = new UI();
export default ui;
