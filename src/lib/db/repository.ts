export type RepositoryResult<T> = Promise<T>;

export type TransactionRunner = {
  runInTransaction: <T>(operation: () => Promise<T>) => Promise<T>;
};
