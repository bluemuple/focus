#!/usr/bin/env python3
"""
WordCatch — asset cropper.

Slices the sprite sheets in /reading/images/ into individual PNGs.

Outputs:
  images/levels/level-{i}.png           (i = -1, 1..5)  — colour ice cream
  images/levels/level-{i}-silhouette.png                — black silhouette
  images/animals/{set}/{slug}.png       — 10 per set × 3 sets, colour
  images/animals/{set}/{slug}-silhouette.png            — 10 per set, ??? silhouette
  images/animals/{set}/{slug}.png  (slug = numeric index + name slug,
                                    e.g. "01-mouse.png")
                                    Numbers preserve the weak→strong order
                                    so the encounter system can resolve a
                                    level by index without a separate manifest.

Re-running is safe — files are simply overwritten.
"""

from PIL import Image
from pathlib import Path

ROOT = Path("/Users/moonleon/Documents/Homepage/focus/reading")
SRC  = ROOT / "images"
OUT_LEVELS  = SRC / "levels"
OUT_ANIMALS = SRC / "animals"

# ------------------------------------------------------------------
#  word levels.png  →  12 PNGs
#  Layout: 6 cols × 2 rows. Top row = colour, bottom = silhouette.
#  Top row left→right: melted (-1 / 무시), Lv 1, Lv 2, Lv 3, Lv 4, Lv 5.
# ------------------------------------------------------------------

LEVEL_INDEX = [-1, 1, 2, 3, 4, 5]   # column → level value

def crop_levels():
    src = Image.open(SRC / "word levels.png").convert("RGBA")
    W, H = src.size                  # 1422 × 1106
    cols = 6
    rows = 2
    cw = W // cols                   # 237
    rh = H // rows                   # 553

    OUT_LEVELS.mkdir(parents=True, exist_ok=True)

    for col, lvl in enumerate(LEVEL_INDEX):
        x0 = col * cw
        x1 = x0 + cw

        # colour (top row)
        top = src.crop((x0, 0, x1, rh))
        top.save(OUT_LEVELS / f"level-{lvl}.png")

        # silhouette (bottom row)
        bot = src.crop((x0, rh, x1, H))
        bot.save(OUT_LEVELS / f"level-{lvl}-silhouette.png")

    print(f"  wrote {len(LEVEL_INDEX) * 2} files to {OUT_LEVELS}")


# ------------------------------------------------------------------
#  Animal sheets  →  10 PNGs each (colour) + 10 PNGs each (silhouette)
#  Layout: 5 cols × 2 rows, 1774 × 887 each.
#  Names are in weak→strong order, row-major (top row first).
# ------------------------------------------------------------------

ANIMAL_SETS = {
    "animals": [
        # top row (weakest → )
        "mouse", "squirrel", "rabbit", "fox", "dog",
        # bottom row ( → strongest)
        "wolf", "cheetah", "bear", "tiger", "lion",
    ],
    "nz-animals": [
        "sheep", "piwakawaka", "tui", "pukeko", "kereru",
        "weta", "kea", "kiwi", "tuatara", "takahe",
    ],
    "penguin": [
        "korora", "tawaki", "adelie", "hoiho", "gentoo",
        "king", "emperor", "kekeno", "sea-lion", "elephant-seal",
    ],
}
# Source filename for each set's colour + silhouette pair.
ANIMAL_FILES = {
    "animals":   ("animals.png",     "animals-question.png"),
    "nz-animals":("NZ animals.png",  "NZ animals-question.png"),
    "penguin":   ("penguin.png",     "penguin-question.png"),
}

def crop_animals():
    cols, rows = 5, 2
    for set_name, slugs in ANIMAL_SETS.items():
        colour_fn, silhouette_fn = ANIMAL_FILES[set_name]
        outdir = OUT_ANIMALS / set_name
        outdir.mkdir(parents=True, exist_ok=True)

        colour_img     = Image.open(SRC / "incentives" / colour_fn).convert("RGBA")
        silhouette_img = Image.open(SRC / "incentives" / silhouette_fn).convert("RGBA")
        W, H = colour_img.size       # 1774 × 887
        cw = W // cols               # 354
        rh = H // rows               # 443

        for idx, slug in enumerate(slugs):
            r = idx // cols
            c = idx %  cols
            x0 = c * cw
            x1 = x0 + cw if c < cols - 1 else W   # final col gets remainder
            y0 = r * rh
            y1 = y0 + rh if r < rows - 1 else H   # final row gets remainder

            base = f"{idx+1:02d}-{slug}"
            colour_img    .crop((x0, y0, x1, y1)).save(outdir / f"{base}.png")
            silhouette_img.crop((x0, y0, x1, y1)).save(outdir / f"{base}-silhouette.png")

        print(f"  wrote {len(slugs) * 2} files to {outdir}")


def main():
    print("Cropping word-level icons …")
    crop_levels()
    print("Cropping animal sheets …")
    crop_animals()
    print("Done.")


if __name__ == "__main__":
    main()
