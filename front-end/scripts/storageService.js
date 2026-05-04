const StorageService = (() => {
  'use strict';

  // Memory-only store for firms and other non-persisted entities
  const _memoryStore = {
    users: [],
    lexflow_law_firms: []
  };

  function _read(key) {
    if (key === 'lawFirms') key = 'lexflow_law_firms';
    return _memoryStore[key] || [];
  }

  function _write(key, arr) {
    if (key === 'lawFirms') key = 'lexflow_law_firms';
    _memoryStore[key] = arr;
  }

  return {
    getAll(key) {
      return _read(key);
    },

    getById(key, id) {
      return _read(key).find(item => String(item.id) === String(id));
    },

    create(key, data) {
      const collection = _read(key);
      const record = {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        ...data
      };
      collection.push(record);
      _write(key, collection);
      return record;
    },

    update(key, id, newData) {
      const collection = _read(key);
      const idx = collection.findIndex(item => String(item.id) === String(id));
      if (idx === -1) return null;

      collection[idx] = { ...collection[idx], ...newData };
      _write(key, collection);
      return collection[idx];
    },

    remove(key, id) {
      const collection = _read(key);
      const filtered = collection.filter(item => String(item.id) !== String(id));
      if (filtered.length === collection.length) return false;

      _write(key, filtered);
      return true;
    },

    async seed(jsonPath) {
      // No-op: Data folder removed, backend is the source of truth
      console.log('[StorageService] Seeding disabled. Data folder removed.');
      return Promise.resolve();
    }
  };
})();
