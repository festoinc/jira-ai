class UI {
  private spinnerInstance: null = null;

  startSpinner(_message: string): null {
    return null;
  }

  stopSpinner(): void {}

  succeedSpinner(_message?: string): void {}

  failSpinner(_message?: string): void {}

  updateSpinner(_message: string): void {}

  get spinner(): null {
    return this.spinnerInstance;
  }
}

export const ui = new UI();
export default ui;
