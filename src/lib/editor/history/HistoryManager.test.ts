import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HistoryManager } from './HistoryManager';
import { Command } from './types';

// Mock Command for testing
class MockCommand implements Command {
  execute = vi.fn();
  undo = vi.fn();
}

describe('HistoryManager', () => {
  let history: HistoryManager;
  let onUpdateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUpdateMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history = new HistoryManager(onUpdateMock as any);
  });

  it('should initialize with empty stacks', () => {
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it('should execute a command and push to undo stack', async () => {
    const command = new MockCommand();
    await history.execute(command);

    expect(command.execute).toHaveBeenCalledTimes(1);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(onUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('should push a command without executing (for already executed actions)', () => {
    const command = new MockCommand();
    history.push(command);

    expect(command.execute).not.toHaveBeenCalled();
    expect(history.canUndo).toBe(true);
    expect(onUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('should undo the last command', async () => {
    const command = new MockCommand();
    history.push(command);

    await history.undo();

    expect(command.undo).toHaveBeenCalledTimes(1);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
    expect(onUpdateMock).toHaveBeenCalledTimes(2); // 1 for push, 1 for undo
  });

  it('should redo the last undone command', async () => {
    const command = new MockCommand();
    history.push(command);
    await history.undo();

    await history.redo();

    expect(command.execute).toHaveBeenCalledTimes(1); // Once during redo
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(onUpdateMock).toHaveBeenCalledTimes(3); // push, undo, redo
  });

  it('should clear redo stack when a new command is pushed', async () => {
    const command1 = new MockCommand();
    const command2 = new MockCommand();

    history.push(command1);
    await history.undo();

    expect(history.canRedo).toBe(true);

    history.push(command2);

    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false); // Redo stack should be cleared
  });

  it('should clear all stacks', () => {
    const command = new MockCommand();
    history.push(command);
    history.clear();

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(onUpdateMock).toHaveBeenCalled();
  });
});
