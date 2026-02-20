import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [{
    name: 'browser-script-exports',
    transform(code, id) {
      if (id.includes('/utils/') && id.endsWith('.js')) {
        const fnNames = [...code.matchAll(/^function (\w+)/gm)].map(m => m[1]);
        if (fnNames.length > 0) {
          return code + `\nexport { ${fnNames.join(', ')} };`;
        }
      }
    }
  }]
});
