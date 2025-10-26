// src/components/Footer.tsx

import { Github } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="flex-shrink-0 border-t bg-background">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <p className="text-sm text-muted-foreground">
          © {currentYear} Proyek Capstone Armada Hijau.
        </p>
        <div className="flex items-center gap-2">
          {/* Ganti 'YOUR_GITHUB_REPO_URL' dengan URL repo Anda */}
          <Button
            variant="ghost"
            size="icon"
            asChild
          >
            <a
              href="https://github.com/jasonnho/meta-vrp" // Ganti ini jika URL repo Anda berbeda
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" />
              <span className="sr-only">GitHub Repository</span>
            </a>
          </Button>
        </div>
      </div>
    </footer>
  )
}
