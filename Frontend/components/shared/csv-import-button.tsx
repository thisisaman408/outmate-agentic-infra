"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { UploadCloud } from "lucide-react"

interface CsvImportButtonProps {
    label?: string
    onRecordsParsed: (records: Record<string, string>[]) => void
    className?: string
}

export function CsvImportButton({ label = "Import CSV", onRecordsParsed, className = "" }: CsvImportButtonProps) {
    const inputRef = React.useRef<HTMLInputElement | null>(null)

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const fileName = file.name.toLowerCase()

        if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
            // Excel file — parse with xlsx library
            const XLSX = (await import("xlsx"))
            const buffer = await file.arrayBuffer()
            const workbook = XLSX.read(buffer, { type: "array" })
            const sheetName = workbook.SheetNames[0]
            const sheet = workbook.Sheets[sheetName]
            const records: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" })
            // Ensure all values are strings
            const stringRecords = records.map((row) => {
                const cleaned: Record<string, string> = {}
                Object.entries(row).forEach(([key, value]) => {
                    cleaned[key.trim()] = String(value ?? "").trim()
                })
                return cleaned
            }).filter((row) => Object.keys(row).length > 0)
            onRecordsParsed(stringRecords)
        } else {
            // CSV/TSV file
            const text = await file.text()
            const { parseCsv } = await import("@/lib/utils/csv")
            const records = parseCsv(text)
            onRecordsParsed(records)
        }

        if (inputRef.current) inputRef.current.value = ""
    }

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handleFileChange}
            />
            <Button variant="outline" className={`gap-2 ${className || ""}`} onClick={() => inputRef.current?.click()}>
                <UploadCloud className="h-4 w-4" />
                {label}
            </Button>
        </>
    )
}
