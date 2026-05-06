/**
 * React Query key 工厂，保证画布 / 侧栏等消费同一缓存、invalidate 一次全部联动更新。
 */
export const queryKeys = {
  assets: {
    /** 单工程资产列表（条数由 queryFn 决定，勿写入 key） */
    list: (projectPath: string) => ["assets", projectPath] as const,
  },
} as const;
