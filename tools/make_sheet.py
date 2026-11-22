#!/usr/bin/env python3
"""Build a labeled contact sheet from the 22-shot still set."""
from PIL import Image, ImageDraw
import os, sys

SRC = os.path.expanduser("~/shorts/pepsi/stills/allshots")
OUT = os.path.expanduser("~/shorts/pepsi/stills/allshots_sheet.jpg")
FRAMES = [28, 85, 140, 200, 257, 315, 365, 425, 490, 550, 610, 675, 750, 820,
          895, 985, 1065, 1148, 1225, 1295, 1365, 1460]
BEATS = {28: "hook", 85: "hook", 140: "manifest", 200: "manifest", 257: "jetreveal",
         315: "jetreveal", 365: "jetreveal", 425: "crates", 490: "crates",
         550: "tshirt", 610: "tshirt", 675: "tv", 750: "tv-ad", 820: "tv-shock",
         895: "dogs-1", 985: "dogs-2", 1065: "weird", 1148: "horse",
         1225: "horse", 1295: "legal", 1365: "legal", 1460: "ornament"}
COLS, TW = 5, 320
PAD, LABEL = 8, 26

def main():
    thumbs = []
    for f in FRAMES:
        p = os.path.join(SRC, "f%04d.jpg" % f)
        im = Image.open(p).convert("RGB")
        th = int(TW * im.size[1] / im.size[0])
        thumbs.append((f, im.resize((TW, th))))
    cellh = thumbs[0][1].size[1] + LABEL
    rows = (len(thumbs) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * (TW + PAD) + PAD, rows * (cellh + PAD) + PAD), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    for i, (f, t) in enumerate(thumbs):
        x = PAD + (i % COLS) * (TW + PAD)
        y = PAD + (i // COLS) * (cellh + PAD)
        sheet.paste(t, (x, y + LABEL))
        d.text((x + 4, y + 5), "f%04d  %s" % (f, BEATS.get(f, "")), fill=(235, 235, 235))
    sheet.save(OUT, quality=90)
    print(OUT, sheet.size)

if __name__ == "__main__":
    main()
