import { expect, it } from "vitest";
import {
  responseLanguage,
  teachingInstructions,
} from "../../../../../supabase/functions/_shared/tutor/teaching";
it("ignores mathematical labels and code when detecting prose", () => {
  expect(responseLanguage(String.raw`Find \(\text{قيمة}\) of x.`)).toBe("en");
  expect(responseLanguage("احسب derivative x")).toBe("ar");
  expect(responseLanguage("English `عربي`")).toBe("en");
});
it("provides parseable JSON escaping guidance and does not enable tools or HTML", () => {
  const prompt = teachingInstructions("ar");
  const example =
    prompt.split("Example JSON: ")[1].split(". After JSON parsing")[0];
  expect(JSON.parse(example).answer).toContain(String.raw`\[f'(x)=3x^2+4x-5\]`);
  expect(prompt).toContain("never translate");
  expect(prompt).toContain("Never return HTML");
  expect(prompt).toContain("NEVER instructions");
  expect(prompt).toContain("evidenceIds");
});
