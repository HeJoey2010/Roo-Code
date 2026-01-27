
import { query } from '@anthropic-ai/claude-agent-sdk';
import { spawn } from 'child_process';

const targetDir =  process.cwd();
interface ClaudeOptions {
  cwd?: string;
  message?: string;
  args?: string[];
  skipPermissions?: boolean;
  useNpx?: boolean;
  onData?: (data: string) => void;   // 实时 stdout 回调
  onError?: (data: string) => void;  // 实时 stderr 回调
  onExit?: (code: number | null) => void;
}



  export function handleClaude(options: ClaudeOptions = {}): void {
  const {
    cwd = process.cwd(),
    message,
    args = [],
    skipPermissions = true,
    useNpx = false,
    onData,
    onError,
    onExit
  } = options;

  const cmd = useNpx ? 'npx' : 'claude';
  const baseArgs = useNpx ? ['@anthropic-ai/claude'] : [];
  
  const spawnArgs = [
    ...baseArgs,
    ...(skipPermissions ? ['--dangerously-skip-permissions'] : []),
    ...args,
    ...(message ? [message] : [])
  ];

  console.log(`[执行] ${cmd} ${spawnArgs.join(' ')}`);

  const child = spawn(cmd, spawnArgs, {
    cwd,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']  // 改为 pipe 以便监听
  });

  // 监听标准输出
  child.stdout.on('data', (data: Buffer) => {
    const output = data.toString();
    process.stdout.write(output);  // 实时显示到控制台
    onData?.(output);              // 回调给调用方
  });

  // 监听错误输出
  child.stderr.on('data', (data: Buffer) => {
    const error = data.toString();
    process.stderr.write(error);   // 实时显示错误
    onError?.(error);             // 回调给调用方
  });

  // 进程结束
  child.on('close', (code) => {
    console.log(`\n[进程退出] 退出码: ${code}`);
    onExit?.(code);
  });

  // 进程错误（启动失败等）
  child.on('error', (err) => {
    console.error('[启动失败]', err.message);
    onError?.(err.message);
  });

  // 如果有 message，通过 stdin 发送（避免命令行截断问题）
  if (message) {
    child.stdin.write(message);
    child.stdin.end();
  }
}

 export function handleClaudeAsync(options: Omit<ClaudeOptions, 'onData' | 'onError' | 'onExit'> = {}): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
}> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    handleClaude({
      ...options,
      onData: (data) => {
        stdout += data;
      },
      onError: (data) => {
        stderr += data;
      },
      onExit: (code) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code
        });
      }
    });
  });
}

/**
 * 基础示例函数 - 返回收集的文本结果
 */
export async function basicExample(): Promise<string> {
  const response = await query({
    prompt: `你是谁`,
    options: {
      cwd: targetDir,
      permissionMode: 'bypassPermissions',
      allowedTools: ['Bash', 'Read', 'Edit', 'Write'],
    },
  });

  let fullText = '';
  
  for await (const msg of response) {
    if (msg.type === 'assistant') {
      const content = msg.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            const text = block.text;
            fullText += text;
            process.stdout.write(text);
          }
        }
      }
    }
  }
  
  return fullText;
}

/**
 * 带回调的示例函数 - 允许实时处理流式输出
 */
export async function basicExampleWithCallback(
  onText?: (text: string) => void,
  onComplete?: (fullText: string) => void
): Promise<string> {
  const response = await query({
    prompt: `你是谁`,
    options: {
      cwd: targetDir,
      permissionMode: 'bypassPermissions',
      allowedTools: ['Bash', 'Read', 'Edit', 'Write'],
    },
  });

  let fullText = '';
  
  for await (const msg of response) {
    if (msg.type === 'assistant') {
      const content = msg.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            const text = block.text;
            fullText += text;
            
            // 调用回调函数处理实时文本
            if (onText) {
              onText(text);
            }
            
            // 同时输出到控制台
            process.stdout.write(text);
          }
        }
      }
    }
  }
  
  // 完成后调用回调
  if (onComplete) {
    onComplete(fullText);
  }
  
  return fullText;
}

// 移除自动执行，改为按需调用
// basicExample().catch(console.error);