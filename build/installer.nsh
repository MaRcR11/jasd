!macro customHeader
  ManifestDPIAware true
!macroend

!macro customInstall
  ; When running silently (in-app update), auto-launch after install
  IfSilent 0 +2
    Exec '"$INSTDIR\JASD.exe"'
!macroend
