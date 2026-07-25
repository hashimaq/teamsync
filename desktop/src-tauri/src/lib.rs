use tauri::Manager;

/// Production URL is configured in tauri.conf.json `build.frontendDist`.
/// Dev URL is `build.devUrl` (Next.js on :3000).

/// Injected into every page load — desktop UX without modifying the Next.js app.
const DESKTOP_BRIDGE: &str = include_str!("../scripts/desktop-bridge.js");

#[tauri::command]
fn desktop_info() -> serde_json::Value {
  serde_json::json!({
    "shell": "tauri",
    "version": env!("CARGO_PKG_VERSION"),
    "prodUrl": "https://teamsync-chi.vercel.app",
  })
}

fn dispatch_shortcut(app: &tauri::AppHandle, action: &str) {
  if let Some(window) = app.get_webview_window("main") {
    let script = format!(
      "window.dispatchEvent(new CustomEvent('teamsync-desktop-shortcut',{{detail:{{action:'{action}'}}}}));"
    );
    let _ = window.eval(&script);
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![desktop_info])
    .on_page_load(|webview, _payload| {
      let _ = webview.eval(DESKTOP_BRIDGE);
      if webview.label() == "main" {
        // on_page_load gives a Webview; title lives on the parent Window
        let _ = webview.window().set_title("TeamSync");
      }
    })
    .setup(|app| {
      #[cfg(desktop)]
      {
        use tauri_plugin_global_shortcut::{
          Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
        };

        app.handle().plugin(
          tauri_plugin_window_state::Builder::default()
            .with_state_flags(tauri_plugin_window_state::StateFlags::all())
            .build(),
        )?;

        app.handle().plugin(
          tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
              if event.state != ShortcutState::Pressed {
                return;
              }
              let ctrl_or_super = shortcut.mods.contains(Modifiers::CONTROL)
                || shortcut.mods.contains(Modifiers::SUPER);
              if !ctrl_or_super {
                return;
              }
              match shortcut.key {
                Code::KeyK => dispatch_shortcut(app, "search"),
                Code::KeyN => dispatch_shortcut(app, "new-task"),
                _ => {}
              }
            })
            .build(),
        )?;

        for shortcut in [
          Shortcut::new(Some(Modifiers::CONTROL), Code::KeyK),
          Shortcut::new(Some(Modifiers::CONTROL), Code::KeyN),
          Shortcut::new(Some(Modifiers::SUPER), Code::KeyK),
          Shortcut::new(Some(Modifiers::SUPER), Code::KeyN),
        ] {
          let _ = app.global_shortcut().register(shortcut);
        }
      }

      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title("TeamSync — Loading…");
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running TeamSync desktop");
}
