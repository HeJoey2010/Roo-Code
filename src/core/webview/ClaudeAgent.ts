

import { spawn } from 'child_process';
import { getWorkspacePath } from '../../utils/path';
const DEFAULT_CWD = getWorkspacePath() ?? process.cwd()

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
    cwd = DEFAULT_CWD,
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

