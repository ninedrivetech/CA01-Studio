use std::{
    fs,
    fs::OpenOptions,
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
};
use tauri::Manager;

fn download_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .download_dir()
        .map_err(|_| "无法获取下载目录，请检查系统设置后重试".into())
}

#[tauri::command]
pub fn log_export_directory(app: tauri::AppHandle) -> Result<String, String> {
    download_directory(&app).map(|path| path.to_string_lossy().into_owned())
}

fn valid_filename(filename: &str) -> bool {
    let Some(stem) = filename.strip_suffix(".log") else {
        return false;
    };
    let first = stem
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let reserved = matches!(first.as_str(), "con" | "prn" | "aux" | "nul")
        || ["com", "lpt"].iter().any(|prefix| {
            first.strip_prefix(prefix).is_some_and(|suffix| {
                suffix.len() == 1 && matches!(suffix.as_bytes()[0], b'1'..=b'9')
            })
        });
    !stem.is_empty()
        && stem.chars().count() <= 80
        && !stem.ends_with(['.', ' '])
        && !reserved
        && !stem
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
}

fn write_log(directory: &Path, filename: &str, content: &str) -> Result<PathBuf, String> {
    if !valid_filename(filename) {
        return Err("文件名无效，请使用不含路径的 .log 文件名".into());
    }
    if content.len() > 8 * 1024 * 1024 {
        return Err("日志超过 8 MB，请缩小筛选范围后重试".into());
    }
    fs::create_dir_all(directory).map_err(|_| "无法访问下载目录，请检查文件夹权限".to_string())?;
    let stem = filename.strip_suffix(".log").unwrap();
    for index in 0..1000 {
        let name = if index == 0 {
            filename.to_owned()
        } else {
            format!("{stem} ({index}).log")
        };
        let path = directory.join(name);
        let mut file = match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => file,
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(_) => return Err("无法保存日志，请检查下载目录权限和磁盘空间后重试".into()),
        };
        if file
            .write_all(content.as_bytes())
            .and_then(|()| file.sync_all())
            .is_err()
        {
            drop(file);
            let _ = fs::remove_file(&path);
            return Err("日志写入失败，请检查磁盘空间后重试".into());
        }
        return Ok(path);
    }
    Err("同名日志过多，请更换文件名后重试".into())
}

#[tauri::command]
pub async fn save_log_export(
    app: tauri::AppHandle,
    filename: String,
    content: String,
) -> Result<String, String> {
    let directory = download_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || write_log(&directory, &filename, &content))
        .await
        .map_err(|_| "日志保存任务未完成，请重试".to_string())?
        .map(|path| path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_paths_device_names_and_invalid_extensions() {
        for name in [
            "../x.log",
            "C:\\x.log",
            "a/b.log",
            "a:stream.log",
            "CON.log",
            "aux.extra.log",
            "LPT1.log",
            "COM9.log",
            "x.log.exe",
            ".log",
            "a .log",
            "a\n.log",
            "a\u{85}.log",
        ] {
            assert!(!valid_filename(name), "{name}");
        }
        assert!(valid_filename("通信记录-01.log"));
        assert!(!valid_filename(&format!("{}.log", "中".repeat(81))));
    }

    #[test]
    fn writes_utf8_without_overwriting_and_reports_io_errors() {
        let directory = std::env::temp_dir().join(format!(
            "cicada-log-export-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let first = write_log(&directory, "设备.log", "第一份\n").unwrap();
        let second = write_log(&directory, "设备.log", "第二份\n").unwrap();
        assert_eq!(second.file_name().unwrap(), "设备 (1).log");
        assert_eq!(fs::read_to_string(&first).unwrap(), "第一份\n");
        assert_eq!(fs::read_to_string(second).unwrap(), "第二份\n");
        assert!(write_log(&directory, "large.log", &"a".repeat(8 * 1024 * 1024 + 1)).is_err());
        assert!(!directory.join("large.log").exists());
        assert!(write_log(&first, "invalid-directory.log", "data").is_err());
        fs::remove_dir_all(directory).unwrap();
    }
}
