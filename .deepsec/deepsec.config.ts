import { defineConfig } from "deepsec/config";

export default defineConfig({
  projects: [
    { id: "agentifyos", root: ".." },
    // <deepsec:projects-insert-above>
  ],
});
