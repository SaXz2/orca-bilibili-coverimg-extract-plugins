/**
 * Vimeo 视频信息提取模块
 * 自动检测 Vimeo 链接并提取视频信息、缩略图、作者信息等
 */

const VIMEO_URL_REGEX = /https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/i;

interface Block {
  id: number;
  content?: Array<{
    t: string;
    v?: string;
    l?: string;
  }>;
}

export interface VimeoVideoInfo {
  thumbnailUrl: string | null;
  author: string | null;
  title: string | null;
  tags: string[];
  publishDate: string | null;
  embedUrl: string | null;
}

export interface VimeoAPIResponse {
  uri: string;
  name: string;
  description: string;
  link: string;
  duration: number;
  width: number;
  height: number;
  created_time: string;
  modified_time: string;
  release_time?: string;
  player_embed_url?: string;
  user: {
    name: string;
    link: string;
  };
  pictures: {
    sizes: Array<{
      width: number;
      height: number;
      link: string;
    }>;
  };
  categories: Array<{
    name: string;
    uri: string;
  }>;
}

export interface VimeoOEmbedResponse {
  type: string;
  version: string;
  provider_name: string;
  provider_url: string;
  title: string;
  author_name: string;
  author_url: string;
  html: string;
  width: number;
  height: number;
  duration: number;
  description: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  upload_date: string;
  video_id: number;
  uri: string;
}

/**
 * 从 Vimeo URL 中提取视频 ID
 * @param url Vimeo 视频 URL
 * @returns 视频 ID，失败返回 null
 */
export function extractVimeoVideoId(url: string): string | null {
  const match = url.match(VIMEO_URL_REGEX);
  return match ? match[1] : null;
}

/**
 * 检查块是否包含 Vimeo 链接
 * @param block 块对象
 * @returns 是否包含 Vimeo 链接
 */
export function hasVimeoLink(block: Block): boolean {
  if (!block?.content) return false;
  
  for (const fragment of block.content) {
    if (fragment.t === 'l' && fragment.l && VIMEO_URL_REGEX.test(fragment.l)) {
      return true;
    }
  }
  
  const text = block.content.map(f => f.v || '').join('');
  return VIMEO_URL_REGEX.test(text);
}

/**
 * 从块内容中提取 Vimeo 链接
 * @param block 块对象
 * @returns Vimeo 视频 URL，未找到返回 null
 */
export function extractVimeoUrl(block: Block): string | null {
  if (!block?.content) return null;
  
  // 优先从链接 fragment 中提取
  for (const fragment of block.content) {
    if (fragment.t === 'l' && fragment.l && VIMEO_URL_REGEX.test(fragment.l)) {
      return fragment.l;
    }
  }
  
  // 从文本中提取
  const text = block.content.map(f => f.v || '').join('');
  const match = text.match(VIMEO_URL_REGEX);
  return match ? match[0] : null;
}

/**
 * 使用 oEmbed API 获取 Vimeo 视频内嵌链接
 * @param videoUrl Vimeo 视频 URL
 * @returns 内嵌视频 URL，失败返回 null
 */
export async function getVimeoEmbedUrl(videoUrl: string): Promise<string | null> {
  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      return null;
    }
    
    const data: VimeoOEmbedResponse = await response.json();
    
    // 从 HTML 中提取 iframe src
    if (data.html) {
      const iframeMatch = data.html.match(/src="([^"]+)"/);
      if (iframeMatch) {
        return iframeMatch[1];
      }
    }
    
    return null;
  } catch (error) {
    console.error('获取 Vimeo 内嵌链接失败:', error);
    return null;
  }
}

/**
 * 获取 Vimeo 视频信息
 * @param videoId Vimeo 视频 ID
 * @param accessToken Vimeo 访问令牌
 * @param videoUrl Vimeo 视频 URL（用于获取内嵌链接）
 * @returns 视频信息对象
 */
export async function getVimeoVideoInfo(videoId: string, accessToken: string, videoUrl?: string): Promise<VimeoVideoInfo> {
  try {
    const url = `https://api.vimeo.com/videos/${videoId}?fields=uri,name,description,link,duration,width,height,created_time,modified_time,release_time,user.name,user.link,pictures.sizes,categories.name`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('视频不存在或已被删除');
      } else if (response.status === 403) {
        throw new Error('无权访问此视频（可能是私有视频）');
      } else {
        throw new Error(`API 请求失败: ${response.status}`);
      }
    }
    
    const data: VimeoAPIResponse = await response.json();
    
    // 获取最佳质量的缩略图
    let thumbnailUrl: string | null = null;
    if (data.pictures?.sizes?.length > 0) {
      // 按宽度排序，选择最大的缩略图
      const sortedSizes = data.pictures.sizes.sort((a, b) => b.width - a.width);
      thumbnailUrl = sortedSizes[0].link;
    }
    
    // 转换发布日期格式，优先使用 release_time，如果没有则使用 created_time
    const publishDate = (data.release_time || data.created_time) ? 
      new Date(data.release_time || data.created_time).toISOString().split('T')[0] : 
      new Date().toISOString().split('T')[0];
    
    // 获取内嵌视频链接
    let embedUrl: string | null = null;
    if (data.player_embed_url) {
      embedUrl = data.player_embed_url;
    } else if (videoUrl) {
      // 如果没有 player_embed_url，尝试使用 oEmbed API
      embedUrl = await getVimeoEmbedUrl(videoUrl);
    }
    
    return {
      thumbnailUrl,
      author: data.user?.name || null,
      title: data.name || null,
      tags: data.categories?.map(category => category.name) || [],
      publishDate,
      embedUrl
    };
  } catch (error) {
    console.error('获取 Vimeo 视频信息失败:', error);
    throw error;
  }
}

/**
 * 处理 Vimeo 链接，提取视频信息并设置标签
 * @param blockId 块 ID
 * @param pluginName 插件名称
 */
export async function processVimeoLink(blockId: number, pluginName: string): Promise<void> {
  try {
    const block = orca.state.blocks[blockId] as Block;
    if (!block?.content) return;
    
    // 提取 Vimeo 链接
    const vimeoUrl = extractVimeoUrl(block);
    if (!vimeoUrl) return;
    
    const videoId = extractVimeoVideoId(vimeoUrl);
    if (!videoId) return;
    
    // 获取插件设置中的访问令牌
    const settings = orca.state.plugins[pluginName]?.settings as any;
    const accessToken = settings?.vimeoAccessToken;
    
    if (!accessToken) {
      orca.notify('error', '请先配置 Vimeo 访问令牌');
      return;
    }
    
    orca.notify('info', '正在获取 Vimeo 视频信息...');
    
    // 获取视频信息
    const videoInfo = await getVimeoVideoInfo(videoId, accessToken, vimeoUrl);
    
    if (!videoInfo.thumbnailUrl) {
      orca.notify('error', '获取 Vimeo 视频信息失败');
      return;
    }
    
    // 获取插件设置
    const shouldInsertImage = settings?.insertImageBlock !== false;
    const shouldInsertVideo = settings?.insertVideoBlock === true;
    
    // 添加 Vimeo 标签
    await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      null,
      blockId,
      'Vimeo'
    );
    
    // 重新获取块以获得最新的标签引用
    const updatedBlock = orca.state.blocks[blockId];
    const tagRef = updatedBlock?.refs?.find(
      (ref: any) => ref.type === 2 && ref.alias === 'Vimeo'
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
        { type: "image", src: videoInfo.thumbnailUrl, alt: "Vimeo 视频缩略图" }
      );
    }
    
    // 根据设置决定是否插入视频块
    if (shouldInsertVideo) {
      // 优先使用内嵌链接，如果没有则使用原始链接
      const videoSrc = videoInfo.embedUrl || vimeoUrl;
      await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        block,
        "lastChild",
        null,
        { type: "video", src: videoSrc, title: videoInfo.title || "Vimeo 视频" }
      );
    }
    
    // 添加作者标签（如果有作者信息）
    if (videoInfo.author) {
      await orca.commands.invokeEditorCommand(
        "core.editor.insertTag",
        null,
        blockId,
        `Vimeo作者：${videoInfo.author}`
      );
    }
    
    // 成功通知
    const messages = ['成功提取 Vimeo 视频信息'];
    if (videoInfo.author) messages.push(`作者：${videoInfo.author}`);
    if (videoInfo.tags.length > 0) messages.push(`标签数：${videoInfo.tags.length}`);
    
    orca.notify('success', messages.join(' | '));
    
  } catch (error) {
    console.error('处理 Vimeo 链接失败:', error);
    if (error instanceof Error) {
      orca.notify('error', `处理失败: ${error.message}`);
    } else {
      orca.notify('error', '处理失败');
    }
  }
}

/**
 * 初始化 Vimeo 标签块及其属性
 */
export async function initializeVimeoTag(): Promise<void> {
  try {
    const result = await orca.invokeBackend('get-blockid-by-alias', 'Vimeo');
    let tagBlockId: number;
    
    if (result?.id != null) {
      tagBlockId = result.id;
    } else {
      tagBlockId = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        null,
        null,
        [{ t: "t", v: "Vimeo" }],
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
    console.error('初始化 Vimeo 标签失败:', error);
  }
}
