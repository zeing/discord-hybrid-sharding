import { Spawn, Subprocess } from 'bun';
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
export declare class Child extends EventEmitter {
    file: string;
    process: Subprocess | null;
    processOptions: Omit<ChildProcessOptions, 'clusterData' | 'args'>;
    args?: string[];
    constructor(file: string, options: ChildProcessOptions);
    spawn(): this;
    respawn(): this;
    kill(): void | undefined;
    send(message: Serializable): Promise<unknown>;
}
export declare class ChildClient {
    ipc: NodeJS.Process;
    constructor();
    send(message: Serializable): Promise<void>;
    getData(): NodeJS.ProcessEnv;
}
//# sourceMappingURL=Child.d.ts.map