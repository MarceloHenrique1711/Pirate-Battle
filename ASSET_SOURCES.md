# Asset sources and license verification

The game assets were supplied in the submitted project archive. The challenge
identifies their source as:

https://github.com/junglegaming/game-developer-challenge/tree/main/assets

The original PNGs, WAVs, JSON/XML atlases and vector files are preserved under
public/assets. Gameplay loads the individual supplied PNGs directly; it does not
try to load the absent ui_sheet.xml file.

No authoritative asset license text was included in the submitted archive.
Before redistributing or publishing the final delivery, obtain the applicable
license from the source and include its text and attribution here. Do not assume
all assets share a license. This file records provenance; it does not grant rights
or certify a license that was not supplied.

The interface uses locally hosted Fredoka Latin fonts (weights 600 and 700),
obtained from the @fontsource/fredoka 5.3.0 package. The original SIL Open Font
License is included in public/assets/fonts/Fredoka-LICENSE.txt. These files do not add a
runtime npm dependency. Menu backgrounds, controls, ships, tiles, effects and
health indicators all use the supplied game assets.
