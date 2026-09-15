import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import LoginPage from "./LoginPage";

describe("LoginPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the login form without throwing when the user is unauthenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ authenticated: false, user: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole("heading", { name: "わが家の資産" })).toBeInTheDocument();
    expect(screen.getByLabelText("ユーザー名")).toBeInTheDocument();
    expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument();
  });
});
