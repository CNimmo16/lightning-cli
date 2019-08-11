import arg from 'arg';
import inquirer from 'inquirer';
import { createProject } from './main';
import chalk from 'chalk';
import zxcvbn from 'zxcvbn';
const mongoose = require("mongoose")

function parseArgumentsIntoOptions(rawArgs) {
    const args = arg({
        '--no-install': Boolean,
        '-n': '--no-install',
    },
    {
        argv: rawArgs.slice(2),
    });
        
    return {
        noInstall: args['--no-install'] || false,
    };
}

async function promptForMissingOptions(options) {
    const questions = [
        {
            type: 'password',
            name: 'root_password',
            message: `${chalk.reset("Please choose a secure password for the admin user:")}`,
            validate: (response) => {
                const { score, feedback } = zxcvbn(response)
                if(response.length === 0) {
                    return false;
                } else if(score < 3) {
                    if(feedback.suggestions.length > 0) {
                        return chalk.red.bold("Password too weak") + " - " + feedback.suggestions[0]
                    } else {
                        return chalk.red.bold("Password too weak") + " - Try adding some more numbers or symbols.";
                    }
                } else {
                    return true;
                }
            }
        },
        {
            type: 'password',
            name: 'root_password_confirm',
            message: `${chalk.reset("Confirm password:")}`,
            validate: (response, answers) => {
                if(response !== answers.root_password) {
                    return "Those passwords don't match";
                } else {
                    return true
                }
            }
        },
        {
            type: 'input',
            name: 'email',
            message: `${chalk.reset("Enter a valid email for password reset:")}`,
            validate: (response) => {
                if(response.indexOf("@") < 1 || response.lastIndexOf(".") < response.indexOf("@")) {
                    return "That doesn't look like a valid email";
                } else {
                    return true
                }
            }
        },
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
            type: 'confirm',
            name: 'wipe_database',
            message: `Lightning CLI has detected that the provided database is not currently empty. Lightning Commerce must be setup on an empty database. Proceeding with the setup will wipe the database of all current collections and documents. ${chalk.red.bold("This is a destructive operation")}. Are you sure you wish to continue?`,
            when: async (answers) => {
                const names = await mongoose.connection.db.listCollections().toArray();
                if(names.length > 0) {
                    return true
                } else {
                    return false
                }
            },
        },
        {
            type: 'list',
            name: 'confirm',
            message: (answers) => {
                return `${chalk.reset("Please review the details of your setup before proceeding:")}
${chalk.green("password reset email: ")} - ${chalk.reset.bgWhite("cameronnimmo@hotmail.co.uk")}
${chalk.green("database uri: ")} - ${chalk.reset.bgWhite(answers.database_uri)}
Do you wish to continue?`
            },
            when: async (answers) => {
                if(answers.wipe_database === false) {
                    console.log("Aborting setup")
                    process.exit(1)
                } else {
                    return true;
                }
            },
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
        database_uri: answers.database_uri,
        confirm: answers.confirm,
    };
}

export async function cli(args) {
    console.log(`${chalk.cyan.bold("====== Lightning Commerce ======")}
${chalk.bold("Welcome to the Lightning Commerce CLI setup wizard")}
`)
    let options = parseArgumentsIntoOptions(args);
    options = await promptForMissingOptions(options);
    if(options.confirm) {
        await createProject(options);
        process.exit(1)
    } else {
        console.log("Aborting setup")
        process.exit(1)
    }
}