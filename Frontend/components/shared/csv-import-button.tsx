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
        const text = await file.text()
        const { parseCsv } = await import("@/lib/utils/csv")
        const records = parseCsv(text)
        onRecordsParsed(records)
        if (inputRef.current) inputRef.current.value = ""
    }

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="text/csv"
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
