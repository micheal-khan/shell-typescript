#!/usr/bin/env bun
// @bun
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/shell-quote/quote.js
var require_quote = __commonJS((exports, module) => {
  module.exports = function quote(xs) {
    return xs.map(function(s) {
      if (s === "") {
        return "''";
      }
      if (s && typeof s === "object") {
        return s.op.replace(/(.)/g, "\\$1");
      }
      if (/["\s\\]/.test(s) && !/'/.test(s)) {
        return "'" + s.replace(/(['])/g, "\\$1") + "'";
      }
      if (/["'\s]/.test(s)) {
        return '"' + s.replace(/(["\\$`!])/g, "\\$1") + '"';
      }
      return String(s).replace(/([A-Za-z]:)?([#!"$&'()*,:;<=>?@[\\\]^`{|}])/g, "$1\\$2");
    }).join(" ");
  };
});

// node_modules/shell-quote/parse.js
var require_parse = __commonJS((exports, module) => {
  var CONTROL = "(?:" + [
    "\\|\\|",
    "\\&\\&",
    ";;",
    "\\|\\&",
    "\\<\\(",
    "\\<\\<\\<",
    ">>",
    ">\\&",
    "<\\&",
    "[&;()|<>]"
  ].join("|") + ")";
  var controlRE = new RegExp("^" + CONTROL + "$");
  var META = "|&;()<> \\t";
  var SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
  var DOUBLE_QUOTE = "'((\\\\'|[^'])*?)'";
  var hash = /^#$/;
  var SQ = "'";
  var DQ = '"';
  var DS = "$";
  var TOKEN = "";
  var mult = 4294967296;
  for (i = 0;i < 4; i++) {
    TOKEN += (mult * Math.random()).toString(16);
  }
  var i;
  var startsWithToken = new RegExp("^" + TOKEN);
  function matchAll(s, r) {
    var origIndex = r.lastIndex;
    var matches = [];
    var matchObj;
    while (matchObj = r.exec(s)) {
      matches.push(matchObj);
      if (r.lastIndex === matchObj.index) {
        r.lastIndex += 1;
      }
    }
    r.lastIndex = origIndex;
    return matches;
  }
  function getVar(env, pre, key) {
    var r = typeof env === "function" ? env(key) : env[key];
    if (typeof r === "undefined" && key != "") {
      r = "";
    } else if (typeof r === "undefined") {
      r = "$";
    }
    if (typeof r === "object") {
      return pre + TOKEN + JSON.stringify(r) + TOKEN;
    }
    return pre + r;
  }
  function parseInternal(string, env, opts) {
    if (!opts) {
      opts = {};
    }
    var BS = opts.escape || "\\";
    var BAREWORD = "(\\" + BS + `['"` + META + `]|[^\\s'"` + META + "])+";
    var chunker = new RegExp([
      "(" + CONTROL + ")",
      "(" + BAREWORD + "|" + SINGLE_QUOTE + "|" + DOUBLE_QUOTE + ")+"
    ].join("|"), "g");
    var matches = matchAll(string, chunker);
    if (matches.length === 0) {
      return [];
    }
    if (!env) {
      env = {};
    }
    var commented = false;
    return matches.map(function(match) {
      var s = match[0];
      if (!s || commented) {
        return;
      }
      if (controlRE.test(s)) {
        return { op: s };
      }
      var quote = false;
      var esc = false;
      var out = "";
      var isGlob = false;
      var i2;
      function parseEnvVar() {
        i2 += 1;
        var varend;
        var varname;
        var char = s.charAt(i2);
        if (char === "{") {
          i2 += 1;
          if (s.charAt(i2) === "}") {
            throw new Error("Bad substitution: " + s.slice(i2 - 2, i2 + 1));
          }
          varend = s.indexOf("}", i2);
          if (varend < 0) {
            throw new Error("Bad substitution: " + s.slice(i2));
          }
          varname = s.slice(i2, varend);
          i2 = varend;
        } else if (/[*@#?$!_-]/.test(char)) {
          varname = char;
          i2 += 1;
        } else {
          var slicedFromI = s.slice(i2);
          varend = slicedFromI.match(/[^\w\d_]/);
          if (!varend) {
            varname = slicedFromI;
            i2 = s.length;
          } else {
            varname = slicedFromI.slice(0, varend.index);
            i2 += varend.index - 1;
          }
        }
        return getVar(env, "", varname);
      }
      for (i2 = 0;i2 < s.length; i2++) {
        var c = s.charAt(i2);
        isGlob = isGlob || !quote && (c === "*" || c === "?");
        if (esc) {
          out += c;
          esc = false;
        } else if (quote) {
          if (c === quote) {
            quote = false;
          } else if (quote == SQ) {
            out += c;
          } else {
            if (c === BS) {
              i2 += 1;
              c = s.charAt(i2);
              if (c === DQ || c === BS || c === DS) {
                out += c;
              } else {
                out += BS + c;
              }
            } else if (c === DS) {
              out += parseEnvVar();
            } else {
              out += c;
            }
          }
        } else if (c === DQ || c === SQ) {
          quote = c;
        } else if (controlRE.test(c)) {
          return { op: s };
        } else if (hash.test(c)) {
          commented = true;
          var commentObj = { comment: string.slice(match.index + i2 + 1) };
          if (out.length) {
            return [out, commentObj];
          }
          return [commentObj];
        } else if (c === BS) {
          esc = true;
        } else if (c === DS) {
          out += parseEnvVar();
        } else {
          out += c;
        }
      }
      if (isGlob) {
        return { op: "glob", pattern: out };
      }
      return out;
    }).reduce(function(prev, arg) {
      return typeof arg === "undefined" ? prev : prev.concat(arg);
    }, []);
  }
  module.exports = function parse(s, env, opts) {
    var mapped = parseInternal(s, env, opts);
    if (typeof env !== "function") {
      return mapped;
    }
    return mapped.reduce(function(acc, s2) {
      if (typeof s2 === "object") {
        return acc.concat(s2);
      }
      var xs = s2.split(RegExp("(" + TOKEN + ".*?" + TOKEN + ")", "g"));
      if (xs.length === 1) {
        return acc.concat(xs[0]);
      }
      return acc.concat(xs.filter(Boolean).map(function(x) {
        if (startsWithToken.test(x)) {
          return JSON.parse(x.split(TOKEN)[1]);
        }
        return x;
      }));
    }, []);
  };
});

// app/main.ts
import fs from "fs";
import path from "path";

// node_modules/shell-quote/index.js
var $quote = require_quote();
var $parse = require_parse();

// app/main.ts
import { createInterface } from "readline";
import { spawn } from "child_process";
var rl = createInterface({
  input: process.stdin,
  output: process.stdout
});
var builtInCommands = ["echo", "exit", "type", "pwd", "cd"];
rl.setPrompt("$ ");
rl.prompt();
var findExecutable = (command) => {
  const paths = process.env.PATH?.split(path.delimiter) || [];
  for (const dir of paths) {
    const fullPath = path.join(dir, command);
    if (fs.existsSync(fullPath)) {
      try {
        fs.accessSync(fullPath, fs.constants.X_OK);
        return fullPath;
      } catch {}
    }
  }
  return null;
};
var typeCheck = (parts) => {
  const command = parts[1];
  if (!command)
    return;
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
rl.on("line", (line) => {
  const input = line.trim();
  if (!input) {
    rl.prompt();
    return;
  }
  const parts = $parse(input);
  const cmd = parts[0];
  const args = parts.slice(1);
  switch (cmd) {
    case "cd":
      try {
        if (args.toString() === "~") {
          process.chdir(process.env.HOME || process.env.USERPROFILE || "/");
        } else {
          process.chdir(args.toString());
        }
      } catch (err) {
        console.error(`${args}: No such file or directory`);
      }
      rl.prompt();
      break;
    case "pwd":
      console.log(process.cwd());
      rl.prompt();
      break;
    case "echo":
      console.log(args.join(" "));
      rl.prompt();
      break;
    case "exit":
      rl.close();
      break;
    case "type":
      typeCheck(parts);
      rl.prompt();
      break;
    default: {
      const exe = findExecutable(cmd);
      if (!exe) {
        console.log(`${cmd}: command not found`);
        rl.prompt();
        return;
      }
      const child = spawn(exe, args, {
        stdio: "inherit",
        argv0: cmd
      });
      child.on("exit", () => {
        rl.prompt();
      });
      break;
    }
  }
});
rl.on("close", () => {
  process.exit(0);
});
