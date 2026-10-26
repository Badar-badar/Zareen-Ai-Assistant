import { describe, it, expect } from "vitest";
import { isPrivateIp, assertSafeUrl, htmlToText } from "../src/agent/browser.js";
import { parsePlan } from "../src/agent/orchestrator.js";

describe("Day 13: the browser refuses unsafe addresses", () => {
  it("flags private, loopback and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    expect(isPrivateIp("93.184.216.34")).toBe(false);
    expect(isPrivateIp("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });

  it("rejects bad URLs before any request is made", () => {
    for (const u of [
      "file:///etc/passwd", "ftp://example.com", "http://127.0.0.1/", "http://localhost:3000/".replace("localhost", "[::1]"),
      "http://169.254.169.254/latest/meta-data", "http://2130706433/", "https://user:pw@example.com/", "https://example.com:8080/", "not a url",
    ]) {
      expect(() => assertSafeUrl(u)).toThrow();
    }
    expect(assertSafeUrl("https://example.com/page").hostname).toBe("example.com");
  });

  it("turns a page into short plain text without scripts or tags", () => {
    const t = htmlToText("<html><head><title>x</title></head><body><script>steal()</script><h1>Price</h1><p>$45 &amp; free shipping</p></body></html>");
    expect(t).toBe("Price $45 & free shipping");
  });
});

describe("Day 13: the plan is validated by code, not trusted", () => {
  const msg = "Compare with https://example.com/shop and our policy";
  it("keeps a browser step only for a URL the user wrote", () => {
    const ok = parsePlan('{"steps":[{"worker":"browser","task":"price","url":"https://example.com/shop"}]}', msg);
    expect(ok).toHaveLength(1);
    const invented = parsePlan('{"steps":[{"worker":"browser","task":"price","url":"https://evil.com/x"}]}', msg);
    expect(invented).toHaveLength(0);
  });
  it("drops a browser step whose URL is private, even if the user wrote it", () => {
    const m = "open http://169.254.169.254/latest/meta-data";
    expect(parsePlan('{"steps":[{"worker":"browser","task":"read","url":"http://169.254.169.254/latest/meta-data"}]}', m)).toHaveLength(0);
  });
  it("rejects unknown workers, more than 3 steps, and bad JSON", () => {
    expect(parsePlan('{"steps":[{"worker":"admin","task":"x"}]}', msg)).toBeNull();
    const four = Array.from({ length: 4 }, () => '{"worker":"tools","task":"x"}').join(",");
    expect(parsePlan(`{"steps":[${four}]}`, msg)).toBeNull();
    expect(parsePlan("not json", msg)).toBeNull();
  });
  it("removes duplicate workers and allows an empty plan", () => {
    expect(parsePlan('{"steps":[{"worker":"tools","task":"a"},{"worker":"tools","task":"b"}]}', msg)).toHaveLength(1);
    expect(parsePlan('{"steps":[]}', msg)).toEqual([]);
  });
});