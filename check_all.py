import sys, re, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, r"D:\PROJECTS\ssss")
from _bamini_dict import bamini_dict
import pymupdf as fitz

PDF = r"C:\Users\LEGION\Downloads\Rubric Chart.pdf"
doc = fitz.open(PDF)

def bamini_to_unicode(text):
    out = text
    out = out.replace("ntt;Nt", "வெவ்வே")
    for key in bamini_dict:
        val = str(bamini_dict.get(key))
        if key == "+":
            val = "\u0bc2"
        out = out.replace(str(key), val)
    out = out.replace("\u0b83", "/")
    out = re.sub(r"([\u0bbf\u0bc0\u0bc1\u0bc2\u0bc6\u0bc7\u0bc8\u0bca\u0bcb\u0bcc])\u0bcd", r"\1", out)
    out = re.sub(r"(?<=[\u0b80-\u0bff])p(?=[\u0b80-\u0bff])", "இ", out)
    out = re.sub(r"\u0bcd\u0b87", "\u0bbf", out)
    features = "".join(ch for ch in out if ord(ch) < 128 and not ch.isspace())
    return out, features

for i in range(doc.page_count):
    page = doc[i]
    d = page.get_text("rawdict")
    spans = []
    for b in d["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            if abs(l["dir"][1]) > 0.01:
                continue
            for s in l["spans"]:
                if s["font"] == "Arial":
                    continue
                spans.append(s)
    all_text = "".join("".join(ch["c"] for ch in s["chars"]) for s in spans)
    unicode_txt, features = bamini_to_unicode(all_text)
    tamils = re.findall(r"[\u0b80-\u0bff]+", unicode_txt)
    first = tamils[0] if tamils else "no tamil"
    print(f"Page {i+1}: first tamil = {first}  features={features[:30] if features else ''}")