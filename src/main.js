import chalk from 'chalk';
import fs from 'fs';
import ncp from 'ncp';
import path from 'path';
import { promisify } from 'util';

import execa from 'execa';
import Listr from 'listr';
import { projectInstall } from 'pkg-install';
const mongoose = require("mongoose")

const access = promisify(fs.access);
const writeFile = promisify(fs.writeFile);
const copy = promisify(ncp);

const User = require("./models/user")

async function cloneFromGit(options) {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await execa("git", ["clone", "https://github.com/CNimmo16/lightning-commerce.git"], {
                cwd: options.targetDirectory,
            });
            if (result.failed) {
                return Promise.reject(new Error('Failed to clone from git repository'));
            }
            resolve();
        }
        catch(err) {
            reject(new Error(`Error: ${err.all}`))
        }
    });
}

async function createProcessEnv(options) {
    const names = await mongoose.connection.db.listCollections().toArray()
    if(names.length > 0) {
        console.log(chalk.red.bold("Removing all existing data from database")) 
    }
    const loc = path.join(options.targetDirectory, "/lightning-commerce/server/process.env")
    console.log(loc)
    await writeFile(loc, `DATABASE_URL=${options.database_uri}`)
    return;
}

async function createRootUser(options) {
    try {
        await mongoose.connection.db.dropDatabase();
        const newUser = await User.create({
            username: "admin",
            email: options.email,
            isRoot: true,
            displayName: "Admin"
        })
        newUser.password = newUser.generateHash(options.root_password);
        newUser.save()
        return;
    }
    catch(err) {
        throw err;
    }
}

export async function createProject(options) {
 options = {
   ...options,
   targetDirectory: options.targetDirectory || process.cwd(),
 };


const tasks = new Listr([
    {
        title: 'Downloading Lightning Commerce from repository',
        task: () => cloneFromGit(options)
    },
    {
        title: 'Installing dependencies',
        task: async () =>
            await projectInstall({
                cwd: path.join(options.targetDirectory, "/lightning-commerce"),
            }),
        skip: () =>
            options.noInstall
            ? 'Dependencies not installed as --no-install was passed. To install dependencies run npm install after cli is complete.'
            : undefined,
    },
    {
        title: 'Configuring project with your chosen settings',
        task: () => createProcessEnv(options)
    },
    {
        title: "Creating root user",
        task: () => createRootUser(options)
    }
]);

 await tasks.run();

 console.log(`${chalk.green.bold('Done!')} Run ${chalk.bold("cd lightning-commerce")} then ${chalk.bold("npm run dev")} to get started`);
 return true;
}