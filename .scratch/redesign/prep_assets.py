import os
from collections import Counter
from PIL import Image, ImageDraw

SRC = r"D:\CAMPBANK\logo"
OUT = r"D:\CAMPBANK\.scratch\redesign"


def key_out_background(img, thresh=36):
    """Flood-fill the connected background from all four corners, then make it transparent."""
    rgb = img.convert("RGB")
    key = (255, 0, 255)
    w, h = rgb.size
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(rgb, xy, key, thresh=thresh)
    rgba = rgb.convert("RGBA")
    px = rgba.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][:3] == key:
                px[x, y] = (255, 255, 255, 0)
    return rgba


def trim(img):
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def dominant(img, n=10, min_sat=40):
    """Most common saturated colours, ignoring near-white / near-black / grey."""
    small = img.convert("RGB").resize((160, 160))
    counts = Counter()
    for r, g, b in small.getdata():
        mx, mn = max(r, g, b), min(r, g, b)
        if mx - mn < min_sat:
            continue
        counts[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
    return [("#%02X%02X%02X" % c, n_) for c, n_ in counts.most_common(n)]


def save(img, name, width=None, quality=None):
    if width and img.width > width:
        h = round(img.height * width / img.width)
        img = img.resize((width, h), Image.LANCZOS)
    path = os.path.join(OUT, name)
    img.save(path, optimize=True)
    print(f"  {name:24s} {img.width}x{img.height}  {os.path.getsize(path) / 1024:.1f} KB")
    return path


camp = Image.open(os.path.join(SRC, "logo-eqcamp.jpg"))
group = Image.open(os.path.join(SRC, "logo-cqgroup.png"))

print(f"eqcamp source  {camp.size} {camp.mode}")
print(f"eqgroup source {group.size} {group.mode}")

print("\nEQCAMP dominant colours:")
for hexv, n_ in dominant(camp):
    print(f"  {hexv}  {n_}")
print("\nEQGROUP dominant colours:")
for hexv, n_ in dominant(group):
    print(f"  {hexv}  {n_}")

print("\nwritten assets:")
camp_t = trim(key_out_background(camp))
save(camp_t, "eqcamp-lockup.png", width=560)

# mark only: the bulb-and-orbit sits above the wordmark
w, h = camp_t.size
mark = trim(camp_t.crop((0, 0, w, int(h * 0.60))))
save(mark, "eqcamp-mark.png", width=360)

group_t = trim(group.convert("RGBA") if group.mode == "RGBA" else key_out_background(group))
save(group_t, "eqgroup-mark.png", width=280)
