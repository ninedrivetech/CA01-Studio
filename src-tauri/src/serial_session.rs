use std::{
    io::{Read, Write},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, MutexGuard,
    },
    time::{Duration, Instant},
};

struct Connection {
    port: Box<dyn serialport::SerialPort>,
    next_write: Instant,
}

pub(crate) struct Session {
    connection: Mutex<Option<Connection>>,
    active: AtomicBool,
    capturing: AtomicBool,
}

impl Session {
    pub(crate) fn new(port: Box<dyn serialport::SerialPort>) -> Self {
        Self {
            connection: Mutex::new(Some(Connection {
                port,
                next_write: Instant::now() + Duration::from_millis(650),
            })),
            active: AtomicBool::new(true),
            capturing: AtomicBool::new(false),
        }
    }

    fn ensure_active(&self) -> Result<(), String> {
        if self.active.load(Ordering::Acquire) {
            Ok(())
        } else {
            Err("连接已断开".into())
        }
    }

    fn lock(&self) -> Result<MutexGuard<'_, Option<Connection>>, String> {
        let guard = self.connection.lock().map_err(|e| e.to_string())?;
        self.ensure_active()?;
        Ok(guard)
    }

    pub(crate) fn cancel(&self) {
        self.active.store(false, Ordering::Release);
    }

    pub(crate) fn close(&self) -> Result<(), String> {
        self.cancel();
        self.connection.lock().map_err(|e| e.to_string())?.take();
        Ok(())
    }

    pub(crate) fn send(&self, bytes: &[u8]) -> Result<(), String> {
        let mut guard = self.lock()?;
        if self.capturing.load(Ordering::Acquire) {
            return Err("版本采集中，请等待断开后重新连接".into());
        }
        let connection = guard.as_mut().ok_or("串口未连接")?;
        std::thread::sleep(
            connection
                .next_write
                .saturating_duration_since(Instant::now()),
        );
        self.ensure_active()?;
        // A write or timeout restoration failure leaves the outcome uncertain.
        // Retire the entire session rather than reuse a partially configured port.
        let result = (|| {
            connection.port.set_timeout(Duration::from_secs(10))?;
            connection.port.write_all(bytes)?;
            connection.port.flush()?;
            connection.next_write = Instant::now()
                + Duration::from_millis(if [6, 10].contains(&bytes[3]) {
                    150
                } else if [0x22, 0x88].contains(&bytes[3]) {
                    75
                } else {
                    35
                });
            connection.port.set_timeout(Duration::from_millis(10))?;
            Ok::<(), serialport::Error>(())
        })();
        if result.is_err() {
            self.cancel();
            guard.take();
        }
        result.map_err(|e| e.to_string())
    }

    pub(crate) fn receive(&self) -> Result<Vec<u8>, String> {
        let mut guard = self.lock()?;
        if self.capturing.load(Ordering::Acquire) {
            return Ok(vec![]);
        }
        let connection = guard.as_mut().ok_or("串口未连接")?;
        let mut bytes = [0; 4096];
        match connection.port.read(&mut bytes) {
            Ok(n) => Ok(bytes[..n].to_vec()),
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => Ok(vec![]),
            Err(e) => {
                self.cancel();
                guard.take();
                Err(e.to_string())
            }
        }
    }

    pub(crate) fn capture_version(&self) -> Result<Vec<u8>, String> {
        self.capturing
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| "版本采集中，请等待断开后重新连接".to_string())?;
        let result = self.capture_raw_version();
        self.close()?;
        result
    }

    fn capture_raw_version(&self) -> Result<Vec<u8>, String> {
        let mut guard = self.lock()?;
        let connection = guard.as_mut().ok_or("串口未连接")?;
        std::thread::sleep(
            connection
                .next_write
                .saturating_duration_since(Instant::now()),
        );
        self.ensure_active()?;
        connection
            .port
            .set_timeout(Duration::from_millis(25))
            .map_err(|e| e.to_string())?;
        connection
            .port
            .write_all(&[0xfd, 0, 1, 0x58])
            .and_then(|()| connection.port.flush())
            .map_err(|e| e.to_string())?;
        let deadline = Instant::now() + Duration::from_secs(2);
        let mut result = Vec::new();
        let mut bytes = [0; 256];
        while Instant::now() < deadline {
            self.ensure_active()?;
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
    }
}

#[derive(Default)]
pub(crate) struct Serial(pub(crate) Mutex<Option<Arc<Session>>>);

impl Serial {
    pub(crate) fn session(&self) -> Result<Arc<Session>, String> {
        self.0
            .lock()
            .map_err(|e| e.to_string())?
            .clone()
            .ok_or("串口未连接".into())
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use serialport::SerialPort;

    #[test]
    fn cancelled_requests_cannot_use_a_replacement_session() {
        let (port, _peer) = serialport::TTYPort::pair().unwrap();
        let old = Arc::new(Session::new(Box::new(port)));
        let serial = Serial(Mutex::new(Some(old.clone())));
        let queued = serial.session().unwrap();
        old.close().unwrap();
        let (port, mut peer) = serialport::TTYPort::pair().unwrap();
        peer.set_timeout(Duration::from_millis(20)).unwrap();
        *serial.0.lock().unwrap() = Some(Arc::new(Session::new(Box::new(port))));
        assert!(queued.send(&[0xfd, 0, 1, 2]).is_err());
        assert!(queued.receive().is_err());
        let mut bytes = [0; 4];
        assert!(peer.read(&mut bytes).is_err());
        serial.session().unwrap().send(&[0xfd, 0, 1, 2]).unwrap();
        peer.read_exact(&mut bytes).unwrap();
        assert_eq!(bytes, [0xfd, 0, 1, 2]);
    }

    #[test]
    fn disconnect_cancels_version_capture_before_write() {
        let (port, mut peer) = serialport::TTYPort::pair().unwrap();
        peer.set_timeout(Duration::from_millis(20)).unwrap();
        let session = Arc::new(Session::new(Box::new(port)));
        let blocked = session.connection.lock().unwrap();
        let capture = session.clone();
        let worker = std::thread::spawn(move || capture.capture_version());
        while !session.capturing.load(Ordering::Acquire) {
            std::thread::yield_now();
        }
        session.cancel();
        drop(blocked);
        session.close().unwrap();
        assert!(worker.join().unwrap().is_err());
        let mut bytes = [0; 4];
        assert!(peer.read(&mut bytes).is_err());
    }

    #[test]
    fn concurrent_version_capture_is_rejected_without_cancelling_the_first() {
        let (port, _peer) = serialport::TTYPort::pair().unwrap();
        let session = Arc::new(Session::new(Box::new(port)));
        let blocked = session.connection.lock().unwrap();
        let capture = session.clone();
        let worker = std::thread::spawn(move || capture.capture_version());
        while !session.capturing.load(Ordering::Acquire) {
            std::thread::yield_now();
        }
        assert!(session
            .capture_version()
            .unwrap_err()
            .contains("版本采集中"));
        assert!(session.active.load(Ordering::Acquire));
        session.cancel();
        drop(blocked);
        assert!(worker.join().unwrap().is_err());
    }
}
