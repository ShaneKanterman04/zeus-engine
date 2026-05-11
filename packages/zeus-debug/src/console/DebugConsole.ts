export type DebugCommandResult = {
  ok: boolean;
  output: string;
};

export type DebugCommandContext = Record<string, unknown>;

export type DebugCommand = {
  name: string;
  description: string;
  args?: string;
  run(args: string[], context: DebugCommandContext): DebugCommandResult;
};

export class DebugConsole {
  private readonly commands = new Map<string, DebugCommand>();

  register(command: DebugCommand) {
    if (this.commands.has(command.name)) throw new Error(`Debug command already registered: ${command.name}`);
    this.commands.set(command.name, command);
  }

  execute(input: string, context: DebugCommandContext = {}): DebugCommandResult {
    const [name, ...args] = input.trim().split(/\s+/).filter(Boolean);
    if (!name) return { ok: false, output: "No command provided" };
    const command = this.commands.get(name);
    if (!command) return { ok: false, output: `Unknown command: ${name}` };
    try {
      return command.run(args, context);
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : String(error) };
    }
  }

  list() {
    return [...this.commands.values()].map(({ name, description, args }) => ({ name, description, args }));
  }
}
