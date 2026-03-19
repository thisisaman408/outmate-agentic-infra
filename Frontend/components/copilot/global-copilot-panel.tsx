"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, Send, X, RefreshCw, MessageSquare, ArrowRight, LayoutDashboard } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useChatbot, Message } from "@/hooks/use-chatbot"
import { usePathname, useRouter } from "next/navigation"

export function GlobalCopilotPanel() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const { messages, isLoading, sendMessage } = useChatbot()
  const pathname = usePathname()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const currentInput = input
    setInput("")
    await sendMessage(currentInput, pathname)
  }

  const handleLinkClick = (url: string) => {
    router.push(url)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 transition-all duration-300 scale-110"
          title="Outmate Copilot"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0 flex flex-col border-l shadow-2xl">
        <SheetHeader className="px-6 pt-6 pb-4 bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2.5 text-lg font-bold">
              <Sparkles className="h-5 w-5 text-primary" />
              Outmate Copilot
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Ask about any feature in Outmate or how to use it.
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4" viewportRef={scrollRef}>
          <div className="space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold">Welcome to Outmate Copilot!</p>
                  <p className="text-sm text-muted-foreground px-4">
                    I'm here to help you navigate the platform and answer your questions.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-3 w-full max-w-[300px]">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start gap-2 h-10 px-4"
                    onClick={() => handleLinkClick("/copilot/daily-brief")}
                  >
                    <LayoutDashboard className="h-4 w-4 text-emerald-500" />
                    View Today's Daily Brief
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start gap-2 h-10 px-4"
                    onClick={() => setInput("What are signals?")}
                  >
                    <RefreshCw className="h-4 w-4 text-blue-500" />
                    "What are signals?"
                  </Button>
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted/80 text-foreground rounded-tl-none border border-border/50"
                    }`}
                  >
                    {msg.role === "assistant" && !msg.content ? (
                      <div className="flex gap-1 py-1">
                        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                      </div>
                    ) : (
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                    
                    {msg.links && msg.links.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-border/20"
                      >
                        {msg.links.map((link, idx) => (
                          <Button
                            key={idx}
                            variant="secondary"
                            size="sm"
                            className="h-8 text-[11px] gap-1.5 font-medium hover:bg-primary hover:text-primary-foreground transition-all"
                            onClick={() => handleLinkClick(link.url)}
                          >
                            {link.label}
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-muted/80 text-foreground rounded-2xl rounded-tl-none px-4 py-3 text-sm border border-border/50 shadow-sm flex items-center gap-3">
                  <div className="flex gap-1">
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                    />
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                    />
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                    />
                  </div>
                  <span className="text-muted-foreground font-medium">Thinking...</span>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        <div className="p-6 bg-muted/30 border-t">
          <form onSubmit={handleSend} className="relative group">
            <Input
              placeholder="Ask anything about Outmate..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="pr-12 py-6 rounded-xl border-border/60 focus:ring-2 focus:ring-primary/20 transition-all bg-background shadow-inner"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg transition-all duration-300 ${
                input.trim() ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
              }`}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-center text-muted-foreground mt-3 font-medium">
            AI-powered product intelligence • {pathname}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
