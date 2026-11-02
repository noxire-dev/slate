//! Unsaved tabs at rest, locked to this Windows account with DPAPI.
//!
//! A copy of the file (a backup sweep, a synced folder, another account, a pulled disk) is
//! unreadable. Malware running as the same user is not stopped: slate itself has to read the file.

const MAGIC: &[u8] = b"slate-dpapi1\n";
/// Ties the blob to slate, so another app's DPAPI call can't open it by accident.
const ENTROPY: &[u8] = b"dev.mirako.slate";

pub fn seal(text: &str) -> Result<Vec<u8>, String> {
    let mut out = MAGIC.to_vec();
    out.extend(dpapi::protect(text.as_bytes())?);
    Ok(out)
}

/// The text, and whether it was sealed. A file from before encryption is plain JSON and is read as is.
pub fn open(bytes: &[u8]) -> Result<(String, bool), String> {
    match bytes.strip_prefix(MAGIC) {
        Some(blob) => {
            let plain = dpapi::unprotect(blob)?;
            String::from_utf8(plain).map(|t| (t, true)).map_err(|e| e.to_string())
        }
        None => String::from_utf8(bytes.to_vec()).map(|t| (t, false)).map_err(|e| e.to_string()),
    }
}

#[cfg(windows)]
mod dpapi {
    use super::ENTROPY;
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    fn blob(bytes: &[u8]) -> CRYPT_INTEGER_BLOB {
        CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 }
    }

    fn take(out: CRYPT_INTEGER_BLOB) -> Vec<u8> {
        // SAFETY: DPAPI allocated cbData bytes at pbData with LocalAlloc; copy them, then free.
        unsafe {
            let bytes = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
            LocalFree(out.pbData as _);
            bytes
        }
    }

    pub fn protect(plain: &[u8]) -> Result<Vec<u8>, String> {
        let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: null_mut() };
        // SAFETY: the input blobs borrow live slices for the duration of the call.
        let ok = unsafe { CryptProtectData(&blob(plain), null(), &blob(ENTROPY), null(), null(), CRYPTPROTECT_UI_FORBIDDEN, &mut out) };
        if ok == 0 {
            return Err(format!("could not encrypt: {}", std::io::Error::last_os_error()));
        }
        Ok(take(out))
    }

    pub fn unprotect(sealed: &[u8]) -> Result<Vec<u8>, String> {
        let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: null_mut() };
        // SAFETY: as above.
        let ok = unsafe { CryptUnprotectData(&blob(sealed), null_mut(), &blob(ENTROPY), null(), null(), CRYPTPROTECT_UI_FORBIDDEN, &mut out) };
        if ok == 0 {
            return Err(format!("could not decrypt: {}", std::io::Error::last_os_error()));
        }
        Ok(take(out))
    }
}

#[cfg(not(windows))]
mod dpapi {
    // ponytail: slate ships for Windows only; elsewhere the "seal" is a no-op so the crate still builds.
    pub fn protect(plain: &[u8]) -> Result<Vec<u8>, String> {
        Ok(plain.to_vec())
    }
    pub fn unprotect(sealed: &[u8]) -> Result<Vec<u8>, String> {
        Ok(sealed.to_vec())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn sealed_text_round_trips_and_does_not_show_on_disk() {
        let text = r#"{"tabs":[{"text":"hunter2"}]}"#;
        let sealed = super::seal(text).unwrap();
        assert!(!sealed.windows(7).any(|w| w == b"hunter2"));
        assert_eq!(super::open(&sealed).unwrap(), (text.to_string(), true));
        assert_eq!(super::open(text.as_bytes()).unwrap(), (text.to_string(), false));
    }
}
