"""Cue table for the Pepsi Harrier short -> music.wav + sfx.wav (stems only).
Times are frames (T.F). mix.py sets final levels.
"""
from synth import *

T = Track.for_voice()          # 50.86 s, 1524 frames
music, sfx = T.new(), T.new()
F = T.F

# ---------------- music ----------------
# jaunty commercial bed through the story, thin drone under the final button
march(T, music, end=F(1402), bpm=112, prog=PROG_MAJOR)
drone(T, music, F(1402), gain=0.07, base=49.0)

# ---------------- sfx cue table ----------------
T.place(sfx, whoosh(0.6), F(0), 0.4)             # hook pull-in
T.place(sfx, scrape(0.5), F(104), 0.5)           # manifest unfolded
T.place(sfx, pop(), F(170), 0.5)                 # eyes hit the number
T.place(sfx, rumble(2.4), F(229), 0.8)           # jet reveal
T.place(sfx, sting(), F(236), 0.5)               # reveal accent with the camera kick
T.place(sfx, whoosh(0.4), F(393), 0.5)           # flashback: garage
T.place(sfx, steps(6, 0.42), F(400), 0.35)       # hauling crates
T.place(sfx, thunk(80, 0.3), F(505), 0.9)        # crate lands
T.place(sfx, snap(), F(560), 0.45)               # t-shirt unfurled
T.place(sfx, ting(), F(600), 0.4)                # "JET PILOT" pride
T.place(sfx, whoosh(0.4), F(639), 0.5)           # cut to living room
T.place(sfx, ting(), F(700), 0.35)               # ad price on screen
T.place(sfx, creak(0.5, 110), F(800), 0.4)       # squint at the small print
T.place(sfx, wind(3.0), F(847), 0.3)             # yard, dogs wound up
T.place(sfx, boing(140, 0.5), F(930), 0.3)       # howl chorus peak
T.place(sfx, cuckoo(), F(1060), 0.4)             # "that's the weird part"
T.place(sfx, whoosh(0.4), F(1111), 0.45)         # cut to the horse
T.place(sfx, creak(1.1, 90), F(1130), 0.5)       # mechanical horse idle
T.place(sfx, rumble(1.6), F(1180), 0.5)          # engine-horse chug
T.place(sfx, steps(3, 0.5), F(1261), 0.4)        # legal team walks up
T.place(sfx, thunk(70, 0.25), F(1330), 0.7)      # briefcase emphasis
T.place(sfx, wind(2.5), F(1402), 0.25)           # dusk settle
T.place(sfx, ting(), F(1500), 0.35)              # final button

T.save(music, "music.wav")
T.save(sfx, "sfx.wav")
