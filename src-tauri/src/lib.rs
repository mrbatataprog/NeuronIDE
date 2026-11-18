use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use tauri::Emitter;
use tauri::async_runtime::spawn_blocking;
use std::path::Path;

use std::fs::File;
use std::io::{BufRead, BufReader, Write, Read, Seek, SeekFrom};
use std::thread;

use std::collections::HashMap;
use std::process::{Child, ChildStdin, ChildStdout, ChildStderr, Command, Stdio};
use std::sync::Mutex;

use clipboard_rs::{Clipboard, ClipboardContext};

#[derive(Debug, Serialize, Clone)]
struct TerminalCommandComplete {
    terminal_id: i32,
}

#[derive(Debug, Serialize, Clone)]
struct TerminalPath {
    terminal_id: i32,
    path: String,
}

struct TerminalSession {
    process: Child,
    stdin: ChildStdin,
}

struct TerminalManager {
    terminals: Mutex<HashMap<i32, TerminalSession>>,
    next_id: Mutex<i32>,
}

#[derive(Debug, Serialize, Clone)]
struct TerminalOutput {
    terminal_id: i32,
    output: String,
}

#[derive(Debug, Serialize, Clone)]
enum DirKind {
    Unknown,
    File,
    Directory,
}

#[derive(Debug, Serialize, Clone)]
struct FileEntry {
    name: String,
    kind: DirKind,
}

struct Terminal;

#[derive(Debug, Serialize)]
enum ErrorCode {
    Terminal_PathNotFound,
    Terminal_FoundFile,
    Terminal_FailedToOpen,
    Terminal_FailedToLunch,
    Terminal_FailedToExecute,
    Terminal_NotFound,
}

pub struct FileScan {
    path: PathBuf,
    limit: Option<usize>,
    start_from: usize,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Package {
    pub text: String,
    pub end_position: i32,
    pub end: bool,
}

impl FileScan {
    pub fn new(path: PathBuf, limit: Option<usize>, start_from: usize) -> Self {
        Self {
            path,
            limit,
            start_from,
        }
    }

    fn scan(&self) -> Result<Vec<FileEntry>, String> {
        let entries = fs::read_dir(&self.path).map_err(|e| format!("Failed to read directory {:?}: {}", self.path, e))?;
        let mut result = Vec::new();

        for entry_result in entries.skip(self.start_from).take(self.limit.unwrap_or(usize::MAX)) {
            let entry = entry_result.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let kind = match entry.file_type() {
                Ok(file_type) if file_type.is_dir() => DirKind::Directory,
                Ok(file_type) if file_type.is_file() => DirKind::File,
                _ => DirKind::Unknown,
            };

            result.push(FileEntry { name, kind });
        }

        Ok(result)
    }
}

#[tauri::command]
async fn scan_directory(path: String, limit: Option<usize>, start_from: usize) -> Result<Vec<FileEntry>, String> {
    spawn_blocking(move || {
        let scanner = FileScan::new(path.into(), limit, start_from);
        scanner.scan()
    }).await.map_err(|e| e.to_string())?
}


#[tauri::command(rename_all = "camelCase")]
async fn read_file(path: String, last_position: u64, load: usize,) -> Result<Package, String> {
    let mut file = File::open(&path).map_err(|e| e.to_string())?;

    file.seek(SeekFrom::Start(last_position)).map_err(|e| e.to_string())?;

    let mut buffer = vec![0u8; load];

    let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;

    buffer.truncate(bytes_read);

    let end_of_file = bytes_read == 0;
    let text = String::from_utf8(buffer).map_err(|e| format!("Invalid UTF-8 boundary: {}", e))?;

    Ok(Package {
        text,
        end_position: bytes_read as i32,
        end: bytes_read == 0,
    })
}


#[tauri::command]
fn execute_command(state: tauri::State<'_, TerminalManager>, terminal_id: i32, command: String) -> Result<(), ErrorCode> {
    let mut terminals = state.terminals.lock().unwrap();
    let terminal = terminals.get_mut(&terminal_id).ok_or(ErrorCode::Terminal_NotFound)?;
    let marker = format!("__TAURI_COMMAND_DONE_{}__", terminal_id);

    writeln!(terminal.stdin, "{}", command).map_err(|_| ErrorCode::Terminal_FailedToExecute)?;
    writeln!(terminal.stdin, "Write-Output '{}'", marker).map_err(|_| ErrorCode::Terminal_FailedToExecute)?;

    terminal.stdin.flush().map_err(|_| ErrorCode::Terminal_FailedToExecute)?;

    Ok(())
}

fn terminal_callback(app: &tauri::AppHandle, terminal_id: i32, output: String) {
    let _ = app.emit("terminal-output", TerminalOutput { terminal_id, output, });
}

#[tauri::command]
async fn save_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Failed to save file '{}': {}", path, e))
}

#[tauri::command]
async fn create_folder(parent_path: String, name: String) -> Result<(), String> {
    let name = name.trim();

    if name.is_empty() {
        return Err("Folder name cannot be empty".to_string());
    }

    let path = Path::new(&parent_path).join(name);

    if path.exists() {
        return Err(format!("'{}' already exists", name));
    }

    fs::create_dir(&path)
        .map_err(|e| format!("Failed to create folder '{}': {}", path.display(), e))
}

#[tauri::command]
async fn create_file(parent_path: String, name: String) -> Result<(), String> {
    let name = name.trim();

    if name.is_empty() {
        return Err("File name cannot be empty".to_string());
    }

    let path = Path::new(&parent_path).join(name);
    if path.exists() { return Err(format!("'{}' already exists", name)); }

    fs::File::create(&path).map(|_| ()).map_err(|e| format!("Failed to create file '{}': {}", path.display(), e))
}

#[tauri::command]
async fn move_folder(from: String, to: String) -> Result<(), String> {
    spawn_blocking(move || {
        let source = Path::new(&from);
        let destination_dir = Path::new(&to);

        if !source.is_dir() {
            return Err(format!("Source folder does not exist: '{}'", from));
        }

        if !destination_dir.is_dir() {
            return Err(format!("Destination folder does not exist: '{}'", to));
        }

        let source_path = fs::canonicalize(source).map_err(|e| e.to_string())?;
        let destination_path = fs::canonicalize(destination_dir).map_err(|e| e.to_string())?;

        if destination_path.starts_with(&source_path) {
            return Err("Cannot move a folder into itself or its descendants.".to_string());
        }

        let folder_name = source.file_name().ok_or_else(|| "Invalid source folder name".to_string())?;
        let target = destination_dir.join(folder_name);

        if target.exists() {
            return Err(format!("The destination already contains '{}'.", folder_name.to_string_lossy()));
        }

        fs::rename(source, &target).map_err(|e| { format!("Failed to move folder: {}", e) })
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn run() {
    tauri::Builder::default()
        .manage(TerminalManager { terminals: Mutex::new(HashMap::new()), next_id: Mutex::new(0), })
        .setup(|app| {
            // Terminal for the developing
            if cfg!(debug_assertions) {
                app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
            }

            #[cfg(not(debug_assertions))]
            {
                use tauri::Manager;

                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ scan_directory, read_file, execute_command, save_file, create_folder, create_file, write_file_clipboard, read_file_clipboard, move_folder, open_in_explorer, delete_element, rename_element, move_elements, get_type, copy_elements ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

const FILE_CLIPBOARD_FORMAT: &str = "application/x-neuronide-file-list";

#[tauri::command]
fn write_file_clipboard(payload: String) -> Result<(), String> {
    let clipboard = ClipboardContext::new().map_err(|e| e.to_string())?;

    clipboard.set_buffer(FILE_CLIPBOARD_FORMAT, payload.into_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file_clipboard() -> Result<Option<String>, String> {
    let clipboard = ClipboardContext::new().map_err(|e| e.to_string())?;
    let formats = clipboard.available_formats().map_err(|e| e.to_string())?;

    if !formats.iter().any(|format| format.as_str() == FILE_CLIPBOARD_FORMAT) {
        return Ok(None);
    }

    let bytes = clipboard.get_buffer(FILE_CLIPBOARD_FORMAT).map_err(|e| e.to_string())?;
    let payload = String::from_utf8(bytes).map_err(|e| e.to_string())?;

    Ok(Some(payload))
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    std::process::Command::new("explorer.exe").arg(path).spawn().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_type(paths: Vec<String>) -> Vec<String> {
    paths.iter().map(|path| { match std::fs::metadata(path) {
        Ok(metadata) if metadata.is_file() => "File".to_string(),
        Ok(metadata) if metadata.is_dir() => "Directory".to_string(),
        _ => "Unknown".to_string(),
    }}).collect()
}

#[tauri::command]
fn move_elements(paths: Vec<String>, to: String) -> Result<(), String> {
    for path in paths {
        let source = Path::new(&path);
        let file_name = source.file_name().ok_or_else(|| format!("Invalid source path: {}", path))?;
        let destination = Path::new(&to).join(file_name);

        std::fs::rename(source, &destination).map_err(|e| format!("Failed to move {}: {}", path, e))?;
    }

    Ok(())
}

#[tauri::command]
fn copy_elements(paths: Vec<String>, to: String) -> Result<(), String> {
    for path in paths {
        let source = Path::new(&path);
        let file_name = source.file_name().ok_or_else(|| format!("Invalid source path: {}", path))?;
        let destination = Path::new(&to).join(file_name);

        if source.is_file() {
            fs::copy(source, &destination).map_err(|e| format!("Failed to copy {}: {}", path, e))?;
        } else if source.is_dir() {
            copy_directory(source, &destination).map_err(|e| format!("Failed to copy directory {}: {}", path, e))?;
        } else {
            return Err(format!("Unknown file type: {}", path));
        }
    }

    Ok(())
}

fn copy_directory(source: &Path, destination: &Path) -> std::io::Result<()> {
    fs::create_dir_all(destination)?;

    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());

        if source_path.is_dir() {
            copy_directory(&source_path, &destination_path)?;
        } else {
            fs::copy(&source_path, &destination_path)?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn delete_element(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = std::path::PathBuf::from(path);

        if path.is_dir() {
            std::fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
        } else {
            std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        }

        Ok(())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn rename_element (path: String, new_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let old_path = std::path::PathBuf::from(path);
        let parent = old_path.parent().ok_or("Invalid path")?;
        let new_path = parent.join(&new_name);

        if new_path.exists() {
            return Err("An entry with that name already exists".to_string());
        }

        std::fs::rename(old_path, new_path).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}
