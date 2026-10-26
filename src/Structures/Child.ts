import { spawn, Spawn, Subprocess } from 'bun';
import { Serializable } from 'child_process';
import { EventEmitter } from 'events';

export interface ChildProcessOptions {
    clusterData: NodeJS.ProcessEnv | undefined;
    args?: string[] | undefined;
    cwd?: string;
    detached?: boolean;
    /** Runtime flags passed before the cluster file, e.g. `--smol`. V8 flags have no effect on Bun. */
    execArgv?: string[];
    env?: Record<string, unknown>;
    /** Defaults to the current Bun executable. */
    execPath?: string;
    gid?: number;
    uid?: number;
    /**
     * `json` (default) matches child_process.fork and calls `toJSON()`, which discord.js structures rely on.
     * `advanced` uses structured clone: keeps Map/Date/BigInt, but drops getters and manager caches of discord.js objects.
     */
    serialization?: 'json' | 'advanced';
    signal?: AbortSignal;
    killSignal?: string | number;
    /** Pipe stdio to the manager instead of inheriting it. */
    silent?: boolean;
    stdio?: [Spawn.Writable, Spawn.Readable, Spawn.Readable];
    timeout?: number;
    windowsHide?: boolean;
    windowsVerbatimArguments?: boolean;
}

export class Child extends EventEmitter {
    file: string;
    process: Subprocess | null;
    processOptions: Omit<ChildProcessOptions, 'clusterData' | 'args'>;
    args?: string[];
    constructor(file: string, options: ChildProcessOptions) {
        super();
        this.file = file;
        this.process = null;

        this.processOptions = {};

        // Custom options
        if (options.clusterData) this.processOptions.env = options.clusterData;

        if (options.args) this.args = options.args;

        if (options.cwd) this.processOptions.cwd = options.cwd;
        if (options.detached) this.processOptions.detached = options.detached;
        if (options.execArgv) this.processOptions.execArgv = options.execArgv;
        if (options.env) this.processOptions.env = options.env;
        if (options.execPath) this.processOptions.execPath = options.execPath;
        if (options.gid) this.processOptions.gid = options.gid;

        if (options.serialization) this.processOptions.serialization = options.serialization;
        if (options.signal) this.processOptions.signal = options.signal;
        if (options.killSignal) this.processOptions.killSignal = options.killSignal;
        if (options.silent) this.processOptions.silent = options.silent;

        if (options.stdio) this.processOptions.stdio = options.stdio;
        if (options.uid) this.processOptions.uid = options.uid;

        if (options.windowsHide) this.processOptions.windowsHide = options.windowsHide;
        if (options.windowsVerbatimArguments)
            this.processOptions.windowsVerbatimArguments = options.windowsVerbatimArguments;
        if (options.timeout) this.processOptions.timeout = options.timeout;
    }

    public spawn() {
        const { execPath, execArgv, env, silent, stdio, ...options } = this.processOptions;
        try {
            const subprocess = spawn({
                ...options,
                serialization: options.serialization ?? 'json',
                cmd: [execPath ?? process.execPath, ...(execArgv ?? []), this.file, ...(this.args ?? [])],
                env: env ? stringifyEnv(env) : undefined,
                stdio: stdio ?? (silent ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit']),
                ipc: message => {
                    if (this.process === subprocess) this.emit('message', message);
                },
                onExit: (_, exitCode, signalCode, error) => {
                    // Ignore exits of a previous generation, e.g. after respawn()
                    if (this.process !== subprocess) return;
                    if (error) this.emit('error', error);
                    this.emit('exit', exitCode, signalCode);
                },
            });
            this.process = subprocess;
        } catch (error) {
            // Bun throws synchronously (e.g. invalid execPath), defer so listeners can be attached first
            this.process = null;
            setImmediate(() => this.emit('error', error));
        }
        return this;
    }

    public respawn() {
        this.kill();
        return this.spawn();
    }

    public kill() {
        this.removeAllListeners();
        const subprocess = this.process;
        this.process = null;
        return subprocess?.kill();
    }

    public send(message: Serializable) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.process) throw new Error('CLUSTERING_NO_CHILD_EXISTS');
                this.process.send(message);
                resolve(this);
            } catch (err) {
                reject(err);
            }
        });
    }
}

/** Bun.spawn only accepts string values, mirror child_process.fork which skips undefined and stringifies the rest */
function stringifyEnv(env: Record<string, unknown>) {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
        if (value !== undefined) result[key] = String(value);
    }
    return result;
}

export class ChildClient {
    ipc: NodeJS.Process;
    constructor() {
        this.ipc = process;
        // The manager died without killing us (SIGKILL, OOM): exit instead of staying connected
        // to the gateway next to the clusters a new manager spawns
        process.once('disconnect', () => process.exit(0));
    }
    public send(message: Serializable) {
        const process = this.ipc;
        return new Promise<void>((resolve, reject) => {
            process.send?.(message, (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    public getData() {
        return process.env;
    }
}
