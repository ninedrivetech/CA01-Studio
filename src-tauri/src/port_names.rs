//! Read the friendly names that Device Manager uses, including non-USB ports.
use std::{mem::size_of, ptr};
use windows_sys::{
    core::GUID,
    Win32::{
        Devices::DeviceAndDriverInstallation::{
            SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInfo, SetupDiGetClassDevsW,
            SetupDiGetDeviceRegistryPropertyW, DIGCF_PRESENT, HDEVINFO, SPDRP_FRIENDLYNAME,
            SPDRP_MFG, SP_DEVINFO_DATA,
        },
        Foundation::INVALID_HANDLE_VALUE,
    },
};

struct DeviceSet(HDEVINFO);
impl Drop for DeviceSet {
    fn drop(&mut self) {
        // SAFETY: this handle is created by SetupDiGetClassDevsW and owned here.
        unsafe { SetupDiDestroyDeviceInfoList(self.0) };
    }
}

fn property(set: &DeviceSet, device: &SP_DEVINFO_DATA, key: u32) -> Option<String> {
    let mut bytes = 0;
    let mut kind = 0;
    // SAFETY: the first call only requests the buffer size; all output pointers are valid.
    unsafe {
        SetupDiGetDeviceRegistryPropertyW(set.0, device, key, &mut kind, ptr::null_mut(), 0, &mut bytes);
    }
    if bytes == 0 || bytes > 65536 || bytes % 2 != 0 { return None; }
    let mut buffer = vec![0u16; bytes as usize / 2];
    // SAFETY: the UTF-16 buffer is aligned and contains exactly `bytes` writable bytes.
    let ok = unsafe {
        SetupDiGetDeviceRegistryPropertyW(set.0, device, key, &mut kind,
            buffer.as_mut_ptr().cast(), bytes, ptr::null_mut())
    };
    if ok == 0 || kind != 1 { return None; } // REG_SZ
    let end = buffer.iter().position(|&value| value == 0).unwrap_or(buffer.len());
    String::from_utf16(&buffer[..end]).ok().filter(|value| !value.trim().is_empty())
}

pub fn enrich(ports: &mut [super::PortInfo]) {
    // GUID_DEVCLASS_PORTS, the Windows Ports (COM & LPT) setup class.
    let class = GUID { data1: 0x4d36e978, data2: 0xe325, data3: 0x11ce,
        data4: [0xbf, 0xc1, 0x08, 0x00, 0x2b, 0xe1, 0x03, 0x18] };
    // SAFETY: the class pointer is valid and no owner window or enumerator is supplied.
    let handle = unsafe { SetupDiGetClassDevsW(&class, ptr::null(), 0, DIGCF_PRESENT) };
    if handle == INVALID_HANDLE_VALUE { return; }
    let set = DeviceSet(handle);
    let mut index = 0;
    loop {
        let mut device = SP_DEVINFO_DATA { cbSize: size_of::<SP_DEVINFO_DATA>() as u32,
            ClassGuid: class, DevInst: 0, Reserved: 0 };
        // SAFETY: the set is live and the output structure has the required size.
        if unsafe { SetupDiEnumDeviceInfo(set.0, index, &mut device) } == 0 { break; }
        index += 1;
        if let Some(description) = property(&set, &device, SPDRP_FRIENDLYNAME) {
            for port in ports.iter_mut() {
                if description.to_ascii_uppercase().ends_with(&format!("({})", port.name.to_ascii_uppercase())) {
                    port.description = description.clone();
                    if let Some(manufacturer) = property(&set, &device, SPDRP_MFG) {
                        port.manufacturer = Some(manufacturer);
                    }
                    break;
                }
            }
        }
    }
}
