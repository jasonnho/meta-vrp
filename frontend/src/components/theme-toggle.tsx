import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Button
      variant='ghost'
      size='icon'
      aria-label='Toggle theme'
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className='h-5 w-5' /> : <Moon className='h-5 w-5' />}
    </Button>
  )
}
