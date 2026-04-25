"use strict";
const storage = new Map();
const impl = {
  async getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  async setItem(key, value) {
    storage.set(key, value);
  },
  async removeItem(key) {
    storage.delete(key);
  },
};
module.exports = { __esModule: true, default: impl };
