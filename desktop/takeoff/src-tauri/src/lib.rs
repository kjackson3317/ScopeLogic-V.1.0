use std::{fs, path::PathBuf};
use tauri::Manager;

const RECOVERY_FILE: &str = "takeoff-recovery-v1.json";

fn recovery_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve application data directory: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create application data directory: {error}"))?;
    Ok(directory.join(RECOVERY_FILE))
}

#[tauri::command]
fn save_takeoff_recovery(app: tauri::AppHandle, json: String) -> Result<(), String> {
    let path = recovery_path(&app)?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, json)
        .map_err(|error| format!("Could not write Takeoff recovery data: {error}"))?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("Could not replace previous Takeoff recovery data: {error}"))?;
    }
    fs::rename(&temporary, &path)
        .map_err(|error| format!("Could not finalize Takeoff recovery data: {error}"))?;
    Ok(())
}

#[tauri::command]
fn load_takeoff_recovery(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = recovery_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path)
        .map(Some)
        .map_err(|error| format!("Could not read Takeoff recovery data: {error}"))
}

#[tauri::command]
fn clear_takeoff_recovery(app: tauri::AppHandle) -> Result<(), String> {
    let path = recovery_path(&app)?;
    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("Could not clear Takeoff recovery data: {error}"))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_takeoff_recovery,
            load_takeoff_recovery,
            clear_takeoff_recovery,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Technology Preconstruction Takeoff");
}
