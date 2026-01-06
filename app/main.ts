import fs from "fs";
import path from "path";
import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const builtInCommands = ["echo", "exit", "type"];

rl.setPrompt("$ ");
rl.prompt();

const typeCheck = (parts: string[]) => {
  const command = parts[1];
  if (!command) return;

  // Built-in check
  if (builtInCommands.includes(command)) {
    console.log(`${command} is a shell builtin`);
    return;
  }

  // PATH search (portable: Linux + Windows)
  const paths = process.env.PATH?.split(path.delimiter) || [];

  for (const dir of paths) {
    const fullPath = path.join(dir, command);

    if (fs.existsSync(fullPath)) {
      try {
        fs.accessSync(fullPath, fs.constants.X_OK);
        console.log(`${command} is ${fullPath}`);
        return;
      } catch {
        // exists but not executable → continue
      }
    }
  }

  console.log(`${command}: not found`);
};

rl.on("line", (line) => {
  const input = line.trim();
  if (!input) {
    rl.prompt();
    return;
  }

  const parts = input.split(/\s+/);

  switch (parts[0]) {
    case "echo":
      console.log(parts.slice(1).join(" "));
      break;

    case "exit":
      rl.close();
      return;

    case "type":
      typeCheck(parts);
      break;

    default:
      console.log(`${input}: command not found`);
      break;
  }

  rl.prompt();
});

rl.on("close", () => {
  process.exit(0);
});
