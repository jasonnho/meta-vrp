// src/App.tsx
import Router from "./router";
import { ThemeProvider } from "./components/theme-provider";
import { TooltipProvider } from "./components/ui/tooltip";

function App() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <TooltipProvider>
                <Router />
            </TooltipProvider>
        </ThemeProvider>
    );
}

// Kita gunakan default export agar main.tsx lebih simpel
export default App;
