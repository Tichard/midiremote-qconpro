# Cubase Midi Remote script for iCON Qcon Pro

Custom Cubase MIDI Remote Scripts for the iCON Qcon Pro DAW Controller.

> [!NOTE]
> Please check https://github.com/bjoluc/cubase-mcu-midiremote for original repository.

## Mapping

The mapping is based on [bjoluc](https://github.com/bjoluc)'s **iCON QCon Pro G2** remapping on their repository.
It has been adapted to work on a **iCON QCon PRo** "Cubase Mode" which presents a different MIDI layout.

Athough the mapped functions are made for a use without the "Cubase/Nuendo" template labels, it can be remapped to whatever is needed. The LedButton objects in the [bindControlSection](src/mapping/control.ts#75) are named according to the original button labels of the device.

### Display Mode 

| MCU button label | Parameter  | Shift Parameter |
| --- | --- | --- |
| **Name/Value** | Switch the LCD Parameter Name/Value display | Switch the LCD rows |
| **SMPTE/Beats** | Swicth between SMPTE/Beats timeline | Enable Mixer Meter Bridge |

### Functions

| MCU button label | Parameter  | Shift Parameter |
| --- | --- | --- |
| **F[1-8]** | Go to the Marker [1-8] | Set the Marker [1-8] |

### Assigment

Multiple press will cycle through available parameter pages.

| MCU button label | Mixer Section | Parameter pages |
| --- | --- | --- |
| **Track (*)** | Pre | <ul><li>Hi-Pass Filter</li><li>Lo-Pass Filter</li><li>Gain</li><li>Phase</li></ul> |
| **Pan/Surround (*)** | Pan | <ul><li>Pan</li></ul> |
| **EQ** | EQ | <ul><li>EQ Bands 1 & 2</li><li>EQ Bands 3 & 4</li></ul> |
| **Send** | Sends | <ul><li>Send Levels / Enabled</li><li>Send Pre/Post</li></ul> |
| **Plug-In** | Inserts | <ul><li>Focused Plug-In</li></ul> |
| **Instrument** | Strip | <ul><li>Gate</li><li>Compressor</li><li>Tools</li><li>Saturation</li><li>Limiter</li></ul> |

 _* Each encoder will control the parameters of its current mixer track._

### Automation

| MCU button label | Parameter  | Shift Parameter |
| --- | --- | --- |
| **Group** | Group |  |
| **Read/Off** | Automation Read/Off ||
| **Write** | Automation Write ||
| **Touch** | Open channel Editor | Open VST Instrument |
| **Latch** | Auto-Latch ||
| **Trim** | Trim ||

### Utility

| MCU button label | Parameter  | Shift Parameter |
| --- | --- | --- |
| **Marker** | Open marker menu |  |
| **Nudge** | Enable mouse control for JogWheel ||
| **Click** | Enable click | Enable Precount click|
| **Drop** | Export Mixdown ||
| **Replace** | Save | Save new version |
| **Solo** | Deactivate All Solo | Deactivate All Mute |

### Miscellaneous
<ol>
<li>Endoder press while in Assigment / Pan page will reset panning (See resetPanOnEncoderPush).</li>
<li>Zoom with JogWheel option has be removed.</li>
</ol>

## Cubase API reference

https://steinbergmedia.github.io/midiremote_api_doc/

## Troubleshooting

If this script has an erratic behavior (this may happen after editing a lot the binding on the go and refreshing while Cubase is running), rename the script.
Cubase seems to have a cache somewhere (other than the "User Settings" next to the install directory) that keeps data about the mapping,
and if it gets messed up, changing the name will make Cubase starts clean.
