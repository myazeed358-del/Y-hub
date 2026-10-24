import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { KnowledgeSources } from "../../knowledge/KnowledgeSources";
import { SourceEvidence } from "../../knowledge/SourceEvidence";
import { ChatMessageContent } from "../ChatMessageContent";
const mocks = vi.hoisted(() => ({ maybeSingle: vi.fn(), download: vi.fn() }));
vi.mock(
  "@/utils/supabaseClient",
  () => ({
    supabase: {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      }),
      storage: { from: () => ({ download: mocks.download }) },
    },
  }),
);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("shows source status and permits instructor indexing without client text", () => {
  const index = vi.fn();
  render(
    <KnowledgeSources
      sources={[{
        id: "s",
        kind: "pdf",
        material_id: "m",
        title: "Lecture",
        status: "unreadable",
      }]}
      selected=""
      onSelect={() => {}}
      manage
      busy={false}
      onIndex={index}
    />,
  );
  expect(screen.getByText(/No ready sources/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Index / فهرسة" }));
  expect(index).toHaveBeenCalledWith("s");
});
it("does not offer student index writes", () => {
  render(
    <KnowledgeSources
      sources={[{
        id: "s",
        kind: "pdf",
        material_id: "m",
        title: "Lecture",
        status: "pending",
      }]}
      selected=""
      onSelect={() => {}}
      manage={false}
      busy={false}
      onIndex={() => {}}
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
});
it("displays exact evidence and refuses unavailable source downloads", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  render(
    <SourceEvidence
      sources={[{
        id: "c",
        source_id: "s",
        revision: "r",
        title: "Trusted lecture",
        text: "Exact evidence",
        page: 7,
        unit_id: null,
      }]}
    />,
  );
  expect(screen.getByText(/Trusted lecture.*7/)).toBeTruthy();
  expect(screen.getByText("Exact evidence")).toBeTruthy();
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(mocks.download).not.toHaveBeenCalled();
});
it("renders math while refusing provider-controlled remote images or links", () => {
  const { container } = render(
    <ChatMessageContent
      content={"\\(x^2\\) ![secret](https://evil.invalid/collect) [source](https://evil.invalid)"}
    />,
  );
  expect(container.querySelector(".katex")).not.toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("a")).toBeNull();
});
