//! Which files the user has let slate touch.
//!
//! The webview can ask for any path, and the page it runs renders markdown from strangers. So the
//! Rust side only reads and writes what the *user* pointed at: files picked in a dialog, dropped on
//! the window, named on the command line, or allowed in a prompt. A grant can only be made from
//! here, never by the page, and the list lives in a file the page has no command to write.

use std::{
    collections::BTreeSet,
    path::{Component, Path, PathBuf},
};

/// A comparison key for a path: absolute, `.` and `..` resolved without touching the disk,
/// backslashes, lowercase. None for anything relative or that climbs above its root.
pub fn key(path: &str) -> Option<String> {
    let mut out = PathBuf::new();
    for part in Path::new(path).components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => {
                if !out.pop() {
                    return None;
                }
            }
            other => out.push(other),
        }
    }
    out.is_absolute().then(|| out.to_string_lossy().replace('/', "\\").to_lowercase())
}

#[derive(Default, serde::Serialize, serde::Deserialize)]
pub struct Grants {
    /// Readable and writable.
    files: BTreeSet<String>,
    /// Folders a granted file lives in: its siblings are readable, so relative links work.
    /// Not recursive, or a note opened from the home folder would expose everything under it.
    dirs: BTreeSet<String>,
    /// Git repositories a granted file belongs to: readable all the way down.
    repos: BTreeSet<String>,
}

impl Grants {
    pub fn grant(&mut self, path: &str, repo: Option<&str>) {
        let Some(file) = key(path) else { return };
        if let Some(dir) = file.rfind('\\').map(|at| file[..at].to_string()) {
            self.dirs.insert(dir);
        }
        if let Some(repo) = repo.and_then(key) {
            self.repos.insert(repo);
        }
        self.files.insert(file);
    }

    pub fn may_write(&self, path: &str) -> bool {
        key(path).is_some_and(|file| self.files.contains(&file))
    }

    pub fn may_read(&self, path: &str) -> bool {
        let Some(file) = key(path) else { return false };
        let dir = file.rfind('\\').map(|at| &file[..at]).unwrap_or("");
        self.files.contains(&file)
            || self.dirs.contains(dir)
            || self.repos.iter().any(|repo| file.starts_with(&format!("{repo}\\")))
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::{key, Grants};

    #[test]
    fn a_grant_covers_the_file_its_siblings_and_its_repository_and_nothing_else() {
        assert_eq!(key("C:\\Repo\\docs\\..\\PLAN.md").as_deref(), Some("c:\\repo\\plan.md"));
        assert_eq!(key("C:\\..\\..\\Windows"), None); // climbing above the root is refused, not clamped
        assert_eq!(key("notes.txt"), None);

        let mut grants = Grants::default();
        grants.grant("C:\\Users\\me\\notes.txt", None);
        assert!(grants.may_read("C:\\Users\\me\\notes.txt") && grants.may_write("C:\\Users\\me\\notes.txt"));
        assert!(grants.may_read("c:\\users\\ME\\other.md")); // a sibling, for relative links
        assert!(!grants.may_write("C:\\Users\\me\\other.md")); // reading a sibling never implies writing it
        assert!(!grants.may_read("C:\\Users\\me\\.ssh\\id_ed25519")); // not what lies beneath
        assert!(!grants.may_read("C:\\Users\\me\\docs\\..\\.ssh\\id_ed25519"));
        assert!(!grants.may_read("C:\\Users\\other.md"));

        grants.grant("C:\\repo\\docs\\PLAN.md", Some("C:\\repo"));
        assert!(grants.may_read("C:\\repo\\src\\deep\\main.ts")); // anywhere in the repository
        assert!(!grants.may_read("C:\\repo-evil\\x.md")); // a name that merely starts the same
        assert!(!grants.may_read("C:\\repo\\..\\secrets.txt"));
    }
}
