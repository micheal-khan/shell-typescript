import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// TODO: Uncomment the code below to pass the first stage
const askQuestion = () => {
  rl.question("$ ", (command) => {
    console.log(`${command}: command not found`);
  });
};
while (true) {
  askQuestion();
}
