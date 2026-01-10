#!/usr/bin/env bun

import fs from "fs";
import path from "path";
import { parse } from "shell-quote";
import { createInterface } from "readline";
import { spawn } from "child_process";

const shell = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const builtInCommands = ["echo", "exit", "type", "pwd", "cd"];

shell.setPrompt("$ ");
shell.prompt();

const findExecutable = (command: string): string | null => {
  const paths = process.env.PATH?.split(path.delimiter) || [];

  for (const dir of paths) {
    const fullPath = path.join(dir, command);
    if (fs.existsSync(fullPath)) {
      try {
        fs.accessSync(fullPath, fs.constants.X_OK);
        return fullPath;
      } catch {
        // not executable
      }
    }
  }
  return null;
};

const typeCheck = (parts: string[]) => {
  const command = parts[1];
  if (!command) return;

  if (builtInCommands.includes(command)) {
    console.log(`${command} is a shell builtin`);
    return;
  }

  const exe = findExecutable(command);
  if (exe) {
    console.log(`${command} is ${exe}`);
  } else {
    console.log(`${command}: not found`);
  }
};

const extractRedirection = (tokens: any[]) => {
  for (let i = 0; i < tokens.length; i++) {
    // Case: 2>> file (single operator)
    if (tokens[i]?.op === "2>>") {
      const file = tokens[i + 1];
      if (typeof file !== "string") return null;

      return {
        fd: 2,
        append: true,
        file,
        cleanTokens: tokens.filter((_, idx) => idx !== i && idx !== i + 1),
      };
    }

    // Case: 2 >> file (split tokens)
    if (
      tokens[i]?.op === ">>" &&
      typeof tokens[i - 1] === "string" &&
      tokens[i - 1] === "2"
    ) {
      const file = tokens[i + 1];
      if (typeof file !== "string") return null;

      return {
        fd: 2,
        append: false,
        file,
        cleanTokens: tokens.filter(
          (_, idx) => idx !== i - 1 && idx !== i && idx !== i + 1
        ),
      };
    }

    // Case: 1 >> file
    if (
      tokens[i]?.op === ">>" &&
      typeof tokens[i - 1] === "string" &&
      tokens[i - 1] === "1"
    ) {
      const file = tokens[i + 1];
      if (typeof file !== "string") return null;

      return {
        fd: 1,
        append: true,
        file,
        cleanTokens: tokens.filter(
          (_, idx) => idx !== i - 1 && idx !== i && idx !== i + 1
        ),
      };
    }

    // Case: >> file OR 1>> file
    if (tokens[i]?.op === ">>" || tokens[i]?.op === "1>>") {
      const file = tokens[i + 1];
      if (typeof file !== "string") return null;

      return {
        fd: 1,
        append: true,
        file,
        cleanTokens: tokens.filter((_, idx) => idx !== i && idx !== i + 1),
      };
    }

    // Case: 2> file  OR 1> file  (single operator)
    if (tokens[i]?.op === "1>" || tokens[i]?.op === "2>") {
      const fd = tokens[i].op === "2>" ? 2 : 1;
      const file = tokens[i + 1];
      if (typeof file !== "string") return null;

      return {
        fd,
        file,
        cleanTokens: tokens.filter((_, idx) => idx !== i && idx !== i + 1),
      };
    }

    // Case: 1 > file  OR 2 > file (split tokens)
    if (
      tokens[i]?.op === ">" &&
      typeof tokens[i - 1] === "string" &&
      (tokens[i - 1] === "1" || tokens[i - 1] === "2")
    ) {
      const fd = Number(tokens[i - 1]);
      const file = tokens[i + 1];
      if (typeof file !== "string") return null;

      return {
        fd,
        file,
        cleanTokens: tokens.filter(
          (_, idx) => idx !== i - 1 && idx !== i && idx !== i + 1
        ),
      };
    }

    // Case: > file (default stdout)
    if (tokens[i]?.op === ">") {
      const file = tokens[i + 1];
      if (typeof file !== "string") return null;

      return {
        fd: 1,
        file,
        cleanTokens: tokens.filter((_, idx) => idx !== i && idx !== i + 1),
      };
    }
  }

  return null;
};

shell.on("line", (line) => {
  const input = line.trim();
  if (!input) {
    shell.prompt();
    return;
  }

  const parsed = parse(input) as any[];

  const redirection = extractRedirection(parsed);

  const tokens = redirection ? redirection.cleanTokens : parsed;

  const parts = tokens.filter((t) => typeof t === "string");

  const cmd = parts[0];
  const args = parts.slice(1);

  switch (cmd) {
    case "cd":
      try {
        if (args.toString() === "~") {
          process.chdir(process.env.HOME || process.env.USERPROFILE || "/");
        } else {
          process.chdir(args.toString()); // Changes the working directory of the Node.js process
        }
      } catch (err) {
        console.error(`${args}: No such file or directory`);
      }
      shell.prompt();

      break;

    case "pwd":
      console.log(process.cwd());
      shell.prompt();
      break;

    case "echo": {
      const output = args.join(" ").replace(/\s+$/, "") + "\n";

      if (redirection) {
        if (redirection.fd === 1) {
          if (redirection.append) {
            fs.appendFileSync(redirection.file, output);
          } else {
            fs.writeFileSync(redirection.file, output);
          }
        } else {
          // fd === 2 → echo never writes to stderr
          fs.closeSync(fs.openSync(redirection.file, "w"));
          process.stdout.write(output);
        }
      } else {
        process.stdout.write(output);
      }

      shell.prompt();
      break;
    }

    case "exit":
      shell.close();
      break;

    case "type":
      typeCheck(parts);
      shell.prompt();
      break;

    default: {
      const exe = findExecutable(cmd);
      if (!exe) {
        console.log(`${cmd}: command not found`);
        shell.prompt();
        return;
      }

      let stdio: any = ["inherit", "inherit", "inherit"];

      if (redirection) {
        const flags = redirection.append ? "a" : "w";
        const fd = fs.openSync(redirection.file, flags);
      }

      const child = spawn(exe, args, {
        stdio,
        argv0: cmd,
      });

      child.on("exit", () => {
        shell.prompt();
      });

      break;
    }
  }
});

shell.on("close", () => {
  process.exit(0);
});
