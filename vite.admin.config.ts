import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Segunda etapa do build: o painel de administração (admin.html) fica separado do site para não pesar nele,
// já que carrega a biblioteca de leitura de planilhas.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { target: 'es2020', cssCodeSplit: false, emptyOutDir: false, rollupOptions: { input: 'admin.html' } },
})
