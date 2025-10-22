# Orca 视频信息提取插件

自动提取哔哩哔哩和 YouTube 视频信息、缩略图、频道信息等，并设置为Orca标签属性。

## 功能特性

### 哔哩哔哩支持
- ✨ 自动识别B站视频链接（BV号/av号）
- 🖼️ 提取视频封面图片
- 👤 提取UP主信息
- 🏷️ 提取视频标签
- 📅 提取发布日期

### YouTube 支持
- ✨ 自动识别 YouTube 视频链接
- 🖼️ 提取视频缩略图
- 👤 提取频道信息
- 📺 支持多种 YouTube URL 格式
- 🎬 支持视频嵌入

### 通用功能
- ⚙️ 可配置是否插入图片块和视频块
- 📋 右键菜单快捷操作
- 🎯 粘贴链接自动处理
- 🔄 统一的多平台支持

## 使用方法

### 1. 粘贴链接自动提取

#### 哔哩哔哩视频
直接粘贴B站视频链接（如 `https://www.bilibili.com/video/BV1xx411c7XD`），插件会自动：
- 提取视频信息
- 添加"哔哩哔哩"标签，并设置以下属性：
  - `img`：视频封面URL
  - `tags`：视频标签（用 `|` 分隔）
  - `publishDate`：发布日期
- （可选）在块下方插入封面图片
- 添加"哔哩UP：XXX"标签

#### YouTube 视频
直接粘贴 YouTube 视频链接（如 `https://www.youtube.com/watch?v=dQw4w9WgXcQ`），插件会自动：
- 提取视频信息
- 添加"Youtube"标签，并设置以下属性：
  - `img`：视频缩略图URL
  - `tags`：视频标签（用 `|` 分隔，需要 API Key）
  - `publishDate`：发布日期（需要 API Key）
- （可选）在块下方插入缩略图
- 添加"油管博主：XXX"标签

### 2. 右键菜单提取

在包含视频链接的块上：
1. 右键点击
2. 选择 "🎬 提取视频信息"

### 3. 命令面板

使用命令 `提取视频信息`

## 插件设置

在 Orca 设置 > 插件 > 视频信息提取插件 中配置：

- **插入图片块**（默认：开启）
  - 开启：在块下方插入封面图片/缩略图
  - 关闭：仅将图片URL存储在标签属性中

- **插入视频块**（默认：关闭）
  - 开启：在块下方插入视频块
  - 关闭：仅提取信息不插入视频

- **YouTube Data API v3 密钥**（可选）
  - 用于获取 YouTube 视频真实标签和发布日期
  - 留空则使用基础模式（仅获取缩略图和频道名）
  - 申请地址：https://console.developers.google.com/

> 注意：无论此选项如何设置，图片URL都会存储在相应标签的 `img` 属性中。

## 标签属性说明

### 哔哩哔哩标签

- **img** (文本)：视频封面图片URL
- **tags** (文本)：视频标签列表，用 `|` 分隔
  - 例如：`东方|PV|IOSYS|现存元老`
- **publishDate** (日期)：发布日期
- **publishDateText** (文本)：发布日期文本

### 哔哩UP标签

- 格式：`哔哩UP：{UP主名称}`
- 用于快速识别UP主

### YouTube 标签

- **img** (文本)：视频缩略图URL
- **tags** (文本)：视频标签列表，用 `|` 分隔（需要 API Key）
- **publishDate** (日期)：发布日期（需要 API Key）
- **publishDateText** (文本)：发布日期文本（需要 API Key）

### 油管博主标签

- 格式：`油管博主：{频道名称}`
- 用于快速识别频道

## 支持的 URL 格式

### 哔哩哔哩
- `https://www.bilibili.com/video/BV1xx411c7XD`
- `https://www.bilibili.com/video/av12345`
- `https://bilibili.com/video/BV1xx411c7XD`

### YouTube
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `https://youtu.be/dQw4w9WgXcQ`
- `https://youtube.com/watch?v=dQw4w9WgXcQ`
- `https://www.youtube.com/shorts/_Ex--OvqMok` (YouTube Shorts)

## 技术架构

### 模块化设计

- **src/bilibili.ts**：哔哩哔哩功能模块
- **src/youtube.ts**：YouTube 功能模块
- **src/video-processor.ts**：统一视频处理接口
- **src/main.ts**：插件入口和生命周期管理

### 单元测试覆盖

- ✅ 哔哩哔哩功能测试（URL提取、链接检测、API调用）
- ✅ YouTube 功能测试（URL提取、链接检测、API调用）
- ✅ 统一处理器测试（平台检测、链接检测）
- ✅ 错误处理测试
- ✅ 边界情况测试

## API 使用

插件使用以下B站API：

1. **视频信息API**
   ```
   GET https://api.bilibili.com/x/web-interface/view?bvid={videoId}
   ```
   返回：封面、标题、UP主信息

2. **视频标签API**
   ```
   GET https://api.bilibili.com/x/tag/archive/tags?bvid={videoId}
   ```
   返回：标签列表

## 许可证

MIT License

## 作者

SaXz2

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.1.1

- 🎨 新增链接样式优化功能
- ✨ 支持链接文本截断显示和悬浮提示
- 🔧 可配置的链接样式优化开关
- 🌐 全面覆盖动态加载的链接（查询结果、搜索等）
- 🖱️ 智能悬浮提示显示链接文本内容
- 📱 响应式链接样式适配

### v1.1.0

- 🔧 改进插件功能和稳定性
- 🐛 修复UP主信息提取和标签功能
- 📦 优化插件打包结构
- 🚀 完善GitHub Actions发布流程
- 📝 增强文档和README说明
- ⚡ 提升API调用性能和错误处理

### v1.0.0

- ✨ 初始版本
- 支持提取视频封面、UP主、标签
- 支持标签属性存储
- 可配置图片插入选项
- 完整的单元测试覆盖