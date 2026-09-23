import { describe, it, expect } from "vitest"

import {
  restHeaders,
  filtersToParams,
  restUrl,
  functionsUrl,
  storageUrl,
  toCurl,
} from "@/lib/curl"

describe("restHeaders", () => {
  it("uses the token when present, else the apikey", () => {
    expect(restHeaders("KEY", "TOKEN")).toEqual({
      apikey: "KEY",
      Authorization: "Bearer TOKEN",
    })
    expect(restHeaders("KEY", null).Authorization).toBe("Bearer KEY")
  })
  it("merges extra headers", () => {
    expect(restHeaders("K", "T", { "content-type": "application/json" })["content-type"]).toBe(
      "application/json",
    )
  })
})

describe("filtersToParams", () => {
  it("maps col=op.value and skips incomplete rows", () => {
    const p = filtersToParams([
      { column: "id", operator: "eq", value: "5" },
      { column: "", operator: "eq", value: "x" },
    ])
    expect(p).toEqual({ id: "eq.5" })
  })
})

describe("restUrl / functionsUrl / storageUrl", () => {
  it("builds rest urls with query", () => {
    expect(restUrl("https://x.supabase.co", "users", { select: "*", id: "eq.1" })).toBe(
      "https://x.supabase.co/rest/v1/users?select=*&id=eq.1",
    )
  })
  it("trims trailing slash", () => {
    expect(restUrl("https://x.supabase.co/", "t")).toBe("https://x.supabase.co/rest/v1/t")
  })
  it("functions + storage", () => {
    expect(functionsUrl("https://x.supabase.co", "hello")).toBe(
      "https://x.supabase.co/functions/v1/hello",
    )
    expect(storageUrl("https://x.supabase.co", "object/list/avatars")).toBe(
      "https://x.supabase.co/storage/v1/object/list/avatars",
    )
  })
})

describe("toCurl", () => {
  it("GET has no body", () => {
    const c = toCurl({ method: "GET", url: "https://x/y", headers: { apikey: "K" } })
    expect(c).toContain("curl -X GET 'https://x/y'")
    expect(c).toContain("-H 'apikey: K'")
    expect(c).not.toContain("--data")
  })
  it("POST serializes and escapes the body", () => {
    const c = toCurl({
      method: "POST",
      url: "https://x/y",
      headers: { "content-type": "application/json" },
      body: { name: "O'Brien" },
    })
    expect(c).toContain("curl -X POST")
    expect(c).toContain("--data '")
    // single quote escaped for the shell
    expect(c).toContain("O'\\''Brien")
  })
  it("passes a string body through", () => {
    const c = toCurl({ method: "POST", url: "u", body: "{}" })
    expect(c).toContain("--data '{}'")
  })
})
