import arg from 'arg';
import inquirer from 'inquirer';
import { createProject } from './main';
import chalk from 'chalk';
import zxcvbn from 'zxcvbn';
const mongoose = require("mongoose")

async function promptForMissingOptions(options) {
    const questions = [
    //     {
    //         type: 'password',
    //         name: 'root_password',
    //         message: `${chalk.reset("Please choose a secure password for the admin user:")}`,
    //         validate: (response) => {
    //             const { score, feedback } = zxcvbn(response)
    //             if(response.length === 0) {
    //                 return false;
    //             } else if(score < 3) {
    //                 if(feedback.suggestions.length > 0) {
    //                     return chalk.red.bold("Password too weak") + " - " + feedback.suggestions[0]
    //                 } else {
    //                     return chalk.red.bold("Password too weak") + " - Try adding some more numbers or symbols.";
    //                 }
    //             } else {
    //                 return true;
    //             }
    //         }
    //     },
    //     {
    //         type: 'password',
    //         name: 'root_password_confirm',
    //         message: `${chalk.reset("Confirm password:")}`,
    //         validate: (response, answers) => {
    //             if(response !== answers.root_password) {
    //                 return "Those passwords don't match";
    //             } else {
    //                 return true
    //             }
    //         }
    //     },
    //     {
    //         type: 'input',
    //         name: 'email',
    //         message: `${chalk.reset("Enter a valid email for password reset:")}`,
    //         validate: (response) => {
    //             if(response.indexOf("@") < 1 || response.lastIndexOf(".") < response.indexOf("@")) {
    //                 return "That doesn't look like a valid email";
    //             } else {
    //                 return true
    //             }
    //         }
    //     },
        {
            type: 'input',
            name: 'database_uri',
            message: `${chalk.reset("Please enter the MongoDB uri of your database. If you do not yet have a MongoDB database, you will need to first set one up:")}`,
            validate: async (response) => {
                if(response.slice(0, 10) !== "mongodb://" || response.length < 11) {
                    return chalk.red.bold("Whoops, that doesn't seem to be a valid uri. ") + `MongoDB uris start with ${chalk.bold("mongodb://...")}`
                } else {
                    try {
                        await mongoose.connect(response, { useNewUrlParser: true })
                        return true;
                    }
                    catch(err) {
                        return "Whoops, we couldn't connect to that database. Please check the uri and try again"
                    }
                }
            }
        },
        {
            type: 'input',
            name: 'directory',
            message: `${chalk.reset("By default, Lightning Commerce will be installed in a folder named \"lightning-commerce\". If you'd like to change this, type the name here. Otherwise, press enter to continue with the default directory name.")}`,
            default: "lightning-commerce"
        },
        {
            type: 'list',
            name: 'payment_provider',
            message: (answers) => {
                return `${chalk.reset("Please choose the payment provider you would like to use for your website. Please go to ")}${chalk.blue("https://github.com/CNimmo16/lightning-commerce")} ${chalk.reset("to learn more")}`
            },
            choices: [
                {
                    name: `Stripe ${chalk.green.bold("- Lowest fees!")}`,
                    value: "stripe"
                },
                {
                    name: "Braintree",
                    value: "braintree"
                },
                {
                    name: `Instamojo ${chalk.green.bold("- Payments for India based merchants")}`,
                    value: "instamojo"
                }
            ]
        },
        {
            type: 'input',
            name: 'stripe_secret',
            when: async (answers) => {
                return answers.payment_provider === "stripe"
            },
            message: `${chalk.reset("Enter your stripe secret key:")}${chalk.reset.yellow(" Don't have a stripe account yet? Go to https://dashboard.stripe.com/register to get started.")}`
        },
        {
            type: 'input',
            name: 'braintree_id',
            when: async (answers) => {
                return answers.payment_provider === "braintree"
            },
            message: `${chalk.reset("Enter your Braintree merchant ID:")}${chalk.reset.yellow(" Don't have a braintree account yet? Go to https://www.braintreepayments.com/products/braintree-direct to get started.")}`
        },
        {
            type: 'input',
            name: 'braintree_public',
            when: async (answers) => {
                return answers.payment_provider === "braintree"
            },
            message: `${chalk.reset("Enter your Braintree public key:")}`
        },
        {
            type: 'input',
            name: 'braintree_private',
            when: async (answers) => {
                return answers.payment_provider === "braintree"
            },
            message: `${chalk.reset("Enter your Braintree private key:")}`
        },
        {
            type: 'list',
            name: 'wipe_database',
            message: `Lightning CLI has detected that the provided database is not currently empty. A non empty database could cause conflicts in lightning commerce. We recommend wiping the database of all current collections and documents. ${chalk.red.bold("This is a destructive operation")}. If you do not want to wipe this database, please abort and choose another database, or select "Proceed without wiping existing data"`,
            when: async (answers) => {
                const names = await mongoose.connection.db.listCollections().toArray();
                if(names.length > 0) {
                    return true
                } else {
                    return false
                }
            },
            choices: [
                {
                    name: `Wipe existing data and continue`,
                    value: true
                },
                {
                    name: "Proceed without wiping existing data (not recommended)",
                    value: false
                }
            ]
        },
        {
            type: 'list',
            name: 'noinstall',
            message: (answers) => {
                return `${chalk.reset("Would you like the CLI to also install project dependencies for you? You can alternatively do this yourself by running \"npm install\" once set up.")}`
            },
            choices: [
                {
                    name: `Install dependencies automatically`,
                    value: false
                },
                {
                    name: "Don't install dependencies yet, I'll run \"npm install\" myself",
                    value: true
                }
            ]
        },
        {
            type: 'list',
            name: 'confirm',
            message: (answers) => {
                return `${chalk.reset("Please review the details of your setup before proceeding:")}
${chalk.green("Database uri:")} ${chalk.reset.black.bgWhite(answers.database_uri)}
${chalk.green("Directory name:")} ${chalk.reset.black.bgWhite(answers.directory)}
${chalk.green("Payment gateway:")} ${chalk.reset.black.bgWhite(answers.payment_provider)}
${chalk.green("Install dependencies?")} ${chalk.reset.black.bgWhite(answers.noinstall ? "no" : "yes")}
${answers.wipe_database ? chalk.reset.red("Warning: Wiping existing database content.") : ""}
Do you wish to continue?`
            },
//             message: (answers) => {
//                 return `${chalk.reset("Please review the details of your setup before proceeding:")}
// ${chalk.green("password reset email: ")} - ${chalk.reset.bgWhite("cameronnimmo@hotmail.co.uk")}
// ${chalk.green("database uri: ")} - ${chalk.reset.bgWhite(answers.database_uri)}
// Do you wish to continue?`
//             },
            choices: [
                {name: "Yes, proceed with setup", value: true},
                {name: "No, abort setup", value: false}
            ]
        }
    ];

    const answers = await inquirer.prompt(questions);
    
    return {
        ...options,
        root_password: answers.root_password,
        email: answers.email,
        wipe_database: answers.wipe_database,
        noInstall: answers.noinstall,
        directory: answers.directory,
        database_uri: answers.database_uri,
        confirm: answers.confirm,
    };
}

export async function cli(args) {
    console.log(`${chalk.cyan.bold("====== Lightning Commerce ======")}
${chalk.bold("Welcome to the Lightning Commerce CLI setup wizard")}
`)
    let options = await promptForMissingOptions();
    if(options.confirm) {
        await createProject(options);
        process.exit(1)
    } else {
        console.log("Aborting setup")
        process.exit(1)
    }
}