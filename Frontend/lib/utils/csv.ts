export type CsvRecord = Record<string, string>

export function parseCsv(text: string): CsvRecord[] {
    const cleaned = text.replace(/\uFEFF/g, '').trim()
    if (!cleaned) return []
    const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0)
    if (lines.length === 0) return []

    // Auto-detect delimiter: tab vs comma
    const firstLine = lines[0]
    const delimiter = firstLine.includes('\t') ? '\t' : ','

    const headers = delimiter === '\t' ? firstLine.split('\t') : splitCsvLine(firstLine)
    return lines.slice(1).map((line) => {
        const values = delimiter === '\t' ? line.split('\t') : splitCsvLine(line)
        const record: CsvRecord = {}
        headers.forEach((header, index) => {
            if (!header) return
            const value = values[index]
            if (value !== undefined) {
                record[header.trim()] = value.trim()
            }
        })
        return record
    }).filter((row) => Object.keys(row).length > 0)
}

function splitCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"'
                i++
            } else {
                inQuotes = !inQuotes
            }
            continue
        }

        if (char === ',' && !inQuotes) {
            result.push(current)
            current = ''
            continue
        }

        current += char
    }
    result.push(current)
    return result
}

export function normalizeCsvRecord(record: CsvRecord): Record<string, string | string[]> {
    const normalized: Record<string, string | string[]> = {}
    Object.entries(record).forEach(([key, value]) => {
        const trimmed = value?.trim()
        if (!trimmed) return
        if (trimmed.includes(';')) {
            normalized[key] = trimmed.split(';').map((item) => item.trim()).filter(Boolean)
        } else if (trimmed.includes(',')) {
            normalized[key] = trimmed.split(',').map((item) => item.trim()).filter(Boolean)
        } else {
            normalized[key] = trimmed
        }
    })
    return normalized
}
