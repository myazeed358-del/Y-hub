const KEY = 'yhub_password_recovery';

export const recoveryLinkStorage = {
  remember() {
    sessionStorage.setItem(KEY, '1');
  },

  wasVisited(): boolean {
    return sessionStorage.getItem(KEY) === '1';
  },

  clear() {
    sessionStorage.removeItem(KEY);
  },
};
