"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveFileMonitorStatus = "idle" | "monitoring" | "paused" | "handle-lost" | "fallback";

export type SaveFileMonitorState = {
  status: SaveFileMonitorStatus;
  parsing: boolean;
  lastRefreshTime: Date | null;
  lastCheckTime: Date | null;
  lastError: string | null;
  fileName: string | null;
  refreshCount: number;
};

type TimerHandle = ReturnType<typeof globalThis.setInterval>;

type MonitorOptions = {
  intervalMs?: number;
  now?: () => Date;
  setInterval?: (callback: () => void, delay: number) => TimerHandle;
  clearInterval?: (handle: TimerHandle) => void;
};

const INITIAL_STATE: SaveFileMonitorState = {
  status: "idle",
  parsing: false,
  lastRefreshTime: null,
  lastCheckTime: null,
  lastError: null,
  fileName: null,
  refreshCount: 0,
};

const signatureOf = (file: File) => `${file.lastModified}:${file.size}`;

export const isPickerCancellation = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export class SaveFileMonitorCore {
  private state: SaveFileMonitorState = { ...INITIAL_STATE };
  private handle: FileSystemFileHandle | null = null;
  private successfulSignature: string | null = null;
  private timer: TimerHandle | null = null;
  private userPaused = false;
  private visible = true;
  private busy = false;
  private readonly intervalMs: number;
  private readonly now: () => Date;
  private readonly startTimer: (callback: () => void, delay: number) => TimerHandle;
  private readonly stopTimer: (handle: TimerHandle) => void;
  private onFileRead: (buffer: ArrayBuffer, file: File) => Promise<void>;
  private readonly onStateChange: (state: SaveFileMonitorState) => void;

  constructor(
    onFileRead: (buffer: ArrayBuffer, file: File) => Promise<void>,
    onStateChange: (state: SaveFileMonitorState) => void,
    options: MonitorOptions = {},
  ) {
    this.onFileRead = onFileRead;
    this.onStateChange = onStateChange;
    this.intervalMs = options.intervalMs ?? 30_000;
    this.now = options.now ?? (() => new Date());
    this.startTimer = options.setInterval ?? ((callback, delay) => globalThis.setInterval(callback, delay));
    this.stopTimer = options.clearInterval ?? ((handle) => globalThis.clearInterval(handle));
  }

  getSnapshot() {
    return this.state;
  }

  setOnFileRead(onFileRead: (buffer: ArrayBuffer, file: File) => Promise<void>) {
    this.onFileRead = onFileRead;
  }

  async selectHandle(handle: FileSystemFileHandle) {
    this.stopPolling();
    this.handle = handle;
    this.successfulSignature = null;
    this.userPaused = false;
    this.patch({ status: "monitoring", fileName: handle.name, lastError: null });
    await this.check(true);
    this.startPollingIfNeeded();
  }

  async refresh() {
    await this.check(true);
  }

  pause() {
    if (!this.handle || this.state.status === "handle-lost") return;
    this.userPaused = true;
    this.stopPolling();
    this.patch({ status: "paused" });
  }

  resume() {
    if (!this.handle || this.state.status === "handle-lost") return;
    this.userPaused = false;
    this.patch({ status: this.visible ? "monitoring" : "paused" });
    this.startPollingIfNeeded();
  }

  setVisibility(visible: boolean) {
    this.visible = visible;
    if (!this.handle || this.state.status === "handle-lost") return;
    if (!visible) {
      this.stopPolling();
      if (!this.userPaused) this.patch({ status: "paused" });
      return;
    }
    if (this.userPaused) return;
    this.patch({ status: "monitoring" });
    void this.check(false);
    this.startPollingIfNeeded();
  }

  dispose() {
    this.stopPolling();
  }

  private async check(force: boolean) {
    if (!this.handle || this.busy || this.state.status === "handle-lost") return;
    this.busy = true;
    this.patch({ parsing: true });
    let gettingFile = true;
    try {
      const file = await this.handle.getFile();
      gettingFile = false;
      this.patch({ lastCheckTime: this.now(), fileName: file.name });
      const signature = signatureOf(file);
      if (!force && signature === this.successfulSignature) {
        this.patch({ lastError: null });
        return;
      }
      const buffer = await file.arrayBuffer();
      await this.onFileRead(buffer, file);
      this.successfulSignature = signature;
      this.patch({
        lastRefreshTime: this.now(),
        lastError: null,
        refreshCount: this.state.refreshCount + 1,
      });
    } catch (error) {
      if (gettingFile && error instanceof DOMException && error.name === "NotFoundError") {
        this.stopPolling();
        this.patch({ status: "handle-lost", lastError: "存档文件句柄已失效，请重新选择文件" });
      } else {
        this.patch({ lastError: "本轮读取失败，下个周期自动重试" });
      }
    } finally {
      this.busy = false;
      this.patch({ parsing: false });
    }
  }

  private startPollingIfNeeded() {
    if (this.timer || !this.handle || this.userPaused || !this.visible || this.state.status !== "monitoring") return;
    this.timer = this.startTimer(() => void this.check(false), this.intervalMs);
  }

  private stopPolling() {
    if (!this.timer) return;
    this.stopTimer(this.timer);
    this.timer = null;
  }

  private patch(update: Partial<SaveFileMonitorState>) {
    this.state = { ...this.state, ...update };
    this.onStateChange(this.state);
  }
}

export function useSaveFileMonitor(
  onFileRead: (buffer: ArrayBuffer, file: File) => Promise<void>,
) {
  const [state, setState] = useState<SaveFileMonitorState>(INITIAL_STATE);
  const [core] = useState(() => new SaveFileMonitorCore(onFileRead, setState));
  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const isSupported = typeof window === "undefined" ? null : "showOpenFilePicker" in window;

  useEffect(() => core.setOnFileRead(onFileRead), [core, onFileRead]);

  useEffect(() => {
    const onVisibilityChange = () => core.setVisibility(document.visibilityState === "visible");
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      handleRef.current = null;
      core.dispose();
    };
  }, [core]);

  const pickFile = useCallback(async () => {
    if (!("showOpenFilePicker" in window)) return;
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{
          description: "Palworld 存档",
          accept: { "application/octet-stream": [".sav"], "application/json": [".json"] },
        }],
      });
      if (handle) {
        handleRef.current = handle;
        await core.selectHandle(handleRef.current);
      }
    } catch (error) {
      if (!isPickerCancellation(error)) console.error("Save file picker failed", error);
    }
  }, [core]);

  return {
    ...state,
    status: isSupported === false ? "fallback" as const : state.status,
    isSupported,
    pickFile,
    refresh: useCallback(() => core.refresh(), [core]),
    pause: useCallback(() => core.pause(), [core]),
    resume: useCallback(() => core.resume(), [core]),
  };
}
