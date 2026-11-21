import { describe, expect, it } from "vitest";
import {
  isBrazilianIsbn13,
  isValidIsbn10,
  isValidIsbn13,
  normalizeToIsbn13,
} from "@/lib/isbn";

describe("ISBN validation and normalization (RF-A10)", () => {
  it("validates a real Brazilian ISBN-13 with and without hyphens", () => {
    // Dom Casmurro (Penguin-Companhia): 978-85-63560-27-8
    expect(isValidIsbn13("9788563560278")).toBe(true);
    expect(normalizeToIsbn13("978-85-63560-27-8")).toBe("9788563560278");
  });

  it("rejects an ISBN-13 with a wrong check digit", () => {
    expect(isValidIsbn13("9788563560279")).toBe(false);
    expect(normalizeToIsbn13("978-85-63560-27-9")).toBeNull();
  });

  it("converts a valid ISBN-10 (including X check digit) into ISBN-13", () => {
    // 8535914846 -> 9788535914849
    expect(isValidIsbn10("8535914846")).toBe(true);
    expect(normalizeToIsbn13("85-359-1484-6")).toBe("9788535914849");

    // 080442957X -> 9780804429573
    expect(isValidIsbn10("080442957X")).toBe(true);
    expect(normalizeToIsbn13("0-8044-2957-X")).toBe("9780804429573");
  });

  it("identifies Brazilian ISBN-13 prefixes 978-85 and 978-65", () => {
    expect(isBrazilianIsbn13("9788563560278")).toBe(true);
    expect(isBrazilianIsbn13("9786559210886")).toBe(true);
    expect(isBrazilianIsbn13("9780140449136")).toBe(false);
  });
});
