/**
 * 哔哩哔哩封面提取插件
 * 自动检测哔哩哔哩链接并提取封面图片、UP主信息、标签等
 */

const BILIBILI_URL_REGEX = /https?:\/\/(?:www\.)?bilibili\.com\/video\/(?:BV|av)\w+/i;

const API_CONFIG = {
  videoInfo: 'https://api.bilibili.com/x/web-interface/view',
  videoTags: 'https://api.bilibili.com/x/tag/archive/tags',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.bilibili.com/'
  }
} as const;

interface Block {
  id: number;
  content?: Array<{
    t: string;
    v?: string;
    l?: string;
  }>;
}

interface VideoInfo {
  coverUrl: string | null;
  upName: string | null;
  title: string | null;
  tags: string[];
  publishDate: string | null;
}

interface PluginSettings {
  insertImageBlock?: boolean;
  useTextDate?: boolean;
}

/**
 * 从URL中提取视频ID
 * @param url B站视频URL
 * @returns 视频ID（BV号或av号），失败返回null
 */
export function extractVideoId(url: string): string | null {
  const match = url.match(/\/video\/(BV\w+|av\d+)/i);
  return match ? match[1] : null;
}

/**
 * 检查块是否包含B站链接
 * @param block 块对象
 * @returns 是否包含B站链接
 */
export function hasBilibiliLink(block: Block): boolean {
  if (!block?.content) return false;
  
  for (const fragment of block.content) {
    if (fragment.t === 'l' && fragment.l && BILIBILI_URL_REGEX.test(fragment.l)) {
      return true;
    }
  }
  
  const text = block.content.map(f => f.v || '').join('');
  return BILIBILI_URL_REGEX.test(text);
}

/**
 * 从块内容中提取B站链接
 * @param block 块对象
 * @returns B站视频URL，未找到返回null
 */
export function extractBilibiliUrl(block: Block): string | null {
  if (!block?.content) return null;
  
  // 优先从链接fragment中提取
  for (const fragment of block.content) {
    if (fragment.t === 'l' && fragment.l && BILIBILI_URL_REGEX.test(fragment.l)) {
      return fragment.l;
    }
  }
  
  // 从文本中提取
  const text = block.content.map(f => f.v || '').join('');
  const match = text.match(BILIBILI_URL_REGEX);
  return match ? match[0] : null;
}

// ==================== API 调用模块 ====================

/**
 * 获取视频基本信息
 * @param videoId 视频ID（BV号或av号）
 * @returns 视频信息对象
 */
export async function getVideoInfo(videoId: string): Promise<VideoInfo> {
  try {
    const url = `${API_CONFIG.videoInfo}?bvid=${videoId}`;
    const response = await fetch(url, { headers: API_CONFIG.headers });
    
    if (!response.ok) {
      return { coverUrl: null, upName: null, title: null, tags: [], publishDate: null };
    }
    
    const data = await response.json();
    if (data.code === 0 && data.data) {
      const video = data.data;
      
      // 调试：打印原始数据
      console.log('🔍 API 返回的原始数据:', {
        pubdate: video.pubdate,
        ctime: video.ctime,
        pub_time: video.pub_time
      });
      
      // 转换时间戳为日期字符串
      let publishDate: string | null = null;
      if (video.pubdate) {
        const date = new Date(video.pubdate * 1000); // 时间戳转换为毫秒
        publishDate = date.toISOString().split('T')[0]; // 格式化为 YYYY-MM-DD
        console.log('📅 转换后的发布日期:', publishDate);
      } else {
        console.log('⚠️ 未找到 pubdate 字段');
      }
      
      return {
        coverUrl: video.pic || null,
        upName: video.owner?.name || null,
        title: video.title || null,
        tags: [], // 标签通过单独的API获取
        publishDate
      };
    }
    
    return { coverUrl: null, upName: null, title: null, tags: [], publishDate: null };
  } catch (error) {
    console.error('获取视频信息失败:', error);
    return { coverUrl: null, upName: null, title: null, tags: [], publishDate: null };
  }
}

/**
 * 获取视频标签列表
 * @param videoId 视频ID（BV号或av号）
 * @returns 标签名称数组
 */
export async function getVideoTags(videoId: string): Promise<string[]> {
  try {
    const url = `${API_CONFIG.videoTags}?bvid=${videoId}`;
    const response = await fetch(url, { headers: API_CONFIG.headers });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    if (data.code === 0 && Array.isArray(data.data)) {
      return data.data
        .map((tag: any) => tag.tag_name || '')
        .filter((name: string) => name.trim().length > 0);
    }
    
    return [];
  } catch (error) {
    console.error('获取视频标签失败:', error);
    return [];
  }
}

/**
 * 获取完整的视频信息（包括标签）
 * @param videoId 视频ID（BV号或av号）
 * @returns 完整的视频信息
 */
export async function getCompleteVideoInfo(videoId: string): Promise<VideoInfo> {
  const [info, tags] = await Promise.all([
    getVideoInfo(videoId),
    getVideoTags(videoId)
  ]);
  
  return {
    ...info,
    tags
  };
}

/**
 * 处理B站链接，提取视频信息并设置标签
 * @param blockId 块ID
 * @param pluginName 插件名称
 */
async function processBilibiliLink(blockId: number, pluginName: string): Promise<void> {
  try {
    const block = orca.state.blocks[blockId] as Block;
    if (!block?.content) return;
    
    // 提取B站链接
    const bilibiliUrl = extractBilibiliUrl(block);
    if (!bilibiliUrl) return;
    
    const videoId = extractVideoId(bilibiliUrl);
    if (!videoId) return;
    
    orca.notify('info', '正在获取视频信息...');
    
    // 并行获取视频信息和标签
    const videoInfo = await getCompleteVideoInfo(videoId);
    
    if (!videoInfo.coverUrl) {
      orca.notify('error', '获取视频信息失败');
      return;
    }
    
    // 获取插件设置
    const settings = orca.state.plugins[pluginName]?.settings as PluginSettings | undefined;
    const shouldInsertImage = settings?.insertImageBlock !== false;
    const useTextDate = settings?.useTextDate === true;
    
    // 添加哔哩哔哩标签
    const tagsString = videoInfo.tags.join('|');
    
    // 先插入标签
    await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      null,
      blockId,
      '哔哩哔哩'
    );
    
    // 重新获取块以获得最新的标签引用
    const updatedBlock = orca.state.blocks[blockId];
    const tagRef = updatedBlock?.refs?.find(
      (ref: any) => ref.type === 2 && ref.alias === '哔哩哔哩'
    );
    
    if (tagRef) {
      await orca.commands.invokeEditorCommand(
        "core.editor.setRefData",
        null,
        tagRef,
        [
          { name: "img", value: videoInfo.coverUrl, type: 1 },
          { name: "tags", value: tagsString, type: 1 },
          ...(useTextDate 
            ? [{ name: "publishDateText", value: videoInfo.publishDate || "", type: 1 }]
            : [{ name: "publishDate", value: videoInfo.publishDate ? new Date(videoInfo.publishDate) : new Date(), type: 5 }]
          )
        ]
      );
    }
    
    // 根据设置决定是否插入图片块
    if (shouldInsertImage) {
      await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        block,
        "lastChild",
        null,
        { type: "image", src: videoInfo.coverUrl, alt: "哔哩哔哩视频封面" }
      );
    }
    
    // 添加UP主标签
    if (videoInfo.upName) {
      await orca.commands.invokeEditorCommand(
        "core.editor.insertTag",
        null,
        blockId,
        `哔哩UP：${videoInfo.upName}`
      );
    }
    
    // 成功通知
    const messages = ['成功提取视频信息'];
    if (videoInfo.upName) messages.push(`UP主：${videoInfo.upName}`);
    if (videoInfo.tags.length > 0) messages.push(`标签数：${videoInfo.tags.length}`);
    
    orca.notify('success', messages.join(' | '));
    
  } catch (error) {
    console.error('处理B站链接失败:', error);
    orca.notify('error', '处理失败');
  }
}

// ==================== 事件处理 ====================

/**
 * 创建粘贴事件处理器
 * @param pluginName 插件名称
 * @returns 粘贴事件处理函数
 */
function createPasteHandler(pluginName: string) {
  return function handlePaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text/plain');
    if (!text || !BILIBILI_URL_REGEX.test(text)) return;
    
    setTimeout(async () => {
      try {
        const selection = window.getSelection();
        const cursor = orca.utils.getCursorDataFromSelection(selection);
        
        if (cursor?.anchor) {
          await processBilibiliLink(cursor.anchor.blockId, pluginName);
        }
      } catch (error) {
        console.error('自动处理失败:', error);
      }
    }, 500);
  };
}

let pasteHandler: ((event: ClipboardEvent) => void) | null = null;
let tagInitialized: boolean = false;

/**
 * 初始化"哔哩哔哩"标签块及其属性
 */
async function initializeBilibiliTag() {
  if (tagInitialized) return;
  
  try {
    const result = await orca.invokeBackend('get-blockid-by-alias', '哔哩哔哩');
    let tagBlockId: number;
    
    if (result?.id != null) {
      tagBlockId = result.id;
    } else {
      tagBlockId = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        null,
        null,
        [{ t: "t", v: "哔哩哔哩" }],
        { type: "text" }
      );
    }
    
    // 为标签块设置属性（如果不存在则创建）
    await orca.commands.invokeEditorCommand(
      "core.editor.setProperties",
      null,
      [tagBlockId],
      [
        { 
          name: "img", 
          value: "", 
          type: 1,  // PropType.Text
          typeArgs: { subType: "image" }
        },
        { 
          name: "tags", 
          value: "", 
          type: 1  // PropType.Text
        },
        { 
          name: "publishDate", 
          value: new Date(), 
          type: 5,  // PropType.DateTime
          typeArgs: { subType: "date" }
        },
        { 
          name: "publishDateText", 
          value: "", 
          type: 1  // PropType.Text
        }
      ]
    );
    
    tagInitialized = true;
  } catch (error) {
    // 静默处理错误
  }
}

/**
 * 插件加载函数
 * @param pluginName 插件名称
 */
export async function load(pluginName: string) {
  await initializeBilibiliTag();
  
  // 注册插件设置
  await orca.plugins.setSettingsSchema(pluginName, {
    insertImageBlock: {
      label: '插入图片块',
      description: '是否在块中插入封面图片（图片URL会始终存储在标签属性中）',
      type: 'boolean',
      defaultValue: true
    },
    useTextDate: {
      label: '使用文本日期',
      description: '是否使用文本格式的发布日期（属性名为publishDateText）',
      type: 'boolean',
      defaultValue: false
    }
  });
  
  // 编辑器命令
  orca.commands.registerEditorCommand(
    `${pluginName}.extractCover`,
    async (cursor) => {
      try {
        const blockId = (cursor as any)?.anchor?.blockId;
        if (blockId) {
          await processBilibiliLink(blockId, pluginName);
        }
      } catch (error) {
        console.error('编辑器命令执行失败:', error);
      }
      return null;
    },
    () => {},
    { label: '提取哔哩哔哩视频信息' }
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
          processBilibiliLink(blockId, pluginName);
        }
      });
    }
  });
  
  // 粘贴监听
  pasteHandler = createPasteHandler(pluginName);
  document.addEventListener('paste', pasteHandler);
  
  orca.notify('info', '哔哩哔哩插件已启用');
}

/**
 * 插件卸载函数
 */
export async function unload() {
  if (pasteHandler) {
    document.removeEventListener('paste', pasteHandler);
    pasteHandler = null;
  }
  tagInitialized = false;
}