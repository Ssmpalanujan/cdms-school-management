import pymupdf as fitz

page = fitz.open(r"C:\Users\LEGION\Downloads\Rubric Chart.pdf")[21]
r = page.rect
# bottom box approx y=700 to 740? page height 841
crop = fitz.Rect(0, r.height * 0.88, r.width, r.height * 0.95)
for b in page.get_text("rawdict")["blocks"]:
    if b["type"] != 0:
        continue
    for l in b["lines"]:
        if abs(l["dir"][1]) > 0.01:
            continue
        txt = "".join(ch["c"] for s in l["spans"] for ch in s["chars"])
        if not txt.strip():
            continue
        y = l["bbox"][1]
        print(f"{y:6.1f}  {txt!r}")