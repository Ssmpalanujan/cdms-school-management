import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.jsx";
import { publicUser } from "../src/auth.js";

describe("auth and save behaviour", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("includes the saved profile photo in the signed-in user", () => {
    const photo = "data:image/jpeg;base64,photo";
    expect(publicUser({ name: "Teacher", role: "teacher", photo }).photo).toBe(photo);
  });

  it.each([
    ["teacher", "Ravi", "ravi"],
    ["student", "Kumar", "1001"],
  ])("previews a saved %s photo after the username is entered", async (role, name, username) => {
    const photo = "data:image/jpeg;base64,profile";
    localStorage.setItem("srb-users", JSON.stringify([{ name, username, role, photo, hash: "not-used" }]));
    const u = userEvent.setup();
    render(<App />);
    await u.type(screen.getByLabelText("Username or email"), username);
    const preview = document.querySelector(".login-profile-preview");
    expect(preview.querySelector("img").getAttribute("src")).toBe(photo);
    expect(preview.textContent).toContain(name);
    expect(preview.textContent).toContain(role === "teacher" ? "Teacher" : "Student");
  });

  it("creates the first admin account directly without email verification", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.type(screen.getByLabelText("Full name"), "Mr Teacher");
    await u.type(screen.getByLabelText("Email"), "t@school.lk");
    await u.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter your school name.")).toBeTruthy();
    await u.type(screen.getByLabelText("School name"), "Demo College");
    await u.type(screen.getByLabelText("Phone number"), "abc");
    await u.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter a valid phone number.")).toBeTruthy();
    await u.clear(screen.getByLabelText("Phone number")); await u.type(screen.getByLabelText("Phone number"), "0771234567");
    await u.type(screen.getByLabelText("Password"), "longenough1");
    await u.type(screen.getByLabelText("Confirm password"), "longenough1");
    await u.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("srb-user")).role).toBe("admin"), { timeout: 3000 });
    const stored = JSON.parse(localStorage.getItem("srb-users"))[0];
    expect(stored.hash).not.toMatch(/longenough1/); expect(stored.school).toBe("Demo College"); expect(stored.email).toBe("t@school.lk");
    expect(screen.queryByLabelText("Email verification code")).toBeNull();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("srb-meta")).schoolName).toBe("Demo College"));
  });

  it("directs forgotten-password requests to the school administrator", async () => {
    localStorage.setItem("srb-users", JSON.stringify([{ name: "Admin", email: "admin@school.lk", role: "admin", hash: "old-hash" }]));
    const u = userEvent.setup();
    render(<App />);
    const forgotButton = screen.getByRole("button", { name: "Forgot password?" });
    expect(forgotButton.nextElementSibling.textContent).toBe("Powerd By LittleBee Softwares");
    await u.click(forgotButton);
    expect(await screen.findByText("Ask your school administrator to reset your password.")).toBeTruthy();
    expect(screen.queryByLabelText("Email verification code")).toBeNull();
    expect(screen.queryByLabelText("New password")).toBeNull();
  });

  it("signs in directly with a valid username and password without email verification", async () => {
    const hash = await (await import("../src/auth.js")).hashFor("teacher.one", "correct-password");
    localStorage.setItem("srb-users", JSON.stringify([{
      name: "Teacher One", username: "teacher.one", email: "teacher@school.lk",
      role: "teacher", hash,
    }]));
    const u = userEvent.setup();
    render(<App />);
    await u.type(screen.getByLabelText("Username or email"), "teacher.one");
    await u.type(screen.getByLabelText("Password"), "correct-password");
    await u.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(JSON.parse(localStorage.getItem("srb-user")).role).toBe("teacher"), { timeout: 3000 });
    expect(screen.queryByLabelText("Email verification code")).toBeNull();
  });

  it("with auto-save off the marks table is only stored when Save is pressed", async () => {
    localStorage.setItem("srb-user", JSON.stringify({ name: "A", email: "a@b.co", role: "admin" }));
    localStorage.setItem("srb-owl-tips", "false");
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getAllByRole("button", { name: /^Report builder/ })[0]);
    await u.click(screen.getByLabelText("Auto-save marks table"));
    const sec = document.getElementById("modules");
    await u.type(within(sec).getAllByLabelText("Subject")[0], "Science");
    expect(await screen.findByText("Unsaved changes", { selector: ".savenote" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("srb-rows"))[0].moduleTitle).toBe("");
    await u.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(JSON.parse(localStorage.getItem("srb-rows"))[0].moduleTitle).toBe("Science");
    expect(screen.queryByText("Unsaved changes", { selector: ".savenote" })).toBeNull();
  });
});
