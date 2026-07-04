import { describe, expect, it } from "vitest";
import {
  cleanStudyPlanText,
  createStudyPlanParseMetadata,
  extractTextFromDocument
} from "./document-parser.js";

describe("document parser", () => {
  it("cleans noisy whitespace while preserving paragraph breaks", () => {
    const cleaned = cleanStudyPlanText("  First   line\r\n\r\n\r\n\tSecond\u00A0line  ");

    expect(cleaned.text).toBe("First line\n\nSecond line");
    expect(cleaned.truncated).toBe(false);
  });

  it("flags text that is too short for reliable analysis", () => {
    const metadata = createStudyPlanParseMetadata({
      fileName: "scan.pdf",
      fileType: "pdf",
      text: "",
      warnings: ["PDF có rất ít text đọc được."]
    });

    expect(metadata.parseStatus).toBe("failed");
    expect(metadata.extractedTextLength).toBe(0);
    expect(metadata.warnings.join(" ")).toContain("OCR");
  });

  it("extracts and cleans UTF-8 TXT content", async () => {
    const result = await extractTextFromDocument(
      Buffer.from("\uFEFFStudy   goal\r\n\r\nResearch\tplan", "utf-8"),
      "plan.txt"
    );

    expect(result.text).toBe("Study goal\n\nResearch plan");
    expect(result.metadata.fileType).toBe("txt");
    expect(result.metadata.parseStatus).toBe("warning");
  });
});
