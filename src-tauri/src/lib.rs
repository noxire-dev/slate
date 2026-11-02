mod grants;
mod vault;

use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

/// The files the user has let slate touch. See grants.rs for why.
struct GrantStore(Mutex<grants::Grants>);

fn grants_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_local_data_dir().ok().map(|dir| dir.join("grants.json"))
}

/// Records that the user pointed at this file, and remembers it across restarts.
fn grant(app: &AppHandle, path: &str) {
    let store = app.state::<GrantStore>();
    let mut grants = store.0.lock().unwrap();
    let folder = std::path::Path::new(path).parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
    grants.grant(path, workspace_for(&folder, &[]).as_deref());
    if let (Some(file), Ok(json)) = (grants_file(app), serde_json::to_string(&*grants)) {
        let _ = fs::write(file, json);
    }
}

/// Loads the grant list. The first time, there isn't one: every file already open in a saved tab
/// set was opened by the user under the old rules, so those are carried in once.
fn load_grants(app: &AppHandle) -> grants::Grants {
    let Some(file) = grants_file(app) else { return Default::default() };
    if let Some(saved) = fs::read_to_string(&file).ok().and_then(|json| serde_json::from_str(&json).ok()) {
        return saved;
    }
    let mut seeded = grants::Grants::default();
    let sets = file.parent().and_then(|dir| fs::read_dir(dir).ok()).into_iter().flatten().flatten();
    for set in sets.filter(|e| e.file_name().to_string_lossy().ends_with(".json")) {
        let json = fs::read_to_string(set.path()).ok().and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok());
        for tab in json.as_ref().and_then(|j| j["tabs"].as_array()).into_iter().flatten() {
            if let Some(path) = tab["path"].as_str() {
                let folder = std::path::Path::new(path).parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
                seeded.grant(path, workspace_for(&folder, &[]).as_deref());
            }
        }
    }
    seeded
}

/// Passes if the user already granted this path; otherwise asks them, in a native dialog the page
/// cannot answer for them, and remembers a yes.
fn allow(app: &AppHandle, path: &str, write: bool) -> Result<(), String> {
    let granted = {
        let store = app.state::<GrantStore>();
        let grants = store.0.lock().unwrap();
        if write { grants.may_write(path) } else { grants.may_read(path) }
    };
    if granted {
        return Ok(());
    }
    let verb = if write { "save to" } else { "open" };
    if grants::key(path).is_none() {
        return Err(format!("Couldn't {verb} {path}: it isn't a full path."));
    }
    let mut ask = app
        .dialog()
        .message(format!("Let slate {verb} this file?\n\n{path}\n\nslate only touches files you opened, dropped on it, or allowed here."))
        .title("slate")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom("Allow".into(), "Don't allow".into()));
    if let Some(window) = app.get_webview_window("main") {
        ask = ask.parent(&window);
    }
    if !ask.blocking_show() {
        return Err(format!("slate wasn't allowed to {verb} {}.", file_name(path)));
    }
    grant(app, path);
    Ok(())
}

/// slate keeps two files of its own: the open tabs, and the settings. They live in the LOCAL app
/// data folder: unsaved text can hold pasted secrets, and the roaming one syncs across machines on
/// domain profiles. Files from before this moved are carried over once.
fn state_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    // The tab sets (home is "session", each workspace is "ws-…"), the workspace index, the settings.
    let workspace = name.strip_prefix("ws-").is_some_and(|rest| !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-'));
    if !workspace && !matches!(name, "session" | "settings" | "workspaces" | "vimrc" | "keys") {
        return Err(format!("unknown state file: {name}"));
    }
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(if name == "vimrc" { "vimrc".to_string() } else { format!("{name}.json") });
    if !path.exists() {
        if let Ok(roaming) = app.path().app_data_dir() {
            let old = roaming.join(format!("{name}.json"));
            if old.exists() && fs::copy(&old, &path).is_ok() {
                let _ = fs::remove_file(&old);
            }
        }
    }
    Ok(path)
}

/// Returns the saved file, or None if there isn't one. A file that no longer parses is moved
/// aside rather than overwritten, so the next save can't destroy it.
#[tauri::command]
fn load_state(app: AppHandle, name: String) -> Result<Option<String>, String> {
    let path = state_path(&app, &name)?;
    let Ok(bytes) = fs::read(&path) else {
        return Ok(None);
    };
    // A file sealed under another Windows account, or damaged, is kept aside, not overwritten.
    let Ok((json, sealed)) = vault::open(&bytes) else {
        let _ = fs::rename(&path, path.with_extension("corrupt.json"));
        return Ok(None);
    };
    // vimrc is not JSON; keys is hand-edited, so a typo is reported by the page, not moved aside.
    if !matches!(name.as_str(), "vimrc" | "keys") && serde_json::from_str::<serde_json::Value>(&json).is_err() {
        let _ = fs::rename(&path, path.with_extension("corrupt.json"));
        return Ok(None);
    }
    // Tabs saved before encryption get sealed the first time they are read.
    if holds_tabs(&name) && !sealed {
        let _ = write_state(&path, &name, &json);
    }
    Ok(Some(json))
}

/// The tab sets hold unsaved text, which can be anything the user pasted. Those are encrypted;
/// settings, keys and vimrc stay plain so they can be edited by hand.
fn holds_tabs(name: &str) -> bool {
    name == "session" || name.starts_with("ws-")
}

/// Write-then-rename, so a crash mid-write leaves the previous file intact.
fn write_state(path: &std::path::Path, name: &str, json: &str) -> Result<(), String> {
    let bytes = if holds_tabs(name) { vault::seal(json)? } else { json.as_bytes().to_vec() };
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// Opens one of slate's own files in whatever Windows opens it with.
#[tauri::command]
fn open_state(app: AppHandle, name: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let path = state_path(&app, &name)?;
    app.opener().open_path(path.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_state(app: AppHandle, name: String, json: String) -> Result<(), String> {
    write_state(&state_path(&app, &name)?, &name, &json)
}

#[derive(serde::Serialize)]
struct TextFile {
    text: String,
    encoding: &'static str,
}

fn utf16(bytes: &[u8], little_endian: bool) -> Option<String> {
    let units: Vec<u16> = bytes
        .chunks_exact(2)
        .map(|pair| if little_endian { u16::from_le_bytes([pair[0], pair[1]]) } else { u16::from_be_bytes([pair[0], pair[1]]) })
        .collect();
    String::from_utf16(&units).ok()
}

// ponytail: UTF-8 and BOM-marked UTF-16 only. Windows PowerShell 5.1 and .reg exports write
// UTF-16, so that is the case strangers hit. ANSI code pages need a detector and a picker;
// add encoding_rs when someone opens one.
fn decode(bytes: &[u8]) -> Option<(String, &'static str)> {
    match bytes {
        [0xEF, 0xBB, 0xBF, rest @ ..] => String::from_utf8(rest.to_vec()).ok().map(|s| (s, "utf-8-bom")),
        [0xFF, 0xFE, rest @ ..] => utf16(rest, true).map(|s| (s, "utf-16le")),
        [0xFE, 0xFF, rest @ ..] => utf16(rest, false).map(|s| (s, "utf-16be")),
        _ => String::from_utf8(bytes.to_vec()).ok().map(|s| (s, "utf-8")),
    }
}

fn encode(text: &str, encoding: &str) -> Vec<u8> {
    match encoding {
        "utf-8-bom" => [&[0xEF, 0xBB, 0xBF], text.as_bytes()].concat(),
        "utf-16le" => [0xFF, 0xFE].into_iter().chain(text.encode_utf16().flat_map(u16::to_le_bytes)).collect(),
        "utf-16be" => [0xFE, 0xFF].into_iter().chain(text.encode_utf16().flat_map(u16::to_be_bytes)).collect(),
        _ => text.as_bytes().to_vec(),
    }
}

fn file_name(path: &str) -> &str {
    path.rsplit(['\\', '/']).next().unwrap_or(path)
}

// (async) keeps these off the main thread, so `allow` can block on its dialog.
#[tauri::command(async)]
fn read_file(app: AppHandle, path: String) -> Result<TextFile, String> {
    allow(&app, &path, false)?;
    let bytes = fs::read(&path).map_err(|e| format!("Couldn't open {}: {e}", file_name(&path)))?;
    let (text, encoding) = decode(&bytes)
        .ok_or_else(|| format!("Couldn't open {}: it isn't UTF-8 or UTF-16 text.", file_name(&path)))?;
    Ok(TextFile { text, encoding })
}

#[tauri::command(async)]
fn write_file(app: AppHandle, path: String, text: String, encoding: String) -> Result<(), String> {
    allow(&app, &path, true)?;
    fs::write(&path, encode(&text, &encoding)).map_err(|e| format!("Couldn't save {}: {e}", file_name(&path)))
}

/// Cheap to ask every second: changes whenever the file is rewritten. None if it is gone.
#[tauri::command]
fn file_stamp(grants: State<GrantStore>, path: String) -> Option<String> {
    if !grants.0.lock().unwrap().may_read(&path) {
        return None; // polled every second: never worth a prompt
    }
    let meta = fs::metadata(&path).ok()?;
    let modified = meta.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?;
    Some(format!("{}:{}", modified.as_millis(), meta.len()))
}

#[derive(serde::Serialize)]
struct FontFamily {
    name: String,
    mono: bool,
}

/// Every font family installed on the machine, by the same names the webview resolves in CSS.
#[tauri::command]
fn list_fonts() -> Vec<FontFamily> {
    #[cfg(windows)]
    {
        use dwrote::{FontCollection, FontStretch, FontStyle, FontWeight};
        let mut fonts: Vec<FontFamily> = FontCollection::system()
            .families_iter()
            .filter_map(|family| {
                let name = family.family_name().ok()?;
                let mono = family
                    .first_matching_font(FontWeight::Regular, FontStretch::Normal, FontStyle::Normal)
                    .ok()
                    .and_then(|font| font.is_monospace())
                    .unwrap_or(false);
                Some(FontFamily { name, mono })
            })
            .collect();
        fonts.sort_by_key(|font| font.name.to_lowercase());
        fonts.dedup_by(|a, b| a.name == b.name);
        fonts
    }
    #[cfg(not(windows))]
    Vec::new()
}

/// What a launch asked for. The command line is slate's whole API for agents and scripts:
///   slate plan.md            open it and come to the front
///   slate --read plan.md     the same, rendered
///   slate add plan.md        queue it without taking focus; the tab shows as unread
///   slate add --scratch x.md copy its text into a note slate keeps, not tied to the file
#[derive(Clone, Default, Debug, PartialEq, serde::Serialize)]
struct Launch {
    files: Vec<String>,
    read: bool,
    scratch: bool,
    background: bool,
    /** The project folder this launch belongs to; None means the home tab set. */
    workspace: Option<String>,
}

/// Workspaces are keyed by folder: the git repository slate was run from, or failing that the
/// one the first file lives in. An agent running `slate add PLAN.md` inside a repo needs no setup.
fn workspace_for(cwd: &str, files: &[String]) -> Option<String> {
    let beside_file = files.first().and_then(|f| std::path::Path::new(f).parent().map(PathBuf::from));
    [Some(PathBuf::from(cwd)), beside_file].into_iter().flatten().find_map(|start| {
        start.ancestors().find(|dir| dir.join(".git").exists()).map(|dir| dir.to_string_lossy().into_owned())
    })
}

fn parse_launch(args: &[String], cwd: &str) -> Launch {
    let mut launch = Launch::default();
    for (i, arg) in args.iter().enumerate().skip(1) {
        match arg.as_str() {
            "add" if i == 1 => launch.background = true,
            "--read" => launch.read = true,
            "--scratch" => launch.scratch = true,
            flag if flag.starts_with('-') => {}
            file => launch.files.push(PathBuf::from(cwd).join(file).to_string_lossy().into_owned()),
        }
    }
    launch.workspace = workspace_for(cwd, &launch.files);
    launch
}

fn this_launch() -> Launch {
    let args: Vec<String> = std::env::args().collect();
    parse_launch(&args, &std::env::current_dir().unwrap_or_default().to_string_lossy())
}

#[tauri::command]
fn launch(app: AppHandle) -> Launch {
    let launch = this_launch();
    for file in &launch.files {
        grant(&app, file); // named on the command line, by the user or their agent
    }
    launch
}

/// The open and save dialogs run here, not in the page, so that what the user picks is a grant.
#[tauri::command(async)]
fn pick_open(app: AppHandle) -> Vec<String> {
    let mut dialog = app.dialog().file();
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    let picked = dialog.blocking_pick_files().unwrap_or_default();
    let paths: Vec<String> = picked.into_iter().filter_map(|f| f.into_path().ok()).map(|p| p.to_string_lossy().into_owned()).collect();
    for path in &paths {
        grant(&app, path);
    }
    paths
}

#[tauri::command(async)]
fn pick_save(app: AppHandle, suggested: String) -> Option<String> {
    let suggestion = std::path::Path::new(&suggested);
    let mut dialog = app.dialog().file().set_file_name(suggestion.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default());
    if let Some(folder) = suggestion.parent().filter(|p| p.is_dir()) {
        dialog = dialog.set_directory(folder);
    }
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    let path = dialog.blocking_save_file()?.into_path().ok()?.to_string_lossy().into_owned();
    grant(&app, &path);
    Some(path)
}


/// The user's PATH with this exe's folder present or absent. Entries are compared the way
/// Windows does, ignoring case and a trailing separator; everything else is kept as written.
fn user_path_with(path: &str, dir: &str, present: bool) -> String {
    let norm = |s: &str| s.trim_end_matches(['\\', '/']).to_lowercase();
    let mut entries: Vec<&str> = path.split(';').filter(|e| !e.is_empty() && norm(e) != norm(dir)).collect();
    if present {
        entries.push(dir);
    }
    entries.join(";")
}

/// `slate --path-add` / `slate --path-remove`, run by the installer and uninstaller.
#[cfg(windows)]
fn edit_user_path(present: bool) -> Result<(), String> {
    use winreg::{enums::*, RegKey, RegValue};
    let dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|d| d.to_string_lossy().into_owned()))
        .ok_or("no exe dir")?;
    let key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)
        .map_err(|e| e.to_string())?;
    let current: String = key.get_value("Path").unwrap_or_default();
    let next = user_path_with(&current, &dir, present);
    let bytes: Vec<u8> = next.encode_utf16().chain(std::iter::once(0)).flat_map(u16::to_le_bytes).collect();
    key.set_raw_value("Path", &RegValue { vtype: REG_EXPAND_SZ, bytes: bytes.into() }).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Installer plumbing: edit PATH and leave, before any window or single-instance handoff.
    #[cfg(windows)]
    if let Some(flag) = std::env::args().nth(1).filter(|a| a == "--path-add" || a == "--path-remove") {
        if let Err(e) = edit_user_path(flag == "--path-add") {
            eprintln!("{e}");
            std::process::exit(1);
        }
        std::process::exit(0);
    }
    tauri::Builder::default()
        // One process owns session.json. A second launch hands its files to the first and exits.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let launch = parse_launch(&args, &cwd);
            for file in &launch.files {
                grant(app, file);
            }
            let _ = app.emit("open-files", &launch);
            if let Some(window) = app.get_webview_window("main") {
                if launch.background {
                    // `slate add` must not pull you out of what you're doing. Flash the taskbar instead.
                    let _ = window.request_user_attention(Some(tauri::UserAttentionType::Informational));
                } else {
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        }))
        // The window starts hidden and the page shows it once it has something to show, so there
        // is no white flash, and `slate add` with nothing running can file its tabs and leave
        // without ever appearing. If the page never gets that far, don't strand a hidden process.
        .on_window_event(|window, event| {
            // Dropping a file on the window is the user pointing at it.
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                for path in paths {
                    grant(window.app_handle(), &path.to_string_lossy());
                }
            }
        })
        .setup(|app| {
            app.manage(GrantStore(Mutex::new(load_grants(app.handle()))));
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let background = this_launch().background;
                std::thread::sleep(std::time::Duration::from_secs(if background { 20 } else { 4 }));
                match handle.get_webview_window("main") {
                    Some(window) if !background && !window.is_visible().unwrap_or(true) => {
                        let _ = window.show();
                    }
                    Some(window) if background && !window.is_visible().unwrap_or(true) => handle.exit(0),
                    _ => {}
                }
            });
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            open_state,
            read_file,
            write_file,
            file_stamp,
            list_fonts,
            launch,
            pick_open,
            pick_save
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{decode, encode, parse_launch, Launch};

    #[test]
    fn a_launch_belongs_to_the_git_repository_it_was_run_from() {
        let root = std::env::temp_dir().join(format!("slate-ws-test-{}", std::process::id()));
        let nested = root.join("repo").join("docs").join("plans");
        std::fs::create_dir_all(&nested).unwrap();
        std::fs::create_dir_all(root.join("repo").join(".git")).unwrap();
        let repo = root.join("repo").to_string_lossy().into_owned();
        let outside = root.to_string_lossy().into_owned();
        let plan = nested.join("PLAN.md").to_string_lossy().into_owned();
        assert_eq!(super::workspace_for(&nested.to_string_lossy(), &[]), Some(repo.clone())); // run from inside
        assert_eq!(super::workspace_for(&outside, &[plan]), Some(repo)); // run elsewhere, file inside
        assert_eq!(super::workspace_for(&outside, &[]), None); // no repo anywhere: home
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn the_install_folder_goes_on_and_off_the_user_path_without_touching_the_rest() {
        let dir = "C:\\Users\\me\\AppData\\Local\\slate";
        let long: String = (0..60).map(|i| format!("C:\\tools\\number-{i}")).collect::<Vec<_>>().join(";");
        assert!(long.len() > 1024); // longer than NSIS can hold, which is why this lives here
        let with = super::user_path_with(&long, dir, true);
        assert_eq!(with, format!("{long};{dir}"));
        assert_eq!(super::user_path_with(&with, dir, true), with); // reinstall: no duplicate
        assert_eq!(super::user_path_with(&format!("{dir}\\;{long}"), dir, false), long); // case/slash-insensitive removal
        assert_eq!(super::user_path_with("", dir, true), dir);
        assert_eq!(super::user_path_with(dir, dir, false), "");
    }

    #[test]
    fn utf16_files_open_and_go_back_as_they_came() {
        // what Windows PowerShell 5.1 writes for: "hi" > out.txt
        let powershell = [0xFF, 0xFE, b'h', 0, b'i', 0, b'\r', 0, b'\n', 0];
        let (text, encoding) = decode(&powershell).unwrap();
        assert_eq!((text.as_str(), encoding), ("hi\r\n", "utf-16le"));
        assert_eq!(encode(&text, encoding), powershell);
        assert_eq!(decode(&[0xEF, 0xBB, 0xBF, b'a']).unwrap(), ("a".to_string(), "utf-8-bom"));
        assert_eq!(decode(b"plain").unwrap().1, "utf-8");
        assert!(decode(&[0xC3, 0x28]).is_none()); // neither: refuse rather than open garbled
    }

    #[cfg(windows)]
    #[test]
    fn list_fonts_reads_the_real_families_and_knows_which_are_monospace() {
        let fonts = super::list_fonts();
        assert!(fonts.iter().any(|f| f.name == "Consolas" && f.mono));
        assert!(fonts.iter().any(|f| f.name == "Segoe UI" && !f.mono));
        let nerd: Vec<_> = fonts.iter().filter(|f| f.name.contains("NF") || f.name.contains("Nerd")).map(|f| &f.name).collect();
        println!("{} families, {} monospace, nerd fonts: {:?}", fonts.len(), fonts.iter().filter(|f| f.mono).count(), nerd);
    }

    #[test]
    fn the_command_line_is_parsed_into_a_launch() {
        let launch = |args: &[&str]| parse_launch(&args.iter().map(|a| a.to_string()).collect::<Vec<_>>(), "C:\\work");
        let plain = launch(&["slate.exe", "--unknown", "notes.txt", "C:\\abs\\todo.md"]);
        assert_eq!(plain.files, ["C:\\work\\notes.txt", "C:\\abs\\todo.md"]);
        assert!(!plain.background && !plain.read && !plain.scratch);
        assert_eq!(
            launch(&["slate.exe", "add", "--read", "PLAN.md"]),
            Launch { files: vec!["C:\\work\\PLAN.md".into()], read: true, scratch: false, background: true, workspace: None }
        );
        // "add" is only a verb in first position; anywhere else it is a file called add
        assert_eq!(launch(&["slate.exe", "x.md", "add"]).files.len(), 2);
    }
}
