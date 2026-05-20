# CanvasFlow AI Studio - 节点类型与数据结构设计

## 一、核心数据类型

```typescript
// ============================================
// 剧本层级
// ============================================

/** 剧本场景 */
interface ScriptScene {
  id: string;
  index: number;                    // 场景序号
  title: string;                   // 场景标题
  location: string;               // 场景地点
  timeOfDay: string;               // 日/夜
  characters: CharacterRef[];     // 登场角色
  content: string;                 // 场景描述/情节
  dialogues: Dialogue[];           // 对话列表
  duration?: number;               // 预估时长(秒)
}

/** 角色引用 */
interface CharacterRef {
  id: string;
  name: string;                   // 角色名
  description: string;             // 外貌/性格描述
  avatarImageId?: string;         // 角色头像图(assetId)
}

/** 对话 */
interface Dialogue {
  id: string;
  characterId: string;            // 角色ID
  text: string;                   // 对白内容
  emotion?: string;               // 情绪
}

// ============================================
// 分镜层级
// ============================================

/** 分镜镜头 */
interface StoryboardShot {
  id: string;
  sceneId: string;                // 所属场景ID
  index: number;                  // 镜头序号
  shotType: ShotType;             // 镜头类型
  cameraMovement: CameraMovement; // 运镜方式
  duration: number;               // 时长(秒), Seedance限制4-15s

  // 画面描述
  visualPrompt: string;           // Seedance画面描述prompt
  environment: string;            // 环境描述
  characters: ShotCharacter[];    // 镜头中的角色

  // 参考素材（Seedance @语法）
  referenceImages: AssetRef[];   // ≤9张参考图
  referenceVideos: AssetRef[];    // ≤3个参考视频
  referenceAudios: AssetRef[];   // ≤3个参考音频

  // 生成结果
  status: ShotStatus;
  outputVideoId?: string;         // 生成后的视频assetId
  thumbnailId?: string;           // 缩略图assetId
}

type ShotType =
  | 'establishing'   // 建立镜头
  | 'wide'           // 远景
  | 'medium'         // 中景
  | 'close_up'       // 特写
  | 'over_shoulder'  // 过肩
  | 'POV'            // 主观视角
  | 'aerial'         // 航拍
  | 'tracking'       // 跟拍
  | 'static';        // 固定

type CameraMovement =
  | 'static'         // 固定
  | 'pan_left'       // 左摇
  | 'pan_right'      // 右摇
  | 'tilt_up'        // 仰摇
  | 'tilt_down'      // 俯摇
  | 'dolly_in'       // 推近
  | 'dolly_out'      // 拉远
  | 'crane_up'       // 升
  | 'crane_down'     // 降
  | 'tracking'       // 跟随
  | 'orbit';         // 环绕

type ShotStatus =
  | 'pending'        // 待生成
  | 'generating'     // 生成中
  | 'completed'      // 完成
  | 'failed'         // 失败
  | 'skipped';       // 跳过

interface ShotCharacter {
  characterId: string;            // 角色ID
  position: string;               // 位置描述："左/中/右"
  action: string;                 // 动作描述
  emotion: string;                // 表情/情绪
}

interface AssetRef {
  assetId: string;                // 资产ID
  role: AssetRole;                // 在生成中的作用
  nodeId?: string;                // 来源节点ID
}

type AssetRole =
  | 'first_frame'    // 首帧图
  | 'last_frame'     // 尾帧图
  | 'style_ref'      // 风格参考
  | 'composition_ref'// 构图参考
  | 'action_ref'     // 动作参考
  | 'camera_ref'     // 运镜参考
  | 'audio_bgm'      // 背景音乐
  | 'audio_sfx'      // 音效;

// ============================================
// 素材资产
// ============================================

interface Asset {
  id: string;                     // UUID
  type: AssetType;
  name: string;
  path: string;                  // 相对于assets/的路径
  thumbnailPath?: string;
  metadata: AssetMetadata;
  createdAt: string;
  sourceNodeId?: string;         // 来源节点
}

type AssetType =
  | 'image'
  | 'video'
  | 'audio'
  | 'text';

interface AssetMetadata {
  width?: number;
  height?: number;
  duration?: number;             // 音视频时长(秒)
  size: number;                 // 文件大小(字节)
  mimeType: string;
  // 图生图特有
  model?: string;               // 'seedream-5.0'
  prompt?: string;
  // 视频生成特有
  seedanceJobId?: string;       // Seedance任务ID
  seedanceStatus?: string;
}
```

---

## 二、节点类型定义

### 2.1 剧本节点 (ScriptNode)

```
输入：无（主题由用户输入）
输出：ScriptScene[]
处理：调用LLM生成剧本
```

```typescript
interface ScriptNodeData {
  // 配置
  theme: string;                 // 用户输入的主题
  genre: string;                // 题材：剧情/广告/宣传片
  duration: number;              // 总时长目标(秒)
  numScenes: number;            // 场景数量
  characters: CharacterDef[];   // 角色定义

  // 输出
  scenes: ScriptScene[];
  status: 'idle' | 'generating' | 'completed' | 'error';
  errorMessage?: string;
}

interface CharacterDef {
  id: string;
  name: string;
  age?: string;
  appearance: string;           // 外貌描述
  personality: string;          // 性格特点
  role: string;                // 角色定位：主角/配角/反派
}
```

**Hermes 触发**：剧本节点完成后 → 自动触发分镜节点

---

### 2.2 分镜节点 (StoryboardNode)

```
输入：ScriptScene[]
输出：StoryboardShot[]
处理：每个Scene展开为多个Shot，调用LLM生成visual prompt
```

```typescript
interface StoryboardNodeData {
  // 输入（连接ScriptNode）
  inputScenes: ScriptScene[];

  // 配置
  shotsPerScene: number;        // 每场景镜头数
  defaultShotDuration: number; // 默认镜头时长(秒)

  // 输出
  shots: StoryboardShot[];
  status: 'idle' | 'generating' | 'completed' | 'error';
}
```

**关键逻辑**：
- 每个 ScriptScene 展开为 N 个 StoryboardShot
- 每个 Shot 自动生成 `visualPrompt`（用于 Seedance）
- Hermes 自动为每个 Shot 调度后续图生和视频节点

---

### 2.3 图生节点 (ImageGenNode)

```
输入：图片描述prompt + 参考图（可选）
输出：图片asset
调用：Seedream 5.0 API
```

```typescript
interface ImageGenNodeData {
  // 输入
  prompt: string;               // 图片描述
  negativePrompt?: string;     // 负面描述
  referenceImages: AssetRef[];  // 参考图(≤4张)
  style?: ImageStyle;

  // 配置
  model: 'seedream-5.0' | 'seedream-5.0-lite';
  resolution: '1024x1024' | '1536x1024' | '1024x1536' | '2048x2048';
  seed?: number;               // 随机种子

  // 输出
  outputAssetId?: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
}

type ImageStyle =
  | 'realistic'      // 写实
  | 'anime'          // 动漫
  | 'oil_painting'   // 油画
  | 'watercolor'     // 水彩
  | 'cyberpunk'      // 赛博朋克
  | 'fantasy'        // 奇幻
  | 'custom';        // 自定义
```

**Hermes 触发**：分镜节点完成后，为每个需要参考图的 Shot 自动触发

---

### 2.4 视频节点 (VideoShotNode)

```
输入：visual prompt + 参考图/视频/音频
输出：视频片段(4-15s)
调用：Seedance 2.0 API
```

```typescript
interface VideoShotNodeData {
  // 输入
  prompt: string;               // 画面描述
  shotType: ShotType;          // 镜头类型
  cameraMovement: CameraMovement; // 运镜

  // 参考素材（Seedance @语法）
  referenceImages: AssetRef[]; // ≤9张
  referenceVideos: AssetRef[];  // ≤3个
  referenceAudios: AssetRef[]; // ≤3个

  // 配置
  model: 'seedance-2.0' | 'seedance-2.0-fast';
  duration: number;             // 4-15秒
  resolution?: '720p' | '1080p';

  // 状态
  status: ShotStatus;
  progress?: number;            // 0-100
  seedanceJobId?: string;        // 即梦任务ID
  outputAssetId?: string;        // 生成的视频assetId
  errorMessage?: string;
}
```

**Seedance API 调用格式**（推断）：
```
prompt: "女孩在优雅的晒衣服，晒完接着在桶里拿出另一件，用力抖一抖衣服"
images: [asset1, asset2, ...]  // @图1, @图2
videos: [refVideo1, ...]       // @视频1 - 参考运镜
audios: [bgm1, ...]            // @音频1 - 配乐
duration: 5
```

---

### 2.5 时间线节点 (TimelineNode)

```
输入：多个VideoShotNode的输出
输出：拼接后的完整视频
调用：FFmpeg concat
```

```typescript
interface TimelineNodeData {
  // 输入（连接所有VideoShotNode）
  shotIds: string[];            // 视频片段节点ID列表

  // 配置
  transition: TransitionType;  // 片段间转场
  outputFormat: OutputFormat;

  // 音轨（可选）
  backgroundMusic?: AssetRef;
  voiceover?: AssetRef;
  soundEffects?: AssetRef[];

  // 输出
  outputAssetId?: string;
  status: 'idle' | 'concatenating' | 'completed' | 'error';
}

type TransitionType =
  | 'cut'           // 硬切
  | 'fade'          // 淡入淡出
  | 'dissolve'      // 叠化
  | 'wipe';         // 划像

type OutputFormat =
  | 'mp4'           // H.264
  | 'mov'           // ProRes
  | 'webm';         // VP9
```

---

### 2.6 辅助节点

```typescript
/** 角色设定节点 */
interface CharacterNodeData {
  character: CharacterDef;
  avatarAssetId?: string;        // 角色头像
  styleReferenceAssetId?: string; // 风格参考
}

/** 素材导入节点 */
interface MediaImportNodeData {
  filePath: string;
  type: AssetType;
  importedAssetId?: string;
}

/** 音效/配乐节点 */
interface AudioNodeData {
  audioType: AudioNodeType;
  source: 'import' | 'tts';

  // 导入模式
  importPath?: string;

  // TTS模式
  ttsText?: string;
  ttsVoice?: string;
  ttsSpeed?: number;              // 语速 0.5-2.0
  ttsModel?: string;              // TTS模型

  // 输出
  outputAssetId?: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
}

type AudioNodeType =
  | 'bgm'            // 背景音乐
  | 'sfx'            // 音效
  | 'voiceover'       // 旁白/配音
  | 'dialogue';       // 对白（TTS生成角色对话）

/** 旁白/配音节点（简化版） */
interface VoiceoverNodeData {
  text: string;                   // 配音文本
  characterId?: string;           // 对应角色
  voice: string;                  // 音色选择
  speed: number;                  // 语速
  outputAssetId?: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
}

/** 文字节点 */
interface TextNodeData {
  text: string;
  font?: string;
  color?: string;
  position?: { x: number; y: number };
  animation?: TextAnimation;
}
```

---

## 三、画布节点定义（TypeScript）

```typescript
// src/components/nodes/types.ts

import { Node } from '@xyflow/react';

export type CanvasNodeType =
  | 'script'           // 剧本节点
  | 'storyboard'       // 分镜节点
  | 'imageGen'         // 图生节点
  | 'videoShot'        // 视频节点
  | 'timeline'         // 时间线节点
  | 'character'        // 角色节点
  | 'mediaImport'      // 素材导入
  | 'audio'            // 音频节点（背景音乐/音效/TTS）
  | 'voiceover'        // 配音节点
  | 'text'             // 文字节点
  | 'group';           // 分组

export interface BaseNodeData {
  status: NodeStatus;
  lastUpdated?: string;
  errorMessage?: string;
}

export type NodeStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'error'
  | 'waiting';

export type CanvasNode = Node<
  BaseNodeData &
    (ScriptNodeData | StoryboardNodeData | ImageGenNodeData |
     VideoShotNodeData | TimelineNodeData | CharacterNodeData |
     MediaImportNodeData | AudioNodeData | VoiceoverNodeData | TextNodeData),
  CanvasNodeType
>;
```

---

## 四、数据流与节点连线

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              无限画布                                          │
│                                                                               │
│  ┌─────────────┐                                                              │
│  │ ScriptNode  │  theme + characters                                          │
│  │   剧本节点   │──────┐                                                       │
│  └─────────────┘      │ scenes[]                                              │
│                       ▼                                                       │
│              ┌─────────────────┐                                              │
│              │ StoryboardNode  │  shotsPerScene                                │
│              │   分镜节点      │──────┬                                       │
│              └─────────────────┘      │ shots[]                                │
│                                      ▼                                         │
│         ┌─────────────────────────────────────────────────────┐                │
│         │              Shot #1                                │                │
│         │  ┌─────────────┐    ┌─────────────┐                │                │
│         │  │ImageGenNode │───▶│VideoShotNode│                │                │
│         │  │  (Seedream) │    │ (Seedance)  │                │                │
│         │  └─────────────┘    └──────┬──────┘                │                │
│         └────────────────────────────┼────────────────────────┘                │
│                                      │                                        │
│  ┌─────────────┐                      │                                        │
│  │ AudioNode   │──────────────────────┤ referenceAudios[]                     │
│  │ (TTS/导入)  │                      │                                        │
│  └─────────────┘                      ▼                                        │
│                                      │                                        │
│         ┌─────────────────────────────────────────────────────┐                 │
│         │              Shot #2                                │  ...             │
│         │  ┌─────────────┐    ┌─────────────┐                │                 │
│         │  │ImageGenNode │───▶│VideoShotNode│                │                 │
│         │  └─────────────┘    └──────┬──────┘                │                 │
│         └────────────────────────────┼────────────────────────┘                 │
│                                      │                                          │
│                                      ▼                                          │
│                           ┌─────────────────┐                                   │
│                           │  TimelineNode   │                                   │
│                           │   时间线节点    │                                   │
│                           │                 │                                   │
│                           │  + AudioNode    │──────▶ 完整视频+音轨             │
│                           │   (BGM/旁白)    │                                   │
│                           └─────────────────┘                                   │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

**连线规则**：
- ScriptNode → StoryboardNode（数据：scenes[]）
- StoryboardNode → ImageGenNode（每个Shot一张参考图）
- StoryboardNode → VideoShotNode（每个Shot一个视频）
- ImageGenNode → VideoShotNode（参考图作为@图1输入）
- 多个VideoShotNode → TimelineNode（拼接）

---

## 五、Seedance @语法适配层

```typescript
// src/lib/seedance/promptBuilder.ts

interface SeedancePromptInput {
  prompt: string;
  referenceImages: AssetRef[];   // ≤9张
  referenceVideos: AssetRef[];   // ≤3个
  referenceAudios: AssetRef[];  // ≤3个
}

/**
 * 构建Seedance API的prompt
 * 将 @图1、@视频1 等引用展开为实际asset
 */
function buildSeedancePrompt(input: SeedancePromptInput): {
  prompt: string;           // 含@引用的完整prompt
  images: string[];         // base64或URL列表
  videos: string[];         // 视频文件路径
  audios: string[];         // 音频文件路径
} {
  const { prompt, referenceImages, referenceVideos, referenceAudios } = input;

  const imageList: string[] = [];
  const videoList: string[] = [];
  const audioList: string[] = [];

  // 替换 @图1 -> 实际图片
  let expandedPrompt = prompt;
  referenceImages.forEach((ref, idx) => {
    const asset = getAsset(ref.assetId);
    if (asset) {
      imageList.push(asset.path);
      expandedPrompt = expandedPrompt.replace(
        `@图${idx + 1}`,
        ref.role === 'first_frame' ? '首帧图' :
        ref.role === 'style_ref' ? '风格参考' : ''
      );
    }
  });

  // 替换 @视频1 -> 实际视频
  referenceVideos.forEach((ref, idx) => {
    const asset = getAsset(ref.assetId);
    if (asset) {
      videoList.push(asset.path);
      expandedPrompt = expandedPrompt.replace(`@视频${idx + 1}`, '参考视频');
    }
  });

  // 替换 @音频1 -> 实际音频
  referenceAudios.forEach((ref, idx) => {
    const asset = getAsset(ref.assetId);
    if (asset) {
      audioList.push(asset.path);
      expandedPrompt = expandedPrompt.replace(`@音频${idx + 1}`, '参考音频');
    }
  });

  return {
    prompt: expandedPrompt,
    images: imageList,
    videos: videoList,
    audios: audioList,
  };
}
```

---

## 六、节点状态转换

```
                    ┌─────────────┐
                    │    idle     │  初始状态
                    └──────┬──────┘
                           │ 用户触发/Hermes触发
                           ▼
                    ┌─────────────┐
          ┌────────▶│  running    │  执行中
          │         └──────┬──────┘
          │                │ 成功
          │                ▼
          │         ┌─────────────┐
          │         │  completed  │──────────┐
          │         └─────────────┘          │
          │                                   │ Hermes监听
          │                                   ▼
          │                          ┌─────────────┐
          │                          │   waiting   │  等待下游节点
          │                          └─────────────┘
          │
          │ 失败(retry < maxRetries)
          │
          └──────────────────────────▶
                    ▲
                    │
              ┌─────┴─────┐
              │   error   │──── 重试 ────▶ running
              └───────────┘    (maxRetries后)
```

---

## 七、错误处理与重试

```typescript
interface NodeRetryConfig {
  maxRetries: number;           // 最大重试次数
  retryDelayMs: number;         // 重试间隔
  backoffMultiplier: number;    // 退避倍数
}

const DEFAULT_RETRY_CONFIG: NodeRetryConfig = {
  maxRetries: 3,
  retryDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Hermes Agent 错误处理策略
 */
class HermesErrorHandler {
  handleNodeError(nodeId: string, error: Error, nodeType: CanvasNodeType) {
    switch (nodeType) {
      case 'videoShot':
        // 视频生成失败：尝试简化prompt
        if (error.message.includes('内容违规')) {
          return this.sanitizeAndRetry(nodeId, error);
        }
        // API超时：等待后重试
        return this.retryWithBackoff(nodeId, error);

      case 'imageGen':
        // 图片生成失败：尝试更换风格
        return this.retryWithDifferentStyle(nodeId, error);

      case 'script':
      case 'storyboard':
        // LLM生成失败：直接重试
        return this.retryWithBackoff(nodeId, error);

      default:
        return this.retryWithBackoff(nodeId, error);
    }
  }

  private sanitizeAndRetry(nodeId: string, error: Error) {
    // 移除可能违规的描述词，使用更中性的表达
    const node = getNode(nodeId);
    const sanitizedPrompt = sanitizeContent(node.data.prompt);
    updateNodeData(nodeId, { prompt: sanitizedPrompt });
    return triggerNode(nodeId);
  }
}
```

---

## 八、文件结构建议

```
src/
├── components/
│   └── nodes/
│       ├── ScriptNode.tsx
│       ├── StoryboardNode.tsx
│       ├── ImageGenNode.tsx
│       ├── VideoShotNode.tsx
│       ├── TimelineNode.tsx
│       ├── CharacterNode.tsx
│       ├── MediaImportNode.tsx
│       ├── AudioNode.tsx
│       ├── VoiceoverNode.tsx
│       └── types.ts                 # 节点类型定义
│
├── lib/
│   ├── seedance/
│   │   ├── api.ts                   # Seedance API调用
│   │   ├── promptBuilder.ts          # @语法适配
│   │   └── types.ts                 # Seedance类型
│   │
│   ├── seedream/
│   │   ├── api.ts                   # Seedream API调用
│   │   └── types.ts                 # Seedream类型
│   │
│   ├── tts/
│   │   ├── api.ts                   # TTS API调用
│   │   └── types.ts                 # TTS类型
│   │
│   ├── nodes/
│   │   ├── executor.ts              # 节点执行器
│   │   ├── stateMachine.ts          # 状态机
│   │   └── retry.ts                 # 重试逻辑
│   │
│   └── hermes/
│       ├── agent.ts                 # Hermes主Agent
│       ├── eventHandler.ts          # 事件处理
│       ├── autoChain.ts             # 自动串联逻辑
│       └── errorHandler.ts          # 错误处理
│
├── store/
│   ├── projectStore.ts             # 工程状态
│   ├── nodeStore.ts                # 节点状态
│   └── assetStore.ts               # 资产状态
│
└── types/
    ├── scene.ts                    # ScriptScene, StoryboardShot
    ├── asset.ts                    # Asset, AssetRef
    └── workflow.ts                 # 工作流类型
```

---

## 九、下一步行动

1. **实现 Seedance API 适配层**（`src/lib/seedance/api.ts`）
   - 连接真实 API
   - 实现 `@语法` 解析（@图1、@视频1、@音频1）
   - 处理轮询和结果获取

2. **实现 Seedream API 适配层**（`src/lib/seedream/api.ts`）
   - 图生图 API 调用
   - 进度回调

3. **实现 TTS API 适配层**（`src/lib/tts/api.ts`）
   - 文字转语音 API 调用
   - 音色选择和语速控制
   - 支持作为 VideoShotNode 的参考音频

4. **重写 VideoShotNode 执行逻辑**
   - 连接 `seedance/api.ts`
   - 支持 referenceAudios[] 参考音频
   - 实现状态更新和完成回调

5. **实现 Hermes 自动串联**
   - 监听节点完成事件
   - 自动触发下游节点（Storyboard → ImageGen + VideoShot）
   - 处理错误和重试

6. **完善 TimelineNode**
   - FFmpeg 拼接视频片段
   - 混音：BGM + 旁白 + 音效
   - 预览播放
