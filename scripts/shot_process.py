#!/usr/bin/env python3
# Remove the Safari bottom bar from an iOS simulator screenshot and pad back to
# exact App Store 6.9" size (1320x2868), filling with the app's bottom-edge color.
import sys
from PIL import Image
raw, out = sys.argv[1], sys.argv[2]
keep = int(sys.argv[3]) if len(sys.argv) > 3 else 2650
img = Image.open(raw).convert("RGB")
W, H = img.size            # 1320 x 2868 expected
keep = min(keep, H)
crop = img.crop((0, 0, W, keep))
# sample the average colour of the last kept row for seamless padding
row = crop.crop((0, keep - 2, W, keep)).resize((1, 1))
fill = row.getpixel((0, 0))
canvas = Image.new("RGB", (W, H), fill)
canvas.paste(crop, (0, 0))
canvas.save(out)
print(f"WROTE {out} {canvas.size} fill={fill}")
