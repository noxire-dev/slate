; Hooked into Tauri's NSIS script (bundle.windows.nsis.installerHooks). The install folder goes
; on the user's PATH so agents and scripts can run `slate add plan.md` by name, and comes off on
; uninstall. The edit itself is done by the exe (`slate --path-add`, tested in Rust): NSIS strings
; are capped at 1024 characters and real PATHs are longer. Per-user only, no admin.

!macro NSIS_HOOK_POSTINSTALL
  ExecWait '"$INSTDIR\${MAINBINARYNAME}.exe" --path-add'
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ExecWait '"$INSTDIR\${MAINBINARYNAME}.exe" --path-remove'
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

; Tauri's uninstaller deletes our ProgIDs but leaves each extension's default pointing at them,
; so a double-click on .md would fail until Windows re-picks a handler. Clear the ones that are ours.
!macro SLATE_UNASSOCIATE EXT PROGID
  ReadRegStr $0 HKCU "Software\Classes\.${EXT}" ""
  ${If} $0 == "${PROGID}"
    DeleteRegValue HKCU "Software\Classes\.${EXT}" ""
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro SLATE_UNASSOCIATE "md" "Markdown"
  !insertmacro SLATE_UNASSOCIATE "markdown" "Markdown"
  !insertmacro SLATE_UNASSOCIATE "mdx" "Markdown"
  !insertmacro SLATE_UNASSOCIATE "txt" "Text"
  !insertmacro SLATE_UNASSOCIATE "log" "Text"
  !insertmacro SLATE_UNASSOCIATE "json" "Text"
  !insertmacro SLATE_UNASSOCIATE "toml" "Text"
  !insertmacro SLATE_UNASSOCIATE "yaml" "Text"
  !insertmacro SLATE_UNASSOCIATE "yml" "Text"
  !insertmacro SLATE_UNASSOCIATE "ini" "Text"
  !insertmacro SLATE_UNASSOCIATE "cfg" "Text"
  !insertmacro SLATE_UNASSOCIATE "env" "Text"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
