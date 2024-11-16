
@DEL  /S /Q  "Z:\git\midiremote-qconpro\dist\*
call npm run build
ECHO:
ECHO Installing script to Cubase directory...
robocopy "Z:\git\midiremote-qconpro\dist" "C:\Users\richa\Documents\Steinberg\Cubase LE AI Elements\MIDI Remote\Driver Scripts\Local" /E >nul
ECHO Done!