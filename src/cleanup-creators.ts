/**
 * 清理无引用的创作者块模块
 * 删除所有无引用的 UP主、博主、作者块
 */

interface Block {
  id: number;
  aliases: string[];
  backRefs?: Array<{
    id: number;
    from: number;
    to: number;
    type: number;
    alias?: string;
  }>;
}

/**
 * 创作者块别名前缀
 */
const CREATOR_PREFIXES = [
  '哔哩UP：',
  '油管博主：',
  'Vimeo作者：'
] as const;

/**
 * 检查块的别名是否匹配创作者块格式
 * @param block 块对象
 * @returns 是否为创作者块
 */
function isCreatorBlock(block: Block): boolean {
  if (!block.aliases || block.aliases.length === 0) {
    return false;
  }
  
  return block.aliases.some(alias => 
    CREATOR_PREFIXES.some(prefix => alias.startsWith(prefix))
  );
}

/**
 * 检查块是否有引用
 * @param block 块对象
 * @returns 是否有引用
 */
function hasReferences(block: Block): boolean {
  return !!(block.backRefs && block.backRefs.length > 0);
}

/**
 * 获取块的别名显示名称（用于日志）
 * @param block 块对象
 * @returns 别名显示名称
 */
function getBlockDisplayName(block: Block): string {
  if (!block.aliases || block.aliases.length === 0) {
    return `块 #${block.id}`;
  }
  return block.aliases[0] || `块 #${block.id}`;
}

/**
 * 清理所有无引用的创作者块
 * @returns 删除的块ID数组和统计信息
 */
export async function cleanupUnusedCreatorBlocks(): Promise<{
  deletedBlockIds: number[];
  statistics: {
    totalChecked: number;
    creatorBlocksFound: number;
    unusedCreatorBlocks: number;
    deleted: number;
  };
}> {
  const statistics = {
    totalChecked: 0,
    creatorBlocksFound: 0,
    unusedCreatorBlocks: 0,
    deleted: 0
  };

  const deletedBlockIds: number[] = [];

  try {
    console.log('[清理创作者块] 开始查找所有带有"视频创作者"标签的块...');
    
    // 获取所有带有"视频创作者"标签的块
    const taggedBlocks = await orca.invokeBackend('get-blocks-with-tags', ['视频创作者']);
    
    if (!Array.isArray(taggedBlocks)) {
      console.error('[清理创作者块] 获取标签块失败：返回结果不是数组');
      return { deletedBlockIds, statistics };
    }

    statistics.totalChecked = taggedBlocks.length;
    console.log(`[清理创作者块] 找到 ${statistics.totalChecked} 个带有"视频创作者"标签的块`);

    // 过滤出创作者块（匹配别名前缀）
    const creatorBlocks: Block[] = [];
    for (const blockData of taggedBlocks) {
      // 处理不同的返回格式：可能是完整块对象或包含id的对象
      const blockId = (blockData as any).id || blockData;
      const block = orca.state.blocks[blockId] as Block;
      if (block && isCreatorBlock(block)) {
        creatorBlocks.push(block);
        statistics.creatorBlocksFound++;
      }
    }

    console.log(`[清理创作者块] 其中 ${statistics.creatorBlocksFound} 个是创作者块（UP主/博主/作者）`);

    // 找出无引用的创作者块
    const unusedCreatorBlocks: Block[] = [];
    for (const block of creatorBlocks) {
      if (!hasReferences(block)) {
        unusedCreatorBlocks.push(block);
        statistics.unusedCreatorBlocks++;
        console.log(`[清理创作者块] 发现无引用块: ${getBlockDisplayName(block)} (ID: ${block.id})`);
      }
    }

    console.log(`[清理创作者块] 找到 ${statistics.unusedCreatorBlocks} 个无引用的创作者块`);

    if (unusedCreatorBlocks.length === 0) {
      console.log('[清理创作者块] 没有需要清理的块');
      return { deletedBlockIds, statistics };
    }

    // 提取要删除的块ID
    const blockIdsToDelete = unusedCreatorBlocks.map(block => block.id);
    
    console.log(`[清理创作者块] 准备删除 ${blockIdsToDelete.length} 个块:`, blockIdsToDelete);
    console.log(`[清理创作者块] 删除的块详情:`);
    unusedCreatorBlocks.forEach(block => {
      console.log(`  - ${getBlockDisplayName(block)} (ID: ${block.id})`);
    });

    // 批量删除块
    await orca.commands.invokeEditorCommand(
      'core.editor.deleteBlocks',
      null,
      blockIdsToDelete
    );

    deletedBlockIds.push(...blockIdsToDelete);
    statistics.deleted = deletedBlockIds.length;

    console.log(`[清理创作者块] 成功删除 ${statistics.deleted} 个无引用的创作者块`);
    console.log(`[清理创作者块] 清理完成。统计信息:`, statistics);

    return { deletedBlockIds, statistics };

  } catch (error) {
    console.error('[清理创作者块] 清理过程中发生错误:', error);
    throw error;
  }
}

