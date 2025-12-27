export interface Command {
  execute(): Promise<void> | void
  undo(): Promise<void> | void
}
