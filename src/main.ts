/**
 * 哔哩哔哩封面提取插件
 * 自动检测哔哩哔哩链接并提取封面图片、UP主信息等
 */

// B站链接正则
const BILIBILI_URL_REGEX = /https?:\/\/(?:www\.)?bilibili\.com\/video\/(?:BV|av)\w+/i;

// 网络请求配置
const NETWORK_CONFIG = {
  timeout: 10000, // 10秒超时
  retryAttempts: 3, // 重试3次
  retryDelay: 1000, // 重试延迟1秒
};

// 缓存配置
const CACHE_CONFIG = {
  maxSize: 100, // 最大缓存条目数
  ttl: 30 * 60 * 1000, // 缓存30分钟
};

// 延迟配置
const DELAY_CONFIG = {
  imageProcessing: 500, // 图片处理延迟
  bilibiliProcessing: 1000, // B站链接处理延迟
  debounceDelay: 300, // 防抖延迟
};

// 内存缓存
const cache = new Map<string, { data: VideoInfo; timestamp: number }>();

// 基础接口
interface Block {
  id: number;
  content?: Array<{
    t: string;
    v?: string;
    l?: string;
  }>;
}

// 提取视频ID
function extractVideoId(url: string): string | null {
  const match = url.match(/\/video\/(BV\w+|av\d+)/i);
  return match ? match[1] : null;
}

// 检查块是否包含B站链接
function hasBilibiliLink(block: Block): boolean {
  if (!block?.content) return false;
  
  for (const fragment of block.content) {
    if (fragment.t === 'l' && fragment.l && BILIBILI_URL_REGEX.test(fragment.l)) {
      return true;
    }
  }
  
  const text = block.content.map(f => f.v || '').join('');
  return BILIBILI_URL_REGEX.test(text);
}

// 视频信息接口
interface VideoInfo {
  coverUrl: string | null;
  upName: string | null;
  title: string | null;
}

// 带重试的网络请求
async function fetchWithRetry(url: string, options: RequestInit, retries = NETWORK_CONFIG.retryAttempts): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), NETWORK_CONFIG.timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      console.log(`网络请求失败 (尝试 ${i + 1}/${retries}):`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, NETWORK_CONFIG.retryDelay));
    }
  }
  throw new Error('网络请求失败');
}

// 检查缓存
function getCachedVideoInfo(videoId: string): VideoInfo | null {
  const cached = cache.get(videoId);
  if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.ttl) {
    console.log('使用缓存数据:', videoId);
    return cached.data;
  }
  return null;
}

// 设置缓存
function setCachedVideoInfo(videoId: string, data: VideoInfo): void {
  // 清理过期缓存
  if (cache.size >= CACHE_CONFIG.maxSize) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  
  cache.set(videoId, { data, timestamp: Date.now() });
}

// 获取视频信息（封面、UP主名称、标题）
async function getVideoInfo(videoId: string): Promise<VideoInfo> {
  // 检查缓存
  const cached = getCachedVideoInfo(videoId);
  if (cached) return cached;
  
  try {
    console.log('从网络获取视频信息:', videoId);
    
    const response = await fetchWithRetry(`https://api.bilibili.com/x/web-interface/view?bvid=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com/'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (data.code === 0 && data.data) {
      const videoInfo = {
        coverUrl: data.data.pic || null,
        upName: data.data.owner?.name || null,
        title: data.data.title || null
      };
      
      // 缓存结果
      setCachedVideoInfo(videoId, videoInfo);
      
      console.log('成功获取视频信息:', videoInfo);
      return videoInfo;
    }
    
    throw new Error('API返回错误');
  } catch (error) {
    console.error('获取哔哩哔哩视频信息失败:', error);
    return { coverUrl: null, upName: null, title: null };
  }
}

// 检查是否已存在相同的封面图片
function hasExistingCover(block: Block, coverUrl: string): boolean {
  if (!block?.content) return false;
  
  for (const fragment of block.content) {
    if (fragment.t === 'image' && fragment.src === coverUrl) {
      return true;
    }
  }
  
  // 检查子块
  if (block.children) {
    for (const childId of block.children) {
      const childBlock = orca.state.blocks[childId] as Block;
      if (hasExistingCover(childBlock, coverUrl)) {
        return true;
      }
    }
  }
  
  return false;
}

// 处理B站链接
async function processBilibiliLink(blockId: number) {
  try {
    const block = orca.state.blocks[blockId] as Block;
    if (!block?.content) return;
    
    // 提取链接
    let bilibiliUrl = null;
    for (const fragment of block.content) {
      if (fragment.t === 'l' && fragment.l && BILIBILI_URL_REGEX.test(fragment.l)) {
        bilibiliUrl = fragment.l;
        break;
      }
    }
    
    if (!bilibiliUrl) {
      const text = block.content.map(f => f.v || '').join('');
      const match = text.match(BILIBILI_URL_REGEX);
      if (match) bilibiliUrl = match[0];
    }
    
    if (!bilibiliUrl) return;
    
    const videoId = extractVideoId(bilibiliUrl);
    if (!videoId) return;
    
    console.log('检测到粘贴内容:', bilibiliUrl);
    console.log('找到哔哩哔哩链接，自动执行提取操作');
    
    orca.notify('info', '正在获取视频信息...');
    
    const videoInfo = await getVideoInfo(videoId);
    
    if (videoInfo.coverUrl) {
      // 检查是否已存在相同的封面
      if (hasExistingCover(block, videoInfo.coverUrl)) {
        console.log('封面已存在，跳过插入');
        orca.notify('info', '封面已存在，跳过重复添加');
        return;
      }
      
      console.log('找到封面:', videoInfo.coverUrl);
      
      // 延迟插入图片，避免过快操作
      await new Promise(resolve => setTimeout(resolve, DELAY_CONFIG.imageProcessing));
      
      // 插入封面图片
      const imageRepr = {
        type: "image",
        src: videoInfo.coverUrl,
        alt: "哔哩哔哩视频封面"
      };
      
      await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        block,
        "lastChild",
        null,
        imageRepr
      );
      
      console.log('成功插入网络图片:', videoInfo.coverUrl);
      
      // 添加哔哩哔哩标签
      await orca.commands.invokeEditorCommand("core.editor.insertTag", null, blockId, '哔哩哔哩');
      console.log('成功添加哔哩哔哩标签');
      
      // 添加UP主标签
      if (videoInfo.upName) {
        await orca.commands.invokeEditorCommand("core.editor.insertTag", null, blockId, `哔哩UP：${videoInfo.upName}`);
        console.log('成功添加UP主标签:', videoInfo.upName);
      }
      
      orca.notify('success', `成功提取封面${videoInfo.upName ? `和UP主信息（${videoInfo.upName}）` : ''}！`);
    } else {
      console.error('获取视频信息失败');
      orca.notify('error', '获取视频信息失败');
    }
    
  } catch (error) {
    orca.notify('error', '处理失败');
  }
}

// 防抖处理
let debounceTimer: number | null = null;

// 粘贴处理
function handlePaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text/plain');
  if (!text || !BILIBILI_URL_REGEX.test(text)) return;
  
  // 清除之前的防抖定时器
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // 设置防抖延迟
  debounceTimer = setTimeout(async () => {
    try {
      const selection = window.getSelection();
      const cursor = orca.utils.getCursorDataFromSelection(selection);
      
      if (cursor?.anchor) {
        await processBilibiliLink(cursor.anchor.blockId);
      }
    } catch (error) {
      console.error('自动处理失败:', error);
    }
  }, DELAY_CONFIG.debounceDelay);
}

// 插件加载
export async function load(pluginName: string) {
  console.log('哔哩哔哩插件已加载');
  
  // 初始化缓存
  cache.clear();
  console.log('缓存系统已初始化');
  
  // 编辑器命令
  orca.commands.registerEditorCommand(
    `${pluginName}.extractCover`,
    async (cursor) => {
      try {
        const blockId = (cursor as any)?.anchor?.blockId;
        if (blockId) {
          await processBilibiliLink(blockId);
        }
      } catch (error) {
        console.error('编辑器命令执行失败:', error);
      }
      return null;
    },
    () => {},
    { label: '提取哔哩哔哩封面' }
  );
  
  // 右键菜单
  orca.blockMenuCommands.registerBlockMenuCommand(`${pluginName}.extractBilibiliInfo`, {
    worksOnMultipleBlocks: false,
    render: (blockId, _rootBlockId, close) => {
      const { React } = window;
      const { MenuText } = orca.components;
      
      const block = orca.state.blocks[blockId] as Block;
      if (!block || !hasBilibiliLink(block)) return null;
      
      return React.createElement(MenuText, {
        title: '🎬 提取B站视频信息',
        preIcon: 'ti ti-video',
        onClick: () => {
          close();
          processBilibiliLink(blockId);
        }
      });
    }
  });
  
  // 粘贴监听
  document.addEventListener('paste', handlePaste);
  
  orca.notify('info', '哔哩哔哩插件已启用');
}

// 插件卸载
export async function unload() {
  // 清理防抖定时器
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  
  // 清理缓存
  cache.clear();
  
  // 移除事件监听
  document.removeEventListener('paste', handlePaste);
  
  console.log('插件已卸载，缓存已清理');
}