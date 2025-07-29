import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    projectId:'LUM19',
    baseUrl: 'http://localhost:5000',
    supportFile: false,
  },
});
