interface OfflineTransaction {
  id: string;
  timestamp: number;
  data: any;
  synced: boolean;
}

const STORAGE_KEY = 'offline_transactions';

export const offlineStorage = {
  save: (transaction: any): string => {
    const transactions = offlineStorage.getAll();
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const offlineTransaction: OfflineTransaction = {
      id,
      timestamp: Date.now(),
      data: transaction,
      synced: false,
    };

    transactions.push(offlineTransaction);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));

    return id;
  },

  getAll: (): OfflineTransaction[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  getUnsynced: (): OfflineTransaction[] => {
    return offlineStorage.getAll().filter(t => !t.synced);
  },

  markAsSynced: (id: string): void => {
    const transactions = offlineStorage.getAll();
    const updated = transactions.map(t =>
      t.id === id ? { ...t, synced: true } : t
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  remove: (id: string): void => {
    const transactions = offlineStorage.getAll();
    const filtered = transactions.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  clear: (): void => {
    localStorage.removeItem(STORAGE_KEY);
  },

  getPendingCount: (): number => {
    return offlineStorage.getUnsynced().length;
  },
};

export const syncOfflineTransactions = async (supabase: any): Promise<{ success: number; failed: number }> => {
  const unsynced = offlineStorage.getUnsynced();
  let success = 0;
  let failed = 0;

  for (const transaction of unsynced) {
    try {
      const { error } = await supabase
        .from('fuel_transactions')
        .insert(transaction.data);

      if (error) throw error;

      offlineStorage.markAsSynced(transaction.id);
      success++;
    } catch (error) {
      console.error('Failed to sync transaction:', error);
      failed++;
    }
  }

  const syncedTransactions = offlineStorage.getAll().filter(t => t.synced);
  syncedTransactions.forEach(t => offlineStorage.remove(t.id));

  return { success, failed };
};
