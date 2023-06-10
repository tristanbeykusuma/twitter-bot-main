require('dotenv').config();

const express = require('express');
const cors = require('cors');
const CronJob = require('cron').CronJob;

const app = express();
const PORT = process.env.PORT || 3000;

const { TwitterBot } = require('./twitter-bot');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const bot = new TwitterBot({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_KEY_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
    triggerWord: process.env.TRIGGER_WORD
});

const job = new CronJob(
    '0 */2 * * * *',
    doJob,
    onComplete,
    true
);

async function doJob() {
    console.log(`\nexecute @ ${new Date().toTimeString()}`);
    let tempMessage;
    try {
        const authenticatedUserId = await bot.getAdminUserInfo();
        const message = await bot.getDirectMessage(authenticatedUserId);
        //console.log(JSON.stringify(message, null, 3), "<<< message");
        if (message.id) {
            console.log('------------- POSTING TWEET ---------------');
            tempMessage = message;
            const { data } = await bot.tweetMessage(message);
            const response = await bot.deleteMessages(message);
            console.log(`... DM has been successfuly reposted with id: ${data.id} @ ${data.created_at}`);
            console.log('------------- TWEET POSTED ---------------');
        } else {
            console.log('No tweet with trigger was found (not posted)');
        }
    } catch (error) {
        console.log(error);
        console.log('\n------------- ERROR ---------------');
        if (tempMessage.id) {
            await bot.deleteMessages(tempMessage);
        }
    }
};

async function onComplete() {
    console.log('my job is done!');
};
    
app.get('/', (req, res, next) => {
    res.send('Welcome to the bot server');
});

app.get('/triggerjob', async (req, res, next) => {
    job.fireOnTick();
    res.send('Job triggered');
});

app.get('/setwelcome', async (req, res, next) => {
    // try {
    //     const finished = await bot.initializeWelcomeMessage();
    //     console.log(finished.data);
    // } catch (error) {
    //     console.log(error);
    //     console.log('\n------------- ERROR ---------------');
    // } finally {
    //     res.send('Welcome message set');
    // }
    res.send('Welcome message set');
});

app.listen(PORT, () => console.log(`Server is listening to port ${PORT}`));