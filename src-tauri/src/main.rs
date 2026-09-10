#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{
    io::{Read, Write},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::State;
#[cfg(windows)]
mod port_names;

struct Connection {
    port: Box<dyn serialport::SerialPort>,
    next_write: Instant,
}
#[derive(Default)]
struct Serial(Arc<Mutex<Option<Connection>>>);

fn validate(frame: &[u8]) -> Result<(), String> {
    if frame.len() < 4
        || frame[0] != 0xfd
        || u16::from_be_bytes([frame[1], frame[2]]) as usize != frame.len() - 3
    {
        return Err("无效命令帧".into());
    }
    match frame[3] {
        1 | 6 => {
            if frame.len() < 6 {
                return Err("文本不能为空".into());
            }
            let limit = match frame[4] {
                0 | 1 | 3 | 4 => 400,
                5 if frame[3] == 1 => 400,
                _ => return Err("编码不支持".into()),
            };
            if frame.len() - 5 > limit {
                return Err("文本超过400字节安全帧容量，请分段发送".into());
            }
            if frame[3] == 6 && frame[4] != 1 {
                return Err("参数配置必须使用GBK".into());
            }
        }
        10 => {
            if frame.len() != 10 {
                return Err("特殊参数长度错误".into());
            }
            for (i, max) in [200, 250, 300].iter().enumerate() {
                if u16::from_be_bytes([frame[4 + i * 2], frame[5 + i * 2]]) > *max {
                    return Err("特殊参数超出范围".into());
                }
            }
        }
        2 | 3 | 4 | 5 | 11 | 0x21 | 0x22 | 0x58 | 0x88 | 0xff if frame.len() == 4 => {}
        _ => return Err("不支持的命令".into()),
    }
    Ok(())
}
#[tauri::command]
fn ports() -> Result<Vec<PortInfo>, String> {
    serialport::available_ports()
        .map(|ports| {
            let mut ports: Vec<PortInfo> = ports.into_iter().map(PortInfo::from).collect();
            #[cfg(windows)]
            port_names::enrich(&mut ports);
            ports
        })
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PortInfo {
    name: String,
    description: String,
    manufacturer: Option<String>,
}

impl From<serialport::SerialPortInfo> for PortInfo {
    fn from(port: serialport::SerialPortInfo) -> Self {
        let (description, manufacturer) = match port.port_type {
            serialport::SerialPortType::UsbPort(usb) => (
                usb.product.filter(|text| !text.trim().is_empty())
                    .unwrap_or_else(|| "USB Serial Port".into()),
                usb.manufacturer,
            ),
            serialport::SerialPortType::BluetoothPort => ("Bluetooth Serial Port".into(), None),
            serialport::SerialPortType::PciPort => ("PCI Serial Port".into(), None),
            serialport::SerialPortType::Unknown => ("Serial Port".into(), None),
        };
        Self { name: port.port_name, description, manufacturer }
    }
}
#[tauri::command]
fn connect(path: String, baud: u32, state: State<Serial>) -> Result<(), String> {
    if ![9600, 57600, 115200, 460800].contains(&baud) {
        return Err("波特率不支持".into());
    }
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    if connection.is_some() {
        return Err("请先断开当前串口".into());
    }
    let port = serialport::new(path, baud)
        .timeout(Duration::from_millis(10))
        .data_bits(serialport::DataBits::Eight)
        .stop_bits(serialport::StopBits::One)
        .parity(serialport::Parity::None)
        .flow_control(serialport::FlowControl::None)
        .open()
        .map_err(|e| e.to_string())?;
    *connection = Some(Connection {
        port,
        next_write: Instant::now() + Duration::from_millis(650),
    });
    Ok(())
}
#[tauri::command]
fn disconnect(state: State<Serial>) -> Result<(), String> {
    *state.0.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}
#[tauri::command]
async fn send(bytes: Vec<u8>, state: State<'_, Serial>) -> Result<(), String> {
    validate(&bytes)?;
    let serial = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = serial.lock().map_err(|e| e.to_string())?;
        let connection = guard.as_mut().ok_or("串口未连接")?;
        std::thread::sleep(
            connection
                .next_write
                .saturating_duration_since(Instant::now()),
        );
        // Entire frame written contiguously; drain transmission before frame-gap timing.
        connection
            .port
            .set_timeout(Duration::from_secs(10))
            .map_err(|e| e.to_string())?;
        if let Err(e) = connection
            .port
            .write_all(&bytes)
            .and_then(|_| connection.port.flush())
        {
            *guard = None;
            return Err(e.to_string());
        }
        connection
            .port
            .set_timeout(Duration::from_millis(10))
            .map_err(|e| e.to_string())?;
        connection.next_write = Instant::now()
            + Duration::from_millis(if [6, 10].contains(&bytes[3]) {
                150
            } else if [0x22, 0x88].contains(&bytes[3]) {
                75
            } else {
                35
            });
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn receive(state: State<'_, Serial>) -> Result<Vec<u8>, String> {
    let serial = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = serial.lock().map_err(|e| e.to_string())?;
        let connection = guard.as_mut().ok_or("串口未连接")?;
        let mut bytes = [0u8; 4096];
        match connection.port.read(&mut bytes) {
            Ok(n) => Ok(bytes[..n].to_vec()),
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => Ok(vec![]),
            Err(e) => {
                *guard = None;
                Err(e.to_string())
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn capture_version(state: State<'_, Serial>) -> Result<Vec<u8>, String> {
    let serial = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        // The vendor does not specify a version terminator. Isolate this raw
        // capture from normal reply parsing and always close its session.
        let mut connection = serial
            .lock()
            .map_err(|e| e.to_string())?
            .take()
            .ok_or("串口未连接")?;
        std::thread::sleep(
            connection
                .next_write
                .saturating_duration_since(Instant::now()),
        );
        connection
            .port
            .set_timeout(Duration::from_millis(25))
            .map_err(|e| e.to_string())?;
        connection
            .port
            .write_all(&[0xfd, 0, 1, 0x58])
            .and_then(|_| connection.port.flush())
            .map_err(|e| e.to_string())?;
        let deadline = Instant::now() + Duration::from_secs(2);
        let mut result = Vec::new();
        let mut bytes = [0u8; 256];
        while Instant::now() < deadline {
            match connection.port.read(&mut bytes) {
                Ok(n) => result.extend_from_slice(&bytes[..n]),
                Err(e) if e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(e) => return Err(e.to_string()),
            }
            if result.len() > 4096 {
                return Err("版本响应过长，已关闭会话".into());
            }
        }
        if result.is_empty() {
            return Err("2秒内未收到版本响应，会话已关闭".into());
        }
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}
fn main() {
    tauri::Builder::default()
        .manage(Serial::default())
        .invoke_handler(tauri::generate_handler![
            ports,
            connect,
            disconnect,
            send,
            receive,
            capture_version
        ])
        .run(tauri::generate_context!())
        .expect("应用启动失败");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_commands() {
        assert!(validate(&[0xfd, 0, 1, 2]).is_ok());
        assert!(validate(&[0xfd, 0, 2, 2]).is_err());
        assert!(validate(&[0xfd, 0, 1, 0x99]).is_err());
    }
    #[test]
    fn speech_capacity() {
        for encoding in [0, 1, 3, 4, 5] {
            for size in [400usize, 401] {
                let len = (size + 2) as u16;
                let mut bytes = vec![0xfd, (len >> 8) as u8, len as u8, 1, encoding];
                bytes.extend(vec![b'a'; size]);
                assert_eq!(validate(&bytes).is_ok(), size == 400);
            }
        }
    }
    #[test]
    fn port_descriptions_preserve_raw_path() {
        let port = PortInfo::from(serialport::SerialPortInfo {
            port_name: "COM9".into(),
            port_type: serialport::SerialPortType::UsbPort(serialport::UsbPortInfo {
                vid: 0x1a86, pid: 0x7523, serial_number: None,
                manufacturer: Some("wch.cn".into()),
                product: Some("USB-SERIAL CH340 (COM9)".into()),
            }),
        });
        assert_eq!(port.name, "COM9");
        assert_eq!(port.description, "USB-SERIAL CH340 (COM9)");
        assert_eq!(port.manufacturer.as_deref(), Some("wch.cn"));
    }
    #[test]
    fn special_ranges() {
        assert!(validate(&[0xfd, 0, 7, 10, 0, 200, 0, 250, 1, 44]).is_ok());
        assert!(validate(&[0xfd, 0, 7, 10, 0, 201, 0, 250, 1, 44]).is_err());
    }
}
