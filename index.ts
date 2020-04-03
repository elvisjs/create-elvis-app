#!/usr/bin/env ts-node
import boxen from "boxen";
import chalk from "chalk";
import spawn from "cross-spawn";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import prompts from "prompts";

const caveat: (
    appName: string,
    root: string,
    cmd: string,
) => Promise<string> = async (
    appName: string,
    root: string,
    cmd: string,
    ) => `
${chalk.greenBright("Success!")} Created ${chalk.cyan(appName)} at:

  ${chalk.dim(root)}

Inside that directory, you can run several commands: 

  - ${chalk.bold.cyan(cmd + " dev")}:    Starts the development server.
  - ${chalk.bold.cyan(cmd + " docs")}:   Open The Elvis Book.
  - ${chalk.bold.cyan(cmd + " build")}:  Builds ${appName} for production.
  - ${chalk.bold.cyan(cmd + " start")}:  Runs ${appName} production mode.

We suggest that you begin by typing:

  - ${chalk.bold.cyan("cd")} ${appName}
  - ${chalk.bold.cyan(cmd + " dev")}
`.slice(1);

const home: (appName: string) => Promise<string> = async (appName: string) => `
/* home page for ${appName} */
import { Center, StatefulWidget, Text } from "calling-elvis";

export default class Index extends StatefulWidget {
  render() {
    return Center(
      Text("Is anybody home?", {
        bold: true,
        italic: true,
        size: 6,
      })
    );
  }
}
`.slice(1);

const packageJson: (appName: string) => Promise<string> = async (appName: string) => `
{
  "name": "${appName}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "elvis build",
    "dev": "elvis dev",
    "docs": "elvis docs",
    "start": "elvis start"
  }
}
`.slice(1);

const readme: (appName: string) => Promise<string> = async (appName: string) => `
# ${appName}

This project is bootstrapped by [Create Elvis App][1].

Find the most recent version of this guide at [here][2]. And check out [Elvis.js][3] for the most up-to-date info.


## Available Scripts

### \`npm run dev\`

Runs the app in the development mode.
Open http://localhost:1439 to view it in the browser.

The page will reload if you make edits.
You will also see any errors in the console.

### \`npm run build\`

Builds the app for production to the \`.elvis\` folder.
It correctly bundles Elvis in production mode and optimizes the build for the best performance.

### \`npm run start\`

Starts the application in production mode. The application should be compiled with \`elvis build\` first.

See the section in Elvis docs about deployment for more information.


## Something Missing?

Don\\\`t Think Twice, it\\\`s Alright.

[1]: https://github.com/clearloop/elvis.js/tree/master/packages/create-elvis-app
[2]: https://elvisjs.github.io/the-elvis-book
[3]: https://github.com/elvisjs/calling-elvis
`.slice(1);

enum Logger {
    Done,
    Info,
    Wait,
    Error,
}

async function log(text: string, ty?: Logger): Promise<void> {
    let status = "";
    switch (ty) {
        case Logger.Done:
            status = chalk.greenBright("done");
            break;
        case Logger.Wait:
            status = chalk.cyan("wait");
            break;
        case Logger.Error:
            status = chalk.red("error");
            break;
        default:
            status = chalk.dim(chalk.cyan("info"));
            break;
    }

    console.log(`[ ${status} ] ${text}`);
}

async function shouldUseYarn(): Promise<boolean> {
    try {
        execSync('yarnpkg --version', { stdio: "ignore" })
        return true
    } catch (_) {
        return false
    }
}

async function whatsYourProjectNamed(): Promise<string> {
    let appName = "";
    const res = await prompts({
        type: 'text',
        name: 'name',
        message: 'What is your project named?',
        initial: 'my-awesome-app',
        validate: (name: string) => {
            if (fs.existsSync(path.resolve(process.cwd(), name))) {
                return [
                    chalk.yellowBright("Project exists, plz figure out a better one, "),
                    chalk.yellowBright("just like "),
                    chalk.cyan("`Bob Dylan`"),
                    chalk.yellowBright("!"),
                ].join("");
            } else {
                return true;
            }
        }
    }, {
        onCancel: (_) => {
            log("Don't stop Me Now! I don't want to stop at all!", Logger.Error);
            process.exit(1);
        },
    });

    if (typeof res.name === 'string') {
        appName = res.name.trim().replace(" ", "-");
    }

    return appName;
}

async function createApp(appName: string, root: string): Promise<void> {
    fs.mkdirSync(root);
    fs.mkdirSync(path.resolve(root, "pages"));
    fs.writeFileSync(path.resolve(root, "pages/index.js"), await home(appName));
    fs.writeFileSync(path.resolve(root, "package.json"), await packageJson(appName));
    fs.writeFileSync(path.resolve(root, "README.md"), await readme(appName));
}

function install(
    root: string,
    useYarn: boolean,
    dependencies: string[],
): Promise<void> {
    return new Promise((resolve, reject) => {
        let command: string
        let args: string[]
        if (useYarn) {
            command = "yarnpkg"
            args = dependencies ? ["add", "--exact"] : ["install"]
            if (dependencies) {
                args.push(...dependencies)
            }
            args.push("--cwd", root)
        } else {
            command = "npm"
            args = ([
                "install",
                dependencies && "--save",
                dependencies && "--save-exact",
                "--loglevel",
                "error",
            ].filter(Boolean) as string[]).concat(dependencies || [])
        }

        const child = spawn(command, args, {
            stdio: "ignore",
            env: { ...process.env, ADBLOCK: "1", DISABLE_OPENCOLLECTIVE: "1" },
        })

        child.on("close", (code: number) => {
            if (code !== 0) {
                log(chalk.red(`${command} ${args.join(" ")}`), Logger.Error);
                reject({ command: `${command} ${args.join(' ')}` });
                process.exit(1);
            }

            log("Let`s Roll up for the Magical Mystery Tour!", Logger.Done);
            resolve();
        })
    });
}

async function showCaveat(appName: string, root: string, useYarn: boolean) {
    let cmd: string = "yarn";
    if (!useYarn) {
        cmd = "npm run";
    }

    let text = await caveat(appName, root, cmd);
    console.log(boxen(text, {
        borderColor: "cyan",
        margin: 1,
        padding: 1,
    }))
}

(async function() {
    const useYarn = await shouldUseYarn();
    const appName = await whatsYourProjectNamed();
    const root = path.resolve(process.cwd(), appName);

    await log("Generating elvis files ...", Logger.Info);
    await createApp(appName, root);
    await log("Installing elvis dependencies ...", Logger.Wait);
    await install(root, useYarn, ["elvis-cli", "calling-elvis"]);
    await showCaveat(appName, root, useYarn);
})();
