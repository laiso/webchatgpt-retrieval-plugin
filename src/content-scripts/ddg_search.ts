import cheerio from 'cheerio'
import Browser from 'webextension-polyfill'


// ChatGPT Retrieval Plugin Endpoint
const BASE_URL = 'http://localhost:3333'

export interface SearchRequest {
    query: string
    timerange: string
    region: string
}

export interface SearchResponse {
    metadata: {
        title: string;
        url: string;
    };
    text: string;
}

export interface SearchResult {
    title: string
    body: string
    url: string
}

export async function getHtml({ query, timerange, region }: SearchRequest): Promise<SearchResult[]> {

    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    }

    const response = await fetch(`${BASE_URL}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            queries: [{query}]
        }),
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }

    const json = await response.json();
    return json.results[0].results.map((result: SearchResponse) => {
        return {
            title: result.metadata.title,
            body: result.text,
            url: result.metadata.url,
        }
    })
}

function htmlToSearchResults(html: string, numResults: number): SearchResult[] {
    // console.log("htmlToSearchResults", numResults)
    const $ = cheerio.load(html)
    const results: SearchResult[] = []

    const numTables = $('table').length

    if (!numTables) return results

    // Extract zero-click info, if present
    const zeroClickLink = $(`table:nth-of-type(${numTables-1}) tr td a[rel="nofollow"]`).first()
    if (zeroClickLink.length > 0) {
        results.push({
            title: zeroClickLink.text(),
            body: $('table:nth-of-type(2) tr:nth-of-type(2)').text().trim(),
            url: zeroClickLink.attr('href') ?? '',
        })
    }

    // Extract web search results
    const upperBound = zeroClickLink.length > 0 ? numResults - 1 : numResults
    const webLinks = $(`table:nth-of-type(${numTables}) tr:not(.result-sponsored) .result-link`).slice(0, upperBound)
    const webSnippets = $(`table:nth-of-type(${numTables}) tr:not(.result-sponsored) .result-snippet`).slice(0, upperBound)
    webLinks.each((i, element) => {
        const link = $(element)
        const snippet = $(webSnippets[i]).text().trim()

        results.push({
            title: link.text(),
            body: snippet,
            url: link.attr('href') ?? '',
        })
    })

    return results
}

export async function webSearch(search: SearchRequest, numResults: number): Promise<SearchResult[]> {
    return await Browser.runtime.sendMessage({
        type: "get_search_results",
        search
    });
}
