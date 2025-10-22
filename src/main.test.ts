/**
 * 视频信息提取插件单元测试
 */

import {
  extractVideoId,
  hasBilibiliLink,
  extractBilibiliUrl,
  getVideoInfo,
  getVideoTags,
  getCompleteVideoInfo
} from './bilibili';

import {
  extractYouTubeVideoId,
  hasYouTubeLink,
  extractYouTubeUrl,
  getYouTubeVideoInfo
} from './youtube';

import {
  detectVideoPlatform,
  hasVideoLink
} from './video-processor';

// ==================== 工具函数测试 ====================

describe('extractVideoId', () => {
  it('应该从BV号URL中提取视频ID', () => {
    const url = 'https://www.bilibili.com/video/BV1xx411c7XD';
    expect(extractVideoId(url)).toBe('BV1xx411c7XD');
  });

  it('应该从av号URL中提取视频ID', () => {
    const url = 'https://www.bilibili.com/video/av12345';
    expect(extractVideoId(url)).toBe('av12345');
  });

  it('应该从不带www的URL中提取视频ID', () => {
    const url = 'https://bilibili.com/video/BV1xx411c7XD';
    expect(extractVideoId(url)).toBe('BV1xx411c7XD');
  });

  it('应该从http协议URL中提取视频ID', () => {
    const url = 'http://www.bilibili.com/video/BV1xx411c7XD';
    expect(extractVideoId(url)).toBe('BV1xx411c7XD');
  });

  it('无效URL应该返回null', () => {
    expect(extractVideoId('https://example.com')).toBe(null);
    expect(extractVideoId('not a url')).toBe(null);
    expect(extractVideoId('')).toBe(null);
  });
});

describe('hasBilibiliLink', () => {
  it('应该检测到链接fragment中的B站链接', () => {
    const block = {
      id: 1,
      content: [
        { t: 'l', l: 'https://www.bilibili.com/video/BV1xx411c7XD', v: '视频' }
      ]
    };
    expect(hasBilibiliLink(block)).toBe(true);
  });

  it('应该检测到文本中的B站链接', () => {
    const block = {
      id: 1,
      content: [
        { t: 't', v: '看看这个视频 https://www.bilibili.com/video/BV1xx411c7XD' }
      ]
    };
    expect(hasBilibiliLink(block)).toBe(true);
  });

  it('没有内容的块应该返回false', () => {
    const block1 = { id: 1 };
    const block2 = { id: 2, content: [] };
    expect(hasBilibiliLink(block1 as any)).toBe(false);
    expect(hasBilibiliLink(block2)).toBe(false);
  });

  it('没有B站链接的块应该返回false', () => {
    const block = {
      id: 1,
      content: [
        { t: 't', v: 'https://www.youtube.com/watch?v=123' }
      ]
    };
    expect(hasBilibiliLink(block)).toBe(false);
  });
});

describe('extractBilibiliUrl', () => {
  it('应该从链接fragment中提取URL', () => {
    const block = {
      id: 1,
      content: [
        { t: 'l', l: 'https://www.bilibili.com/video/BV1xx411c7XD', v: '视频' }
      ]
    };
    expect(extractBilibiliUrl(block)).toBe('https://www.bilibili.com/video/BV1xx411c7XD');
  });

  it('应该从文本中提取URL', () => {
    const block = {
      id: 1,
      content: [
        { t: 't', v: '链接：https://www.bilibili.com/video/BV1xx411c7XD 很好' }
      ]
    };
    expect(extractBilibiliUrl(block)).toBe('https://www.bilibili.com/video/BV1xx411c7XD');
  });

  it('优先从链接fragment提取', () => {
    const block = {
      id: 1,
      content: [
        { t: 'l', l: 'https://www.bilibili.com/video/BV1111111111', v: '视频1' },
        { t: 't', v: 'https://www.bilibili.com/video/BV2222222222' }
      ]
    };
    expect(extractBilibiliUrl(block)).toBe('https://www.bilibili.com/video/BV1111111111');
  });

  it('无链接应该返回null', () => {
    const block1 = { id: 1 };
    const block2 = { id: 2, content: [] };
    const block3 = { id: 3, content: [{ t: 't', v: 'no link' }] };
    expect(extractBilibiliUrl(block1 as any)).toBe(null);
    expect(extractBilibiliUrl(block2)).toBe(null);
    expect(extractBilibiliUrl(block3)).toBe(null);
  });
});

// ==================== API 调用测试 ====================

describe('getVideoInfo', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应该成功获取视频信息', async () => {
    const mockResponse = {
      code: 0,
      data: {
        pic: 'https://example.com/cover.jpg',
        title: '测试视频',
        owner: { name: '测试UP主' },
        pubdate: 1640995200 // 2022-01-01 的时间戳
      }
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    }) as any;

    const result = await getVideoInfo('BV1xx411c7XD');
    
    expect(result).toEqual({
      coverUrl: 'https://example.com/cover.jpg',
      title: '测试视频',
      upName: '测试UP主',
      tags: [],
      publishDate: '2022-01-01'
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.bilibili.com/x/web-interface/view?bvid=BV1xx411c7XD',
      expect.objectContaining({
        headers: expect.any(Object)
      })
    );
  });

  it('应该处理API返回错误', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false
    }) as any;

    const result = await getVideoInfo('BV1xx411c7XD');
    
    expect(result).toEqual({
      coverUrl: null,
      upName: null,
      title: null,
      tags: [],
      publishDate: null
    });
  });

  it('应该处理网络错误', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    const result = await getVideoInfo('BV1xx411c7XD');
    
    expect(result).toEqual({
      coverUrl: null,
      upName: null,
      title: null,
      tags: [],
      publishDate: null
    });
  });

  it('应该处理缺失字段', async () => {
    const mockResponse = {
      code: 0,
      data: {
        // pic 缺失
        title: '测试视频'
        // owner 缺失
      }
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    }) as any;

    const result = await getVideoInfo('BV1xx411c7XD');
    
    expect(result).toEqual({
      coverUrl: null,
      title: '测试视频',
      upName: null,
      tags: [],
      publishDate: null
    });
  });

  it('应该正确解析发布日期', async () => {
    const mockResponse = {
      code: 0,
      data: {
        pic: 'https://example.com/cover.jpg',
        title: '测试视频',
        owner: { name: '测试UP主' },
        pubdate: 1609459200 // 2021-01-01 的时间戳
      }
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    }) as any;

    const result = await getVideoInfo('BV1xx411c7XD');
    
    expect(result.publishDate).toBe('2021-01-01');
  });
});

describe('getVideoTags', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应该成功获取视频标签', async () => {
    const mockResponse = {
      code: 0,
      data: [
        { tag_name: '东方' },
        { tag_name: 'PV' },
        { tag_name: 'IOSYS' }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    }) as any;

    const result = await getVideoTags('BV1xx411c7XD');
    
    expect(result).toEqual(['东方', 'PV', 'IOSYS']);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.bilibili.com/x/tag/archive/tags?bvid=BV1xx411c7XD',
      expect.objectContaining({
        headers: expect.any(Object)
      })
    );
  });

  it('应该过滤空标签', async () => {
    const mockResponse = {
      code: 0,
      data: [
        { tag_name: '东方' },
        { tag_name: '' },
        { tag_name: '  ' },
        { tag_name: 'PV' }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    }) as any;

    const result = await getVideoTags('BV1xx411c7XD');
    
    expect(result).toEqual(['东方', 'PV']);
  });

  it('应该处理空标签列表', async () => {
    const mockResponse = {
      code: 0,
      data: []
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    }) as any;

    const result = await getVideoTags('BV1xx411c7XD');
    
    expect(result).toEqual([]);
  });

  it('应该处理API错误', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false
    }) as any;

    const result = await getVideoTags('BV1xx411c7XD');
    
    expect(result).toEqual([]);
  });

  it('应该处理网络错误', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    const result = await getVideoTags('BV1xx411c7XD');
    
    expect(result).toEqual([]);
  });
});

describe('getCompleteVideoInfo', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应该并行获取视频信息和标签', async () => {
    const mockInfoResponse = {
      code: 0,
      data: {
        pic: 'https://example.com/cover.jpg',
        title: '测试视频',
        owner: { name: '测试UP主' },
        pubdate: 1640995200 // 2022-01-01 的时间戳
      }
    };

    const mockTagsResponse = {
      code: 0,
      data: [
        { tag_name: '东方' },
        { tag_name: 'PV' }
      ]
    };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockInfoResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTagsResponse
      }) as any;

    const result = await getCompleteVideoInfo('BV1xx411c7XD');
    
    expect(result).toEqual({
      coverUrl: 'https://example.com/cover.jpg',
      title: '测试视频',
      upName: '测试UP主',
      tags: ['东方', 'PV'],
      publishDate: '2022-01-01'
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('应该处理部分失败的情况', async () => {
    const mockInfoResponse = {
      code: 0,
      data: {
        pic: 'https://example.com/cover.jpg',
        title: '测试视频',
        owner: { name: '测试UP主' },
        pubdate: 1640995200 // 2022-01-01 的时间戳
      }
    };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockInfoResponse
      })
      .mockResolvedValueOnce({
        ok: false
      }) as any;

    const result = await getCompleteVideoInfo('BV1xx411c7XD');
    
    expect(result).toEqual({
      coverUrl: 'https://example.com/cover.jpg',
      title: '测试视频',
      upName: '测试UP主',
      tags: [],
      publishDate: '2022-01-01'
    });
  });
});

// ==================== YouTube 功能测试 ====================

describe('extractYouTubeVideoId', () => {
  it('应该从标准YouTube URL中提取视频ID', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it('应该从短链接中提取视频ID', () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it('应该从YouTube Shorts链接中提取视频ID', () => {
    const url = 'https://www.youtube.com/shorts/_Ex--OvqMok';
    expect(extractYouTubeVideoId(url)).toBe('_Ex--OvqMok');
  });

  it('应该从嵌入链接中提取视频ID', () => {
    const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it('无效URL应该返回null', () => {
    expect(extractYouTubeVideoId('https://example.com')).toBe(null);
    expect(extractYouTubeVideoId('not a url')).toBe(null);
  });
});

describe('hasYouTubeLink', () => {
  it('应该检测到链接fragment中的YouTube链接', () => {
    const block = {
      id: 1,
      content: [
        { t: 'l', l: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', v: '视频' }
      ]
    };
    expect(hasYouTubeLink(block)).toBe(true);
  });

  it('应该检测到文本中的YouTube链接', () => {
    const block = {
      id: 1,
      content: [
        { t: 't', v: 'https://youtu.be/dQw4w9WgXcQ' }
      ]
    };
    expect(hasYouTubeLink(block)).toBe(true);
  });

  it('应该检测到YouTube Shorts链接', () => {
    const block = {
      id: 1,
      content: [
        { t: 't', v: 'https://www.youtube.com/shorts/_Ex--OvqMok' }
      ]
    };
    expect(hasYouTubeLink(block)).toBe(true);
  });

  it('没有YouTube链接的块应该返回false', () => {
    const block = {
      id: 1,
      content: [
        { t: 't', v: 'https://www.bilibili.com/video/BV1xx411c7XD' }
      ]
    };
    expect(hasYouTubeLink(block)).toBe(false);
  });
});

describe('extractYouTubeUrl', () => {
  it('应该从链接fragment中提取URL', () => {
    const block = {
      id: 1,
      content: [
        { t: 'l', l: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', v: '视频' }
      ]
    };
    expect(extractYouTubeUrl(block)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('应该从文本中提取URL', () => {
    const block = {
      id: 1,
      content: [
        { t: 't', v: 'https://youtu.be/dQw4w9WgXcQ' }
      ]
    };
    expect(extractYouTubeUrl(block)).toBe('https://youtu.be/dQw4w9WgXcQ');
  });

  it('没有YouTube链接的块应该返回null', () => {
    const block = {
      id: 1,
      content: [
        { t: 't', v: '普通文本' }
      ]
    };
    expect(extractYouTubeUrl(block)).toBe(null);
  });
});

describe('getYouTubeVideoInfo', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该成功获取YouTube视频信息（oEmbed模式）', async () => {
    const mockResponse = {
      author_name: '测试频道',
      thumbnail_url: 'https://example.com/thumb.jpg',
      html: '<iframe src="..."></iframe>'
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await getYouTubeVideoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    
    expect(result).toEqual({
      author: '测试频道',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      html: '<iframe src="..."></iframe>',
      publishDate: expect.any(String),
      tags: []
    });
  });

  it('应该成功获取YouTube视频信息（Data API模式）', async () => {
    const mockResponse = {
      items: [{
        snippet: {
          title: '测试视频标题',
          channelTitle: '测试频道',
          publishedAt: '2023-01-01T00:00:00Z',
          tags: ['测试', '视频', '标签'],
          thumbnails: {
            high: { url: 'https://example.com/high.jpg' },
            medium: { url: 'https://example.com/medium.jpg' },
            default: { url: 'https://example.com/default.jpg' }
          }
        }
      }]
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await getYouTubeVideoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'test-api-key');
    
    expect(result).toEqual({
      author: '测试频道',
      thumbnailUrl: 'https://example.com/high.jpg',
      html: null,
      publishDate: '2023-01-01',
      tags: ['测试', '视频', '标签']
    });
  });

  it('API失败时应该返回空信息', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false
    });

    const result = await getYouTubeVideoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    
    expect(result).toEqual({
      author: null,
      thumbnailUrl: null,
      html: null,
      publishDate: expect.any(String), // 现在返回当前日期字符串
      tags: []
    });
  });
});

// ==================== 统一处理器测试 ====================

describe('detectVideoPlatform', () => {
  it('应该检测到哔哩哔哩链接', () => {
    const block = {
      id: 1,
      content: [
        { t: 'l', l: 'https://www.bilibili.com/video/BV1xx411c7XD', v: '视频' }
      ]
    };
    expect(detectVideoPlatform(block)).toBe('bilibili');
  });

  it('应该检测到YouTube链接', () => {
    const block = {
      id: 1,
      content: [
        { t: 'l', l: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', v: '视频' }
      ]
    };
    expect(detectVideoPlatform(block)).toBe('youtube');
  });

  it('没有视频链接的块应该返回null', () => {
    const block = {
      id: 1,
      content: [
        { t: 't', v: '普通文本' }
      ]
    };
    expect(detectVideoPlatform(block)).toBe(null);
  });
});

describe('hasVideoLink', () => {
  it('应该检测到哔哩哔哩链接', () => {
    const block = {
      id: 1,
      content: [
        { t: 'l', l: 'https://www.bilibili.com/video/BV1xx411c7XD', v: '视频' }
      ]
    };
    expect(hasVideoLink(block)).toBe(true);
  });

  it('应该检测到YouTube链接', () => {
    const block = {
      id: 1,
      content: [
        { t: 'l', l: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', v: '视频' }
      ]
    };
    expect(hasVideoLink(block)).toBe(true);
  });

  it('没有视频链接的块应该返回false', () => {
    const block = {
      id: 1,
      content: [
        { t: 't', v: '普通文本' }
      ]
    };
    expect(hasVideoLink(block)).toBe(false);
  });
});
