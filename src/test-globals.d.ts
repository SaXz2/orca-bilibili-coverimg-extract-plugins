/**
 * 测试全局类型声明
 */

import type { ExpectStatic, describe, it, beforeEach, vi } from 'vitest';

declare global {
  const expect: ExpectStatic;
  const describe: typeof describe;
  const it: typeof it;
  const beforeEach: typeof beforeEach;
  const vi: typeof vi;
}
