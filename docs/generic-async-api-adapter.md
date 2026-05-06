# 通用异步任务 API 适配器（可复用）

用于接入“提交任务 -> 轮询结果”的第三方接口。  
你只需按接口文档填写 URL / Header / Body / JSON 路径，不必改代码。

## 命令 1：提交任务

`generic_async_api_submit`

请求参数（示例）：

```json
{
  "req": {
    "url": "https://api.example.com/submit",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer <token>",
      "Content-Type": "application/json"
    },
    "body": {
      "prompt": "一只奔跑的猫"
    },
    "taskIdPointer": "/data/task_id"
  }
}
```

返回：

```json
{
  "taskId": "123456",
  "raw": { "...": "原始响应 JSON" }
}
```

## 命令 2：查询任务

`generic_async_api_poll`

请求参数（示例）：

```json
{
  "req": {
    "url": "https://api.example.com/result",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer <token>",
      "Content-Type": "application/json"
    },
    "body": {
      "task_id": "123456"
    },
    "statusPointer": "/data/status",
    "doneValue": "done",
    "resultUrlPointer": "/data/video_url",
    "errorPointer": "/message"
  }
}
```

返回：

```json
{
  "status": "generating",
  "done": false,
  "resultUrl": null,
  "error": null,
  "raw": { "...": "原始响应 JSON" }
}
```

## 路径规则（JSON Pointer）

- 使用 `/a/b/c` 的形式取值（RFC6901）
- 例如：
  - `taskIdPointer: /data/task_id`
  - `statusPointer: /data/status`
  - `resultUrlPointer: /data/video_url`

## 注意事项

- 这个适配器适合大多数“Token/Bearer 鉴权”的异步接口。
- 若厂商要求复杂签名（如火山云某些 CV 接口的 Region/Service 签名），仍需要额外签名逻辑。
- 若接口是 GET 请求，可把 `method` 设为 `GET`（GET 下不会发送 `body`）。
