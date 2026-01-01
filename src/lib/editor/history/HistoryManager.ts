import { Command } from "./types"

export class HistoryManager {
  private undoStack: Command[] = []
  private redoStack: Command[] = []

  // Callback to notify UI of stack changes (e.g. for disabling Undo button)
  private onUpdate?: () => void

  constructor(onUpdate?: () => void) {
    this.onUpdate = onUpdate
  }

  async execute(command: Command) {
    // Execute the command first
    // Note: Some designs execute before passing to history, others execute inside.
    // We assume the command logic includes the action.
    // However, if the action corresponds to a user drag, it's already "executed" by the user interaction.
    // For now, we'll support explicit execution for programmatic actions (like "Align Left").
    // For user interactions (Move), we might just push the command.
    // Let's standardise: execute() is called by the manager for new commands?
    // Usually for "Move", the move happened. The command captures the *before* and *after* state.
    // So "execute" might just be "redo".

    // Simplification: We push "completed" actions.
    await command.execute()
    this.push(command)
  }

  push(command: Command) {
    console.log(
      "[HistoryManager] push() called, command:",
      command.constructor.name
    )
    this.undoStack.push(command)
    this.redoStack = [] // Clear redo on new divergence
    console.log(
      "[HistoryManager] undoStack length after push:",
      this.undoStack.length
    )
    this.notify()
  }

  async undo() {
    console.log(
      "[HistoryManager] undo() called, undoStack length:",
      this.undoStack.length
    )
    const command = this.undoStack.pop()
    if (command) {
      console.log(
        "[HistoryManager] Executing undo on command:",
        command.constructor.name
      )
      await command.undo()
      this.redoStack.push(command)
      this.notify()
    } else {
      console.log("[HistoryManager] No command to undo")
    }
  }

  async redo() {
    const command = this.redoStack.pop()
    if (command) {
      await command.execute()
      this.undoStack.push(command)
      this.notify()
    }
  }

  clear() {
    this.undoStack = []
    this.redoStack = []
    this.notify()
  }

  get canUndo() {
    return this.undoStack.length > 0
  }

  get canRedo() {
    return this.redoStack.length > 0
  }

  private notify() {
    if (this.onUpdate) {
      this.onUpdate()
    }
  }
}
