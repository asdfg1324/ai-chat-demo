export interface ToolCall {
    id: number;
    apiCallId?: string;
    name: string;
    label: string;
    params: Record<string, any>;
    result: any;
    // 必须包含这四个字面量，否则 running/success 赋值会被 TS 拦截
    status: 'pending' | 'running' | 'success' | 'error';
    startTime: number;
    duration: string;
  }