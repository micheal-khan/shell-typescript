import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.setPrompt("$ ");
rl.prompt();

rl.on("line", (line) => {
  const command = line.trim();
  if (command) {
    const parts = command.split(/\s+/);

    switch (parts[0]) {
      case "echo":
        console.log(parts.slice(1).join(" "));
        break;

      case "exit":
        rl.close();
        break;

      default:
        console.log(`${command}: command not found`);
        break;
    }
    rl.prompt();
  }
});

rl.on("close", () => {
  process.exit(0);
});
