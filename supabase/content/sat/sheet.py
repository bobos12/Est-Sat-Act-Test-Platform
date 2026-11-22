"""Contact sheet of figure crops for visual review: python sheet.py <test> <prefix> <out.png>"""
import glob, sys
from pathlib import Path
from PIL import Image, ImageDraw

test, prefix, out = sys.argv[1], sys.argv[2], sys.argv[3]
files = sorted(glob.glob(str(Path(__file__).parent.parent.parent.parent / "public" / "sat" / f"test-{test}" / f"{prefix}*.png")))
W, H, cols = 330, 260, 5
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (W * cols, max(1, rows) * H), "white")
dr = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB")
    im.thumbnail((W - 10, H - 24))
    x, y = (i % cols) * W, (i // cols) * H
    sheet.paste(im, (x + 5, y + 20))
    dr.text((x + 5, y + 4), Path(f).name, fill="red")
    dr.rectangle([x, y, x + W - 1, y + H - 1], outline="#ccc")
sheet.save(out)
print(len(files), "figures")
