/**
 * 统一视频处理接口
 * 协调不同视频平台的处理逻辑
 */

import { processBilibiliLink, hasBilibiliLink } from './bilibili';
import { processYouTubeLink, hasYouTubeLink } from './youtube';
import { processVimeoLink, hasVimeoLink } from './vimeo';

interface Block {
  id: number;
  content?: Array<{
    t: string;
    v?: string;
    l?: string;
  }>;
}

export type VideoPlatform = 'bilibili' | 'youtube' | 'vimeo';

/**
 * 检测块中包含的视频平台
 * @param block 块对象
 * @returns 视频平台类型，未检测到返回 null
 */
export function detectVideoPlatform(block: Block): VideoPlatform | null {
  if (hasBilibiliLink(block)) {
    return 'bilibili';
  }
  
  if (hasYouTubeLink(block)) {
    return 'youtube';
  }
  
  if (hasVimeoLink(block)) {
    return 'vimeo';
  }
  
  return null;
}

/**
 * 处理视频链接
 * @param blockId 块ID
 * @param pluginName 插件名称
 * @param platform 视频平台类型（可选，自动检测）
 */
export async function processVideoLink(
  blockId: number, 
  pluginName: string, 
  platform?: VideoPlatform
): Promise<void> {
  const block = orca.state.blocks[blockId] as Block;
  if (!block) return;
  
  // 如果没有指定平台，自动检测
  const detectedPlatform = platform || detectVideoPlatform(block);
  
  if (!detectedPlatform) {
    orca.notify('error', '未检测到支持的视频链接');
    return;
  }
  
  switch (detectedPlatform) {
    case 'bilibili':
      await processBilibiliLink(blockId, pluginName);
      break;
    case 'youtube':
      await processYouTubeLink(blockId, pluginName);
      break;
    case 'vimeo':
      await processVimeoLink(blockId, pluginName);
      break;
    default:
      orca.notify('error', '不支持的视频平台');
  }
}

/**
 * 检查块是否包含任何支持的视频链接
 * @param block 块对象
 * @returns 是否包含视频链接
 */
export function hasVideoLink(block: Block): boolean {
  return hasBilibiliLink(block) || hasYouTubeLink(block) || hasVimeoLink(block);
}

/**
 * 创建粘贴事件处理器
 * @param pluginName 插件名称
 * @returns 粘贴事件处理函数
 */
export function createPasteHandler(pluginName: string) {
  return function handlePaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text/plain');
    if (!text) return;
    
    // 检查是否包含视频链接
    const hasVideo = /https?:\/\/(?:www\.)?(?:bilibili\.com\/video\/(?:BV|av)\w+|(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}|vimeo\.com\/\d+)/i.test(text);
    
    if (!hasVideo) return;
    
    setTimeout(async () => {
      try {
        const selection = window.getSelection();
        const cursor = orca.utils.getCursorDataFromSelection(selection);
        
        if (cursor?.anchor) {
          await processVideoLink(cursor.anchor.blockId, pluginName);
        }
      } catch (error) {
        console.error('自动处理失败:', error);
      }
    }, 500);
  };
}
