import fs from "fs";
import path from "path";

const slidesDir = "c:/EspritMarket/projetmicroservice/SMART-COMPUS-ESPRIT-5SE3-FRONT-END/public/uploads/delice_pptx/ppt/slides";
const outputFile = "c:/EspritMarket/projetmicroservice/SMART-COMPUS-ESPRIT-5SE3-FRONT-END/public/uploads/delice_slides.json";

function extractSlideData(xmlContent, slideNum) {
  // Extract all text nodes <a:t>...</a:t>
  const textMatches = [];
  const regex = /<a:t>([\s\S]*?)<\/a:t>/g;
  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    const text = match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    if (text) textMatches.push(text);
  }

  // Also find paragraphs <a:p>
  const pRegex = /<a:p>([\s\S]*?)<\/a:p>/g;
  const paragraphs = [];
  while ((match = pRegex.exec(xmlContent)) !== null) {
    const pContent = match[1];
    const subMatches = [];
    let sub;
    const subRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
    while ((sub = subRegex.exec(pContent)) !== null) {
      const text = sub[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      if (text) subMatches.push(text);
    }
    if (subMatches.length > 0) {
      paragraphs.push(subMatches.join(" "));
    }
  }

  // Determine slide title (usually first or second non-category text)
  let category = "";
  let title = "";
  const bullets = [];

  if (paragraphs.length > 0) {
    if (paragraphs[0].includes("·") || paragraphs[0].length < 35 && paragraphs[0] === paragraphs[0].toUpperCase()) {
      category = paragraphs[0];
      title = paragraphs[1] || paragraphs[0];
      bullets.push(...paragraphs.slice(2));
    } else {
      title = paragraphs[0];
      bullets.push(...paragraphs.slice(1));
    }
  }

  return {
    slideNumber: slideNum,
    category: category || "Présentation & Étude de cas",
    title: title || `Diapositive ${slideNum}`,
    bullets: bullets.filter(b => b && b !== title && b !== category),
    rawText: paragraphs,
  };
}

const files = fs.readdirSync(slidesDir).filter(f => f.startsWith("slide") && f.endsWith(".xml"));
// Sort numerically: slide1.xml, slide2.xml, ... slide28.xml
files.sort((a, b) => {
  const numA = parseInt(a.replace(/\D/g, ""), 10);
  const numB = parseInt(b.replace(/\D/g, ""), 10);
  return numA - numB;
});

const allSlides = files.map((file, idx) => {
  const content = fs.readFileSync(path.join(slidesDir, file), "utf8");
  return extractSlideData(content, idx + 1);
});

fs.writeFileSync(outputFile, JSON.stringify(allSlides, null, 2), "utf8");
console.log(`Parsed ${allSlides.length} slides successfully into ${outputFile}`);
