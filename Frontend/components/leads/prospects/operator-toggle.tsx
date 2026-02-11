import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface OperatorToggleProps {
    operator: 'in' | 'not_in'
    onChange: (operator: 'in' | 'not_in') => void
}

export function OperatorToggle({ operator, onChange }: OperatorToggleProps) {
    return (
        <div className="flex gap-2 mb-2 p-2 bg-muted/30 rounded-md border border-border/40">
            <Button
                type="button"
                size="sm"
                className={cn(
                    "flex-1 h-8 text-xs font-medium transition-all",
                    operator === 'in'
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                onClick={() => onChange('in')}
            >
                Include
            </Button>
            <Button
                type="button"
                size="sm"
                className={cn(
                    "flex-1 h-8 text-xs font-medium transition-all",
                    operator === 'not_in'
                        ? "bg-destructive text-destructive-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                onClick={() => onChange('not_in')}
            >
                Exclude
            </Button>
        </div>
    )
}
