import { test } from "node:test";
import { ok as assert, deepStrictEqual as assertEquals } from "node:assert/strict";
import { firstJson, pickRivals, sentencesOf, settleSpyResult, shouting, spyInput, spyPrompt } from "../src/rules/spy.mjs";
const item = (rank, title, votes = 50, extra = {}) => ({
    type: "maps_search",
    rank_group: rank,
    title,
    place_id: `pid-${rank}`,
    rating: { value: 4.5, votes_count: votes },
    url: `https://site${rank}.test`,
    ...extra,
});
test("input: a service and a town, trimmed", () => {
    assertEquals(spyInput({ service: "  roof   repair ", location: "Tampa, FL" }), {
        input: { service: "roof repair", location: "Tampa, FL", business: null, placeId: null },
    });
    assert("error" in spyInput({ service: "ab", location: "Tampa" }));
    assert("error" in spyInput({ service: "roof repair", location: "" }));
});
test("rivals: organic Maps listings in order, not the business itself, not ads, not unreviewed", () => {
    const items = [
        { type: "maps_paid_item", rank_group: 0, title: "An Ad" },
        item(3, "Third Roofing"),
        item(1, "Lozano Roofing LLC"),
        item(2, "Second Roofing", 2),
        item(4, "Fourth Roofing"),
        item(5, "Fourth Roofing", 60, { place_id: "pid-4" }),
    ];
    const rivals = pickRivals(items, { name: "Lozano Roofing", placeId: null });
    assertEquals(rivals.map((r) => r.name), ["Third Roofing", "Fourth Roofing"]);
    assertEquals(rivals.map((r) => r.id), ["c1", "c2"]);
    assertEquals(pickRivals(items, { name: null, placeId: "pid-3" }).map((r) => r.name), ["Lozano Roofing LLC", "Fourth Roofing"]);
});
const rivals = pickRivals([item(1, "Alpha Roofing"), item(2, "Beta Roofs")], { name: null, placeId: null });
const reviews = [
    { id: "c1-r1", rival: "c1", stars: 1, text: "They never showed up for the appointment. Nobody called." },
    { id: "c1-r2", rival: "c1", stars: 2, text: "Waited all day and no one came at all." },
    { id: "c2-r1", rival: "c2", stars: 1, text: "THEY NEVER CALLED BACK AND IGNORED US." },
];
test("the model's answer is checked: counts from real ids, quotes rebuilt from real sentences, no rival named in an ad", () => {
    const raw = {
        summary: "Show up and pick up the phone.",
        themes: [
            { name: "No-shows", review_ids: ["c1-r1", "c1-r2", "c9-r9", "c1-r1"], quotes: [{ id: "c1-r1", sentence: 0 }, { id: "c1-r2", sentence: 5 }], angle: "Confirm in writing." },
            { name: "No callbacks", review_ids: ["c2-r1"], quotes: [{ id: "c2-r1", sentence: 0 }] },
            { name: "Made up", review_ids: ["nope"] },
        ],
        ads: [
            { headline: "We Show Up", primary_text: "Booked and left waiting? Not with us.", why: "Most common complaint.", needs: "Only if you show up." },
            { headline: "Better than Alpha Roofing", primary_text: "Unlike them, we come." },
        ],
        offers: [{ offer: "Text reminder the day before", why: "Removes the fear." }, { offer: "Beat Beta Roofs" }],
        rivals: [{ id: "c1", complaints: ["no-shows"], praised_for: ["price"], promises: "Fast quotes" }],
    };
    const r = settleSpyResult(raw, rivals, reviews);
    assertEquals(r.themes.map((t) => [t.name, t.count]), [["No-shows", 2], ["No callbacks", 1]]);
    assertEquals(r.themes[0].quotes.map((q) => q.text), ["They never showed up for the appointment."]);
    assertEquals(r.themes[0].quotes[0].rivalName, "Alpha Roofing");
    // A real quote, but shouting: kept off the page.
    assertEquals(r.themes[1].quotes, []);
    assertEquals(r.ads.map((a) => a.headline), ["We Show Up"]);
    assertEquals(r.offers.map((o) => o.offer), ["Text reminder the day before"]);
    assertEquals(r.rivals[0].low, 2);
    assertEquals(r.readReviews, 3);
    assertEquals(settleSpyResult({ themes: [], ads: [] }, rivals, reviews), null);
    assertEquals(settleSpyResult(null, rivals, reviews), null);
});
test("helpers", () => {
    assertEquals(sentencesOf("One. Two! Three"), ["One.", "Two!", "Three"]);
    assert(shouting("THEY NEVER CALLED BACK"));
    assert(!shouting("They never called back"));
    assertEquals(firstJson('Here: {"a": 1} done'), { a: 1 });
    assertEquals(firstJson("no json"), null);
    const p = spyPrompt({ service: "roof repair", location: "Tampa", business: "Lozano", placeId: null }, rivals, reviews, { c1: "Fast quotes" });
    assert(p.includes("[c1-r1] 1★ (0) They never showed up for the appointment."));
    assert(p.includes('(it is "Lozano")'));
});

