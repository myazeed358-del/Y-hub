import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
// Vitest stubs CSS imports (including ?raw); read real sources so these checks cannot pass on empty strings.
const css=readFileSync(resolve(__dirname,'../App.css'),'utf8');
const workspaceCss=readFileSync(resolve(__dirname,'../workspace/workspace.css'),'utf8');
import { WorkbookProvider, useWorkbook } from "../state/workbookContext";
afterEach(cleanup);
it("scopes every style selector and animation definition to Y-Sheets", () => {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const inspect = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule.type === CSSRule.STYLE_RULE) {
        const r = rule as CSSStyleRule;
        for (const selector of r.selectorText.split(","))
          expect(selector.trim()).toMatch(/^\.y-sheets-root(?:[\s.:#\[]|$)/);
      } else if (rule.type === CSSRule.KEYFRAMES_RULE) {
        expect((rule as CSSKeyframesRule).name).toMatch(/^y-sheets-/);
      } else if ("cssRules" in rule)
        inspect((rule as CSSGroupingRule).cssRules);
    }
  };
  expect(style.sheet!.cssRules.length).toBeGreaterThan(0);
  inspect(style.sheet!.cssRules);
  style.remove();
});
it("does not reset host body, utilities, or another page when the lazy stylesheet loads", () => {
  const host = document.createElement("div");
  host.className = "flex bg-white";
  host.style.display = "grid";
  document.body.appendChild(host);
  const before = {
    margin: getComputedStyle(document.body).margin,
    color: getComputedStyle(host).backgroundColor,
  };
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  expect(getComputedStyle(document.body).margin).toBe(before.margin);
  expect(getComputedStyle(host).backgroundColor).toBe(before.color);
  expect(getComputedStyle(host).display).toBe("grid");
  host.remove();
  style.remove();
});
it("reacts to host light/dark changes without mutating the host theme", () => {
  const Probe = () => <output>{useWorkbook().theme}</output>;
  const hostClass = document.documentElement.className;
  const { rerender } = render(
    <WorkbookProvider theme="light">
      <Probe />
    </WorkbookProvider>,
  );
  expect(screen.getByRole("status").textContent).toBe("light");
  rerender(
    <WorkbookProvider theme="dark">
      <Probe />
    </WorkbookProvider>,
  );
  expect(screen.getByRole("status").textContent).toBe("dark");
  expect(document.documentElement.className).toBe(hostClass);
});
it("applies the spreadsheet theme toggle to its root, without changing Y-Hub", async () => {
  const { YSheetsHostAdapter } =
    await import("../integration/YSheetsHostAdapter");
  const { fireEvent } = await import("@testing-library/react");
  const hostClass = document.documentElement.className;
  const { container } = render(<YSheetsHostAdapter theme="light" />);
  fireEvent.click(screen.getByTitle("Switch to Dark Mode"));
  expect(container.querySelector(".y-sheets-root.dark")).not.toBeNull();
  fireEvent.click(screen.getByTitle("Switch to Light Mode"));
  expect(container.querySelector(".y-sheets-root.dark")).toBeNull();
  expect(document.documentElement.className).toBe(hostClass);
});

it('scopes workspace layout rules and avoids fixed viewport subtraction', () => {
  const style=document.createElement('style'); style.textContent=workspaceCss; document.head.appendChild(style);
  const inspect=(rules: CSSRuleList) => {
    for(const rule of Array.from(rules)) {
      if(rule.type===CSSRule.STYLE_RULE) expect((rule as CSSStyleRule).selectorText).toMatch(/^\.y-sheets-workspace/);
      else if('cssRules' in rule) inspect((rule as CSSGroupingRule).cssRules);
    }
  };
  expect(style.sheet!.cssRules.length).toBeGreaterThan(0);
  inspect(style.sheet!.cssRules); style.remove();
  expect(workspaceCss).not.toMatch(/position:\s*fixed|calc\(100(?:d)?vh/);
});
it('defines cyan selection headers and subdued grid borders in dark mode',()=>{
 // Assert the parsed declarations here; Chromium checks their actual cascade.
 const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
 const rules=[...style.sheet!.cssRules].filter(rule=>rule.type===CSSRule.STYLE_RULE) as CSSStyleRule[];
 try {
  const header=rules.find(rule=>rule.selectorText.includes('bg-emerald-950')&&rule.selectorText.endsWith('80'));
  const cell=rules.find(rule=>rule.selectorText.includes('border-zinc-800')&&rule.selectorText.endsWith('80'));
  expect(header?.style.getPropertyValue('background-color')).toBe('rgba(8, 51, 68, 0.8)');
  expect(cell?.style.getPropertyValue('border-color')).toBe('rgba(39, 39, 42, 0.8)');
 } finally {style.remove();}
});
