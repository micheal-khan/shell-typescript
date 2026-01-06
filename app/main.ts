import fs from "fs";
import path from "path";
import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.setPrompt("$ ");
rl.prompt();

const builtInCommands = ["echo", "exit", "type"];

const typeCheck = (parts: any[]) => {
  const command = parts[1];

  // built-in check
  if (builtInCommands.includes(command)) {
    console.log(`${command} is a shell builtin`);
    return;
  }

  const paths = process.env.PATH || "";

  for (const dir of paths) {
    const fullPath = path.join(dir, command);

    if (fs.existsSync(fullPath)) {
      try {
        fs.accessSync(fullPath, fs.constants.X_OK);
        console.log(`${command} is ${fullPath}`);
        return; // STOP ONLY WHEN FOUND
      } catch {
        // exists but not executable → continue
      }
    }
  }

  // ONLY after checking ALL PATH dirs
  console.log(`${command}: not found`);
};

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

      case "type":
        typeCheck(parts);
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
