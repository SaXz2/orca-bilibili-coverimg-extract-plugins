/**
 * YouTube 视频信息提取模块
 * 自动检测 YouTube 链接并提取视频信息、缩略图、频道信息等
 */

const YOUTUBE_URL_REGEX = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

interface Block {
  id: number;
  content?: Array<{
    t: string;
    v?: string;
    l?: string;
  }>;
}

export interface YouTubeVideoInfo {
  author: string | null;
  thumbnailUrl: string | null;
  html: string | null;
  publishDate: string | null;
  tags: string[];
}

export interface YouTubeDataAPIResponse {
  items: Array<{
    snippet: {
      title: string;
      channelTitle: string;
      publishedAt: string;
      tags?: string[];
      thumbnails: {
        default: { url: string };
        medium: { url: string };
        high: { url: string };
      };
    };
  }>;
}

/**
 * 从 YouTube URL 中提取视频 ID
 * @param url YouTube 视频 URL
 * @returns 视频 ID，失败返回 null
 */
export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_URL_REGEX);
  return match ? match[1] : null;
}

/**
 * 检查块是否包含 YouTube 链接
 * @param block 块对象
 * @returns 是否包含 YouTube 链接
 */
export function hasYouTubeLink(block: Block): boolean {
  if (!block?.content) return false;
  
  for (const fragment of block.content) {
    if (fragment.t === 'l' && fragment.l && YOUTUBE_URL_REGEX.test(fragment.l)) {
      return true;
    }
  }
  
  const text = block.content.map(f => f.v || '').join('');
  return YOUTUBE_URL_REGEX.test(text);
}

/**
 * 从块内容中提取 YouTube 链接
 * @param block 块对象
 * @returns YouTube 视频 URL，未找到返回 null
 */
export function extractYouTubeUrl(block: Block): string | null {
  if (!block?.content) return null;
  
  // 优先从链接 fragment 中提取
  for (const fragment of block.content) {
    if (fragment.t === 'l' && fragment.l && YOUTUBE_URL_REGEX.test(fragment.l)) {
      return fragment.l;
    }
  }
  
  // 从文本中提取
  const text = block.content.map(f => f.v || '').join('');
  const match = text.match(YOUTUBE_URL_REGEX);
  return match ? match[0] : null;
}

/**
 * 使用 YouTube Data API v3 获取视频详细信息
 * @param videoId YouTube 视频 ID
 * @param apiKey YouTube Data API v3 密钥
 * @returns 视频详细信息
 */
export async function getYouTubeVideoDetails(videoId: string, apiKey: string): Promise<YouTubeVideoInfo> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`YouTube Data API 请求失败: ${response.status}`);
    }
    
    const data: YouTubeDataAPIResponse = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('未找到视频信息');
    }
    
    const video = data.items[0];
    const snippet = video.snippet;
    
    // 转换发布日期格式
    const publishDate = snippet.publishedAt ? 
      new Date(snippet.publishedAt).toISOString().split('T')[0] : 
      new Date().toISOString().split('T')[0];
    
    return {
      author: snippet.channelTitle || null,
      thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null,
      html: null, // Data API 不提供嵌入 HTML
      publishDate,
      tags: snippet.tags || []
    };
  } catch (error) {
    console.error('获取 YouTube 视频详细信息失败:', error);
    throw error;
  }
}

/**
 * 获取 YouTube 视频信息（优先使用 Data API，回退到 oEmbed）
 * @param videoUrl YouTube 视频 URL
 * @param apiKey YouTube Data API v3 密钥（可选）
 * @returns 视频信息对象
 */
export async function getYouTubeVideoInfo(videoUrl: string, apiKey?: string): Promise<YouTubeVideoInfo> {
  try {
    // 如果有 API Key，优先使用 Data API
    if (apiKey) {
      const videoId = extractYouTubeVideoId(videoUrl);
      if (videoId) {
        return await getYouTubeVideoDetails(videoId, apiKey);
      }
    }
    
    // 回退到 oEmbed API
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      return { 
        author: null,
        thumbnailUrl: null, 
        html: null, 
        publishDate: new Date().toISOString().split('T')[0],
        tags: []
      };
    }
    
    const data = await response.json();
    
    return {
      author: data.author_name || null,
      thumbnailUrl: data.thumbnail_url || null,
      html: data.html || null,
      publishDate: new Date().toISOString().split('T')[0],
      tags: []
    };
  } catch (error) {
    console.error('获取 YouTube 视频信息失败:', error);
    return { 
      author: null,
      thumbnailUrl: null, 
      html: null, 
      publishDate: new Date().toISOString().split('T')[0],
      tags: []
    };
  }
}

/**
 * 处理 YouTube 链接，提取视频信息并设置标签
 * @param blockId 块 ID
 * @param pluginName 插件名称
 */
export async function processYouTubeLink(blockId: number, pluginName: string): Promise<void> {
  try {
    const block = orca.state.blocks[blockId] as Block;
    if (!block?.content) return;
    
    // 提取 YouTube 链接
    const youtubeUrl = extractYouTubeUrl(block);
    if (!youtubeUrl) return;
    
    orca.notify('info', '正在获取 YouTube 视频信息...');
    
    // 获取插件设置中的 API Key
    const settings = orca.state.plugins[pluginName]?.settings as any;
    const apiKey = settings?.youtubeApiKey;
    
    // 获取视频信息
    const videoInfo = await getYouTubeVideoInfo(youtubeUrl, apiKey);
    
    if (!videoInfo.thumbnailUrl) {
      orca.notify('error', '获取 YouTube 视频信息失败');
      return;
    }
    
    // 获取插件设置
    const shouldInsertImage = settings?.insertImageBlock !== false;
    const shouldInsertVideo = settings?.insertVideoBlock === true;
    
    // 添加 YouTube 标签
    await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      null,
      blockId,
      'Youtube'
    );
    
    // 重新获取块以获得最新的标签引用
    const updatedBlock = orca.state.blocks[blockId];
    const tagRef = updatedBlock?.refs?.find(
      (ref: any) => ref.type === 2 && ref.alias === 'Youtube'
    );
    
    if (tagRef) {
      const tagsString = videoInfo.tags.join('|');
      await orca.commands.invokeEditorCommand(
        "core.editor.setRefData",
        null,
        tagRef,
        [
          { name: "img", value: videoInfo.thumbnailUrl, type: 1 },
          { name: "tags", value: tagsString, type: 1 },
          { name: "publishDate", value: videoInfo.publishDate ? new Date(videoInfo.publishDate) : new Date(), type: 5 },
          { name: "publishDateText", value: videoInfo.publishDate || new Date().toISOString().split('T')[0], type: 1 }
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
        { type: "image", src: videoInfo.thumbnailUrl, alt: "YouTube 视频缩略图" }
      );
    }
    
    // 根据设置决定是否插入视频块
    if (shouldInsertVideo && videoInfo.html) {
      // 提取 iframe src 用于视频块
      const iframeMatch = videoInfo.html.match(/src="([^"]+)"/);
      const videoSrc = iframeMatch ? iframeMatch[1] : youtubeUrl;
      
      await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        block,
        "lastChild",
        null,
        { type: "video", src: videoSrc, title: "YouTube 视频" }
      );
    }
    
    // 添加博主标签（如果有频道信息）
    if (videoInfo.author) {
      await orca.commands.invokeEditorCommand(
        "core.editor.insertTag",
        null,
        blockId,
        `油管博主：${videoInfo.author}`
      );
    }
    
    // 成功通知
    orca.notify('success', '成功提取 YouTube 视频信息');
    
  } catch (error) {
    console.error('处理 YouTube 链接失败:', error);
    orca.notify('error', '处理失败');
  }
}

/**
 * 初始化 YouTube 标签块及其属性
 */
export async function initializeYouTubeTag(): Promise<void> {
  try {
    const result = await orca.invokeBackend('get-blockid-by-alias', 'Youtube');
    let tagBlockId: number;
    
    if (result?.id != null) {
      tagBlockId = result.id;
    } else {
      tagBlockId = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        null,
        null,
        [{ t: "t", v: "Youtube" }],
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
  } catch (error) {
    // 静默处理错误
    console.error('初始化 YouTube 标签失败:', error);
  }
}
