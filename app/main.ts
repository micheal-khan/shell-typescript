import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.setPrompt("$ ");
rl.prompt();

const builtInCommands = ["echo", "exit", "type"];

const typeCheck = (parts) => {
  for (let index = 0; index < builtInCommands.length; index++) {
    const element = builtInCommands[index];
    if (parts[1] === element) {
      return true;
    }
  }
  return false;
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
        const check = typeCheck(parts);

        if (check === true) {
          console.log(`${parts[1]} is a shell builtin`);
        } else {
          console.log(`${parts[1]} not found`);
        }
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
