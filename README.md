# AI Chat Demo

基于 Vue 3、TypeScript、Vite 和 Pinia 的 AI 对话交互演示，覆盖流式对话、工具调用、RAG 知识库、多会话管理和工作流可视化。

## 启动

```bash
npm install
npm run dev
```

不配置 API Key 时，应用自动进入本地演示模式，可体验模拟流式回复、天气和计算工具、知识库检索、Token 统计及工作流高亮，不依赖外部服务。

如需连接 OpenAI 兼容接口，在本地 `.env.local` 中配置：

```dotenv
VITE_API_KEY=your-api-key
VITE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
VITE_MODEL=qwen-plus
```

Vite 的 `VITE_*` 变量会打包到浏览器端，仅适合本地演示或临时测试。正式部署时不要将私密 API Key 放进前端构建产物；应通过服务端代理调用模型接口。

## 演示功能

- SSE 流式回复、Markdown 渲染和代码块语法高亮；AI 回复期间显示加载状态，超时或断网时显示失败原因并可在原消息上重试；长对话超过 50 条消息时启用虚拟滚动。
- 天气查询与安全数学表达式计算，展示工具参数、状态、结果和耗时；配置 API Key 后由模型选择工具并完成结果回传。
- 可切换的本地 RAG 检索，演示知识库位于 `src/data/knowledge.json`，包含 8 条制度和规范示例。
- 多会话新建、切换、删除、自动标题和 JSON 导出；会话内容保存在浏览器 `localStorage`。
- Vue Flow 工具调用工作流可视化，以及每轮和累计 Token 统计、响应耗时。

## 构建

```bash
npm run build
```
