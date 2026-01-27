import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { executeCommandInTerminal, ExecuteCommandOptions } from "./ExecuteCommandTool"

interface ExecuteClaudeCommandParams {
	message: string
}

export class ExecuteClaudeCommandTool extends BaseTool<"execute_claude_command"> {
	readonly name = "execute_claude_command" as const

	parseLegacy(params: Partial<Record<string, string>>): ExecuteClaudeCommandParams {
		return {
			message: params.message || "",
		}
	}

	async execute(params: ExecuteClaudeCommandParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult, handleError, askApproval, toolProtocol } = callbacks
		const { message } = params

		try {
			if (!message) {
				task.consecutiveMistakeCount++
				task.recordToolError("execute_claude_command")
				pushToolResult(await task.sayAndCreateMissingParamError("execute_claude_command", "message"))
				return
			}

			task.consecutiveMistakeCount = 0

			// 构建 claude -p 命令
			const command = `claude -p --dangerously-skip-permissions '${message}'`

			// 请求用户批准
			const didApprove = await askApproval("command", command)

			if (!didApprove) {
				return
			}

			// 执行命令
			const executionId = task.lastMessageTs?.toString() ?? Date.now().toString()
			const options: ExecuteCommandOptions = {
				executionId,
				command,
				terminalShellIntegrationDisabled: true,
				terminalOutputLineLimit: 500,
				terminalOutputCharacterLimit: 500000,
				commandExecutionTimeout: 0,
			}

			try {
				const [rejected, result] = await executeCommandInTerminal(task, options)

				if (rejected) {
					task.didRejectTool = true
				}

				pushToolResult(result)
			} catch (error: unknown) {
				pushToolResult(`Claude command failed to execute: ${error instanceof Error ? error.message : String(error)}`)
			}

			return
		} catch (error) {
			await handleError("executing claude command", error as Error)
			return
		}
	}

	override async handlePartial(task: Task, block: any): Promise<void> {
		const message = block.params.message
		if (message) {
			await task.ask("command", `claude -p '${message}'`, block.partial).catch(() => {})
		}
	}
}

export const executeClaudeCommandTool = new ExecuteClaudeCommandTool()