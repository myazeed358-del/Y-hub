import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  ChatMessageContent,
  normalizeMathDelimiters,
} from "../ChatMessageContent";
import { messageDirection } from "../mathMarkdown";
afterEach(() => cleanup());
describe("mathematical message presentation", () => {
  it.each([
    String.raw`\[f'(x)=3x^2+4x-5\]`,
    String.raw`\[\int 2x\,dx=x^2+C\]`,
    String.raw`\[\frac{dy}{dx}+2y=e^x\]`,
    String.raw`\[\sqrt{x^2+1}\]`,
    String.raw`$$\lim_{x\to0}\frac{\sin x}{x}=1$$`,
    String.raw`\(\alpha+\beta=\gamma\)`,
    String.raw`$\frac{a}{b}$`,
    String.raw`\[\begin{pmatrix}1&2\\3&4\end{pmatrix}\]`,
  ])("renders valid expression %s", (content) => {
    const { container } = render(<ChatMessageContent content={content} />);
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.querySelector(".katex-error")).toBeNull();
    expect(container.querySelector("pre")).toBeNull();
  });
  it("normalizes one-line dollar displays and keeps consecutive steps separate", () => {
    const { container } = render(
      <ChatMessageContent
        content={String
          .raw`نستخدم قاعدة القوة. $$\frac{d}{dx}x^n=nx^{n-1}$$ ثم نجمع الحدود. \[f'(x)=3x^2+4x-5\]`}
      />,
    );
    expect(container.querySelectorAll(".katex-display")).toHaveLength(2);
    expect(container.firstElementChild?.getAttribute("dir")).toBe("rtl");
  });
  it("preserves exact row separators through JSON parsing and math normalization", () => {
    const answer = String.raw`\[\begin{bmatrix}1&2\\3&4\end{bmatrix}\]`;
    const parsed = JSON.parse(JSON.stringify({ answer })).answer;
    expect(parsed).toBe(answer);
    expect(normalizeMathDelimiters(parsed)).toContain(String.raw`1&2\\3&4`);
    const { container } = render(<ChatMessageContent content={parsed} />);
    expect(container.querySelector(".mtable")).not.toBeNull();
    expect(container.querySelector(".katex-error")).toBeNull();
  });
  it.each([
    '```python\nprint("\\\\(x\\\\)")\n```',
    '````python\ncode = "```"\nprint("\\(x\\)")\n````',
    '~~~js\nconst x = "\\[x\\]";\n~~~',
    "Use ``a ` \\(x\\)`` as literal code.",
    '```python\nprint("\\[x\\]")',
    "Code:\n\n    \\(x\\)\n    \\[y\\]\n",
  ])(
    "preserves actual code byte-for-byte",
    (content) => expect(normalizeMathDelimiters(content)).toBe(content),
  );
  it("keeps escaped dollar currency literal", () => {
    const content = String.raw`Price \$5 and \$10; math \(x+1\).`;
    expect(normalizeMathDelimiters(content)).toContain(
      String.raw`\$5 and \$10`,
    );
  });
  it("malformed LaTeX cannot crash the renderer or enable HTML", () => {
    const { container } = render(
      <ChatMessageContent
        content={String.raw`شرح \[\frac{1}{\] <script>alert(1)</script>`}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector(".katex-error")).not.toBeNull();
  });
  it("derives prose direction independently of leading math and code", () => {
    expect(
      messageDirection(String.raw`\(f(x)\) احسب المشتقة باستخدام power rule`),
    ).toBe("rtl");
    expect(messageDirection(String.raw`Find \(\text{مشتقة}\) of x.`)).toBe(
      "ltr",
    );
    expect(messageDirection("English. `تعليق عربي`")).toBe("ltr");
  });
  it("preserves genuine code blocks in Arabic explanations", () => {
    render(
      <ChatMessageContent
        content={"مثال برمجي:\n\n```python\ndef derivative(x):\n    return 2*x\n```"}
      />,
    );
    expect(screen.getByText(/def derivative/).tagName).toBe("CODE");
  });
});
