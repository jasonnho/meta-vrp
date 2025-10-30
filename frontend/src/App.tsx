// frontend/src/App.tsx
import Router from './router' // <-- Impor router Anda
import { ThemeProvider } from './components/theme-provider'
import { TooltipProvider } from './components/ui/tooltip' // <-- Bungkus dengan TooltipProvider

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Router />
      </TooltipProvider>
    </ThemeProvider>
  )
}
export default App
