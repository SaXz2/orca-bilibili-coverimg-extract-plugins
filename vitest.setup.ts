/**
 * Vitest 测试环境设置
 */

import { vi } from 'vitest';

// Mock global fetch
globalThis.fetch = vi.fn() as any;
