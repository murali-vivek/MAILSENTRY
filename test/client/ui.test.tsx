import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../src/client/App";
import { FindingCard } from "../../src/client/components/FindingCard";
import { EmptyState } from "../../src/client/components/EmptyState";
import { AnalyzePage } from "../../src/client/pages/AnalyzePage";
import { LoginPage } from "../../src/client/pages/LoginPage";
import type { FindingResponse } from "../../src/shared/types";

describe("client", () => {
  it("shows a login error and does not store the password", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) {
        return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Sign in to continue." } }), { status: 401 });
      }
      if (url.endsWith("/api/auth/login")) {
        expect(init?.body).toContain("wrong-password");
        return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Sign in failed." } }), { status: 401 });
      }
      throw new Error(`unexpected ${url}`);
    }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    );
    await user.type(await screen.findByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign in failed.");
    expect(window.localStorage.length).toBe(0);
    vi.unstubAllGlobals();
  });

  it("rejects a non-eml upload before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AnalyzePage />
      </MemoryRouter>,
    );
    const input = screen.getByLabelText("Email file");
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    await user.click(screen.getByRole("button", { name: "Run analysis" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only .eml files");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("renders findings as text and shows an empty state", () => {
    const finding: FindingResponse = {
      id: "f1",
      ruleId: "BANK_CHANGE_REQUEST",
      category: "content",
      severity: "high",
      title: "Bank-detail change language",
      evidence: "Matched phrase <script>alert(1)</script>",
      explanation: "Payment changes need an independent check.",
      recommendation: "Use a contact already on file.",
      limitation: "Phrase matching can miss paraphrases.",
      status: "triggered",
      weight: 25,
      createdAt: "2024-10-15T15:00:00.000Z",
    };
    const view = render(
      <>
        <FindingCard finding={finding} />
        <EmptyState title="No investigations yet">Load the synthetic demo.</EmptyState>
      </>,
    );
    expect(screen.getByText("Bank-detail change language")).toBeInTheDocument();
    expect(screen.getByText(/Use a contact already on file/)).toBeInTheDocument();
    expect(screen.getByText("No investigations yet")).toBeInTheDocument();
    expect(view.container.querySelector("script")).toBeNull();
    expect(view.container.innerHTML).not.toContain("<script>");
  });
});
