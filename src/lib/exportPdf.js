import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Exports the branded executive brief as a dark-themed PDF, laying out each
// section as an unbroken block and shrinking to fit within maxPages pages.
export async function exportBriefToPdf(containerId, filename, footerText = "", maxPages = 2) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const BG = "#0a1526";
  const PW = 595, PH = 842, M = 26, FOOT = 22, GAP = 7;
  const blocks = [];
  for (const el of Array.from(container.children)) {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: BG, useCORS: true, logging: false });
    blocks.push({ img: canvas.toDataURL("image/png"), ratio: canvas.height / canvas.width });
  }
  const usableH = PH - 2 * M - FOOT;
  const baseW = PW - 2 * M;
  const layout = (s) => {
    const pages = [[]];
    let y = 0;
    blocks.forEach((b) => {
      const w = baseW * s, h = w * b.ratio;
      if (y > 0 && y + h > usableH) { pages.push([]); y = 0; }
      pages[pages.length - 1].push({ b, w, h, y });
      y += h + GAP;
    });
    return pages;
  };
  let s = 1, pages = layout(s);
  while (pages.length > maxPages && s > 0.4) { s -= 0.02; pages = layout(s); }

  const pdf = new jsPDF("p", "pt", "a4");
  pages.forEach((items, i) => {
    if (i > 0) pdf.addPage();
    pdf.setFillColor(10, 21, 38);
    pdf.rect(0, 0, PW, PH, "F");
    items.forEach(({ b, w, h, y }) => pdf.addImage(b.img, "PNG", (PW - w) / 2, M + y, w, h));
    pdf.setFontSize(8);
    pdf.setTextColor(120, 140, 165);
    pdf.text(`${footerText}  •  Page ${i + 1} of ${pages.length}`, PW / 2, PH - M + 6, { align: "center" });
  });
  pdf.save(filename);
}

export async function exportElementToPdf(elementId, filename = "threatpulse-executive-brief.pdf") {
  const element = document.getElementById(elementId);
  if (!element) return;

  const isDark = document.documentElement.classList.contains("dark");
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: isDark ? "#0a0f1a" : "#ffffff",
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = 595;
  const pageHeight = 842;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF("p", "pt", "a4");
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}