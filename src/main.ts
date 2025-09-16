/**
 * 哔哩哔哩封面提取插件 - 最小可行方案
 * 自动检测哔哩哔哩链接并提取封面图片
 */

// B站链接正则
const BILIBILI_URL_REGEX = /https?:\/\/(?:www\.)?bilibili\.com\/video\/(?:BV|av)\w+/i;

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

// 获取视频信息（封面、UP主名称、标题）
async function getVideoInfo(videoId: string): Promise<VideoInfo> {
  try {
    const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com/'
      }
    });
    
    if (!response.ok) {
      return { coverUrl: null, upName: null, title: null };
    }
    
    const data = await response.json();
    if (data.code === 0 && data.data) {
      return {
        coverUrl: data.data.pic || null,
        upName: data.data.owner?.name || null,
        title: data.data.title || null
      };
    }
    
    return { coverUrl: null, upName: null, title: null };
  } catch {
    return { coverUrl: null, upName: null, title: null };
  }
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
    
    orca.notify('info', '正在获取视频信息...');
    
    const videoInfo = await getVideoInfo(videoId);
    
    if (videoInfo.coverUrl) {
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
      
      // 添加哔哩哔哩标签
      await orca.commands.invokeEditorCommand("core.editor.insertTag", null, blockId, '哔哩哔哩');
      
      // 添加UP主标签
      if (videoInfo.upName) {
        await orca.commands.invokeEditorCommand("core.editor.insertTag", null, blockId, `哔哩UP：${videoInfo.upName}`);
      }
      
      orca.notify('success', `成功提取封面${videoInfo.upName ? `和UP主信息（${videoInfo.upName}）` : ''}！`);
    } else {
      orca.notify('error', '获取视频信息失败');
    }
    
  } catch (error) {
    orca.notify('error', '处理失败');
  }
}

// 粘贴处理
function handlePaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text/plain');
  if (!text || !BILIBILI_URL_REGEX.test(text)) return;
  
  setTimeout(async () => {
    try {
      const selection = window.getSelection();
      const cursor = orca.utils.getCursorDataFromSelection(selection);
      
      if (cursor?.anchor) {
        await processBilibiliLink(cursor.anchor.blockId);
      }
    } catch (error) {
      console.error('自动处理失败:', error);
    }
  }, 500);
}

// 插件加载
export async function load(pluginName: string) {
  console.log('哔哩哔哩插件已加载');
  
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
  document.removeEventListener('paste', handlePaste);
  console.log('插件已卸载');
}