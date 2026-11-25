import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Package } from "./explorer";
import { RustFileEntry } from "./explorer";
import { FileType } from "./explorer";
import { invoke, isTauri } from "@tauri-apps/api/core";

export class BackendAPI {
    public async ReadFile(path: string, lastPosition: number, load: number): Promise<Package> {
        return invoke<Package>("read_file", {
            path,
            lastPosition,
            load
        });
    }

    public async SaveFile(path: string, content: string, asExt = false): Promise<void> {
        await invoke("save_file", {
            path,
            content,
            asExt
        });
    }

    public async CreateFolder(parentPath: string, name: string): Promise<void> {
        await invoke("create_folder", {
            parentPath,
            name
        });
    }

    public async CreateFile(parentPath: string, name: string): Promise<void> {
        await invoke("create_file", {
            parentPath,
            name
        });
    }


    public async LaunchTerminal(path: string, limit: number): Promise<number> {
        return invoke<number>("launch_terminal", {
            path,
            limit
        });
    }

    public async ExecuteCommand(terminalId: number, command: string): Promise<void> {
        return invoke("execute_command", { terminalId, command });
    }

    public async OnTerminalOutput(callback: (terminalId: number, output: string) => void): Promise<UnlistenFn> {
        return listen<{ terminal_id: number; output: string; }>("terminal-output", (event) => { 
            callback(event.payload.terminal_id, event.payload.output); 
        });
    }


    public async OnTerminalError(callback: (terminalId: number, output: string) => void): Promise<UnlistenFn> {
        return listen<{ terminal_id: number; output: string; }>("terminal-error", (event) => {
            callback(event.payload.terminal_id, event.payload.output);
        });
    }

    public async OnTerminalCommandComplete(callback: (terminalId: number) => void): Promise<UnlistenFn> {
        return listen<{ terminal_id: number; }>("terminal-command-complete", (event) => {
            callback(event.payload.terminal_id);
        });
    }

    public async WriteFileClipboard(payload: string): Promise<void> {
        await invoke("write_file_clipboard", {
            payload,
        });
    }

    public async ReadFileClipboard(): Promise<string | null> {
        return invoke<string | null>("read_clipboard");
    }

    public async MoveFolder(from: string, to: string): Promise<void> {
        return invoke("move_folder", {
            from,
            to,
        })
    }

    public async RenameElement(path: string, newName: string): Promise<void> {
        await invoke<void>("rename_element", {
            path,
            newName
        });
    }

    public async OpenExplorer(path: string): Promise<void> {
        return invoke("open_in_explorer", { path });
    }

    public async DeleteElement(path: string): Promise<void> {
        return invoke("delete_element", { path });
    }

    
    public OpenDirectory(path: string, limit: number | null, start_from: number = 0): Promise<RustFileEntry[]> {
        if (limit === null) {
            return invoke<RustFileEntry[]>("scan_directory", {
                path,
                startFrom: start_from
            });
        }

        return invoke<RustFileEntry[]>("scan_directory", {
            path,
            limit,
            startFrom: start_from
        });
    }

    public GetType(paths: string[]): Promise<FileType[]> {
        return invoke("get_type", {
            paths
        });
    }

    public MoveElements(paths: string[], to: string) {
        return invoke("move_elements", {
            paths, 
            to,
        });
    }

    public CopyElements(paths: string[], to: string) {
        return invoke("copy_elements", {
            paths,
            to,
        })
    }

    
    public OpenFile(path: string): Promise<string | null> {
        return invoke("open_file", { path });
    }

    public OpenFolder(path: string): Promise<string | null> {
        return invoke("open_folder", { path });
    }

    public NewFile(path: string): Promise<string | null> {
        return invoke("new_file", { path });
    }

    public NewWindow(path = ""): Promise<void> {
        return invoke("new_window", { path });
    }

    public async GetRecent(): Promise<Record<string, { Date: string }>> {
        const json = await invoke<string>("get_recent");
        return JSON.parse(json);
    }

    public WriteRecent(path: string, date: string): Promise<void> {
        return invoke("write_recent", { path, date });
    }

    public RemoveRecent(path: string) {
        return invoke("remove_recent", { path });
    }
}