export const calculusClipboardService = {
  copy(text: string): void {
    void navigator.clipboard.writeText(text);
  },
};
