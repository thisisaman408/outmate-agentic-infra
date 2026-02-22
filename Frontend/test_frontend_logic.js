const testQuery = "Find Marketing decision makers at digital agencies with 1 to 50 employees in Texas and Florida";

function testIntent(query) {
    const queryLower = query.toLowerCase()
    const prospectKeywords = [
        'people', 'prospects', 'person', 'contacts', 'vp', 'ceo', 'cto', 'head of', 'manager',
        'engineer', 'decision makers', 'directors', 'founders', 'who is', 'who are', 'who works'
    ]
    const companyKeywords = ['companies', 'business', 'businesses', 'firm', 'startup', 'saas', 'b2b', 'agencies', 'agency']

    const hasProspectKeyword = prospectKeywords.some(kw => queryLower.includes(kw))
    const hasCompanyKeyword = companyKeywords.some(kw => queryLower.includes(kw))

    // FORCE prospect intent if "decision makers" or other strong signals are present
    const strongProspectSignal = /\b(decision makers?|profiles?|contacts?|emails?|phones?)\b/i.test(queryLower)

    const searchIntent = (strongProspectSignal || (hasProspectKeyword && !hasCompanyKeyword)) ? "prospect" : "business"

    console.log(`Query: "${query}"`);
    console.log(`hasProspectKeyword: ${hasProspectKeyword}`);
    console.log(`hasCompanyKeyword: ${hasCompanyKeyword}`);
    console.log(`strongProspectSignal: ${strongProspectSignal}`);
    console.log(`Final Intent: ${searchIntent}`);

    return searchIntent;
}

const result = testIntent(testQuery);
if (result === "prospect") {
    console.log("SUCCESS: Intent correctly identified as prospect");
} else {
    console.log("FAILURE: Intent identified as business");
}
