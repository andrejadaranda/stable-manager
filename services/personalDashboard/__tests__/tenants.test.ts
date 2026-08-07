// Tests for telling real customers apart from test data.
//
// These use the ACTUAL seven stables that were in production when the
// "7 arklidės" number was questioned, because the point of this module
// is to get that specific answer right — and to keep getting it right
// as more test accounts accumulate.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { classifyStable, summarise, customersCreatedBetween } from "../tenants.ts";

const OPERATOR = "darandaandreja@icloud.com";
const OWN_STABLE = "32479602-17b9-4c78-8062-2ba425fae1e1"; // Trakų Jojimo Klubas

const one = (
  name: string,
  ownerEmail: string | null,
  id = name,
  createdAt = "2026-05-01T00:00:00Z",
) =>
  classifyStable({
    id,
    name,
    createdAt,
    ownerEmail,
    operatorEmail: OPERATOR,
    ownStableId: OWN_STABLE,
  });

// -------------------------------------------------------------------
describe("classifyStable — the real production seven", () => {
  test("a test.com signup is not a customer", () => {
    assert.equal(one("Test Stable", "test@test.com").kind, "internal");
  });

  test("her own club is 'own', not a customer and not test data", () => {
    // Counting her own club as a Longrein customer would be the most
    // flattering error available.
    assert.equal(one("Trakų Jojimo Klubas", OPERATOR, OWN_STABLE).kind, "own");
  });

  test("her throwaway signup on a different domain is still hers", () => {
    // darandaandreja@gmail.com — same person, different provider. Domain
    // matching alone would let this count as growth.
    assert.equal(one("andrejos test", "darandaandreja@gmail.com").kind, "internal");
  });

  test("a +alias of her own address is still hers", () => {
    assert.equal(
      one("Launch Test Stable", "darandaandreja+lt1@icloud.com").kind,
      "internal",
    );
  });

  test("a seeded demo stable on the company domain is not a customer", () => {
    // Avalon had 129 lessons and looked like the best customer on the
    // platform. It was demo.owner@longrein.eu.
    assert.equal(
      one("Avalon Equestrian Centre", "demo.owner@longrein.eu").kind,
      "internal",
    );
  });

  test("a real external person IS a customer", () => {
    assert.equal(
      one("Adomas Kunigauskas — Personal", "adomas.kunigauskas@gmail.com").kind,
      "customer",
    );
    assert.equal(one("Seskiene", "laura@horseland.lt").kind, "customer");
  });

  test("the seven together come to exactly two customers", () => {
    const all = [
      one("Test Stable", "test@test.com"),
      one("Trakų Jojimo Klubas", OPERATOR, OWN_STABLE),
      one("andrejos test", "darandaandreja@gmail.com"),
      one("Launch Test Stable", "darandaandreja+lt1@icloud.com"),
      one("Adomas Kunigauskas — Personal", "adomas.kunigauskas@gmail.com"),
      one("Avalon Equestrian Centre", "demo.owner@longrein.eu"),
      one("Seskiene", "laura@horseland.lt"),
    ];
    const summary = summarise(all);
    assert.equal(summary.total, 7);
    assert.equal(summary.customers, 2);
    assert.equal(summary.own, 1);
    assert.equal(summary.internal, 4);
  });
});

describe("classifyStable — edges", () => {
  test("a stable with no owner is a broken signup, not a customer", () => {
    assert.equal(one("Orphan", null).kind, "internal");
  });

  test("email casing and whitespace do not create a phantom customer", () => {
    assert.equal(one("Shouty", "  DARANDAANDREJA@ICLOUD.COM  ").kind, "internal");
  });

  test("a manual exclusion wins over the rule", () => {
    // The escape hatch for a helper who signed up with a real address.
    const result = classifyStable({
      id: "friend-stable",
      name: "A friend helping test",
      createdAt: "2026-05-01T00:00:00Z",
      ownerEmail: "someone@realdomain.lt",
      operatorEmail: OPERATOR,
      ownStableId: OWN_STABLE,
      excludedIds: ["friend-stable"],
    });
    assert.equal(result.kind, "internal");
  });

  test("a customer whose name merely contains 'test' still counts", () => {
    // The rule is about who owns it, not what it is called. A real club
    // called "Testų žirgynas" is a real club.
    assert.equal(one("Testų žirgynas", "info@zirgynas.lt").kind, "customer");
  });
});

// -------------------------------------------------------------------
describe("customersCreatedBetween", () => {
  const all = [
    one("Old customer", "a@real.lt", "a", "2026-01-10T00:00:00Z"),
    one("New customer", "b@real.lt", "b", "2026-07-20T00:00:00Z"),
    one("New test", "test@test.com", "c", "2026-07-21T00:00:00Z"),
    one("Her club", OPERATOR, OWN_STABLE, "2026-07-22T00:00:00Z"),
  ];

  test("counts only customers inside the window", () => {
    assert.equal(
      customersCreatedBetween(all, "2026-07-01T00:00:00Z", "2026-08-01T00:00:00Z"),
      1,
    );
  });

  test("test accounts created this month do not look like growth", () => {
    // The whole failure mode in one assertion: three stables were created
    // in July, only one of them was a customer.
    const july = customersCreatedBetween(
      all,
      "2026-07-01T00:00:00Z",
      "2026-08-01T00:00:00Z",
    );
    assert.notEqual(july, 3);
    assert.equal(july, 1);
  });

  test("an empty window is zero, not a crash", () => {
    assert.equal(
      customersCreatedBetween(all, "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z"),
      0,
    );
  });
});
