const Twit = require('twit');
const fs = require('fs');

const { downloadMedia } = require('./download-file');

class TwitterBot {
    constructor(props) {
        this.T = new Twit({
            consumer_key: props.consumer_key,
            consumer_secret: props.consumer_secret,
            access_token: props.access_token,
            access_token_secret: props.access_token_secret
        });
        this.triggerWord1 = props.triggerWord1;
        this.triggerWord2 = props.triggerWord2;
        this.welcomeRule = '1667353190264889350';
    };

    getAdminUserInfo = () => {
        return new Promise((resolve, reject) => {
            this.T.get('account/verify_credentials', { skip_status: true })
                .then(result => {
                    const userId = result.data.id_str
                    resolve(userId);
                })
                .catch(err => {
                    reject(err);
                })
        })
    };

    getReceivedMessages = (messages, userId) => {
        return messages.filter(msg => msg.message_create.target.recipient_id == userId);
        //return messages.filter(msg => msg.message_create.sender_id !== userId);
    };

    getUnnecessaryMessages = (receivedMessages, trigger1, trigger2) => {
        return receivedMessages.filter(msg => {
            const messages = msg.message_create.message_data.text;
            const words = this.getEachWord(messages);
            const isWord1 = !words.includes(trigger1);
            const isWord2 = !words.includes(trigger2);
            return (isWord1 && isWord2);
        })
    };

    getTriggerMessages = (receivedMessages, trigger1, trigger2) => {
        return receivedMessages.filter(msg => {
            const message = msg.message_create.message_data.text; 
            const words = this.getEachWord(message); 
            const isWord1 = words.includes(trigger1);
            const isWord2 = words.includes(trigger2);
            return (isWord1 || isWord2);
        })
    };

    getEachWord = (messages) => {
        let words = [];
        let finalWords = [];
        const seperateEnter = messages.split("\n");
        seperateEnter.forEach(line => words = [...words, ...line.split(' ')]);
        words.forEach(word => {
            const splitComma = word.split(",");
            finalWords = [...finalWords, ...splitComma];
        })

        return finalWords;
    };

    deleteMessages = (message) => {
        return new Promise((resolve, reject) => {
            this.T.delete('direct_messages/events/destroy', { id: message.id }, (error, data) => {
                if (!error) {
                    const msg = `message with id : ${message.id} has been successfully deleted`;
                    console.log(msg);
                    resolve({
                        message: msg,
                        data
                    })
                } else {
                    reject(error);
                }
            })
        })
    };

    sleep = (time) => new Promise(resolve => setTimeout(resolve, time));

    deleteUnnecessaryMessages = async (unnecessaryMessages) => {
        if (unnecessaryMessages.length > 3) {
            for (let i = 0; i < 3; i++) {
                await this.deleteMessages(unnecessaryMessages[i]);
                await this.sleep(2000);
            }
        } else {
            for (const msg of unnecessaryMessages) {
                await this.deleteMessages(msg);
                await this.sleep(2000);
            }
        }
    };

    deleteMoreThanCharMessages = async (triggerMessages) => {
        try {
            let moreThanCharMessage = [];
            for (const [index, msg] of triggerMessages.entries()) {
                let text = msg.message_create.message_data.text;
                const attachment = msg.message_create.message_data.attachment;
                if (attachment) {
                    const shortUrl = attachment.media.url
                    text = text.split(shortUrl)[0];
                }
                if (text.length > 280) {
                    moreThanCharMessage.push(msg);
                    await this.deleteMessages(msg);
                    await this.sleep(2000);
                }
                if ((index + 1) === 3) {
                    break;
                }
            }
            for (const msg of moreThanCharMessage) {
                const idx = triggerMessages.indexOf(msg);
                triggerMessages.splice(idx, 1);
            }
        } catch (error) {
            throw (error);
        }
    };

    getDirectMessage = (userId) => {
        return new Promise((resolve, reject) => {
            this.T.get('direct_messages/events/list', async (error, data) => {
                try {
                    if (!error) {
                        let lastMessage = {};
                        const messages = data.events;
                        const receivedMessages = this.getReceivedMessages(messages, userId);
                        const unnecessaryMessages = this.getUnnecessaryMessages(receivedMessages, this.triggerWord1, this.triggerWord2);
                        const triggerMessages = this.getTriggerMessages(receivedMessages, this.triggerWord1, this.triggerWord2);
                        
                        await this.deleteUnnecessaryMessages(unnecessaryMessages);
                        await this.deleteMoreThanCharMessages(triggerMessages);

                        if (triggerMessages[0]) {
                            lastMessage = triggerMessages[triggerMessages.length - 1];
                        }

                        resolve(lastMessage);
                    } else {
                        reject('error on get direct message');
                    }
                } catch (error) {
                    reject(error);
                }
            })
        })
    };

    uploadMedia = (filePath, type) => {
        return new Promise((resolve, reject) => {
            console.log('MEDIA BEING UPLOADED...............');
            const b64Content = fs.readFileSync(filePath, { encoding: 'base64' });
            if (type === 'photo'){
                this.T.post('media/upload', { media_data: b64Content }, (error, data) => {
                    if (!error) {
                        resolve(data);
                        console.log('MEDIA HAS BEEN SUCCESSFULLY UPLOADED........');
                    } else {
                        fs.unlinkSync(filePath);
                        reject(error);
                    }
                })
            } else {
                this.T.postMediaChunked({ file_path: filePath }, (error, data) => {
                    if (!error) {
                        resolve(data);
                        console.log('MEDIA HAS BEEN SUCCESSFULLY UPLOADED..........');
                    } else {
                        fs.unlinkSync(filePath);
                        reject(error);
                    }
                })
            }
        })
    };

    respondDirectMessage = (response, sender) => {
        return new Promise((resolve, reject) => {
            this.T.post('direct_messages/events/new', {
                event: {
                    type: "message_create",
                    message_create: {
                    target: { recipient_id: sender },
                    message_data: { text: response },
                    },
                },
            }, (error, data) => {
                if (!error) {
                    const msg = `Message response : ${response}`;
                    console.log(msg);
                    resolve({
                        message: msg,
                        data
                    })
                } else {
                    reject(error);
                }
            })
        })
    };

    tweetMessage = (message) => {
        return new Promise(async (resolve, reject) => {
            try {
                const text = message.message_create.message_data.text;
                const attachment = message.message_create.message_data.attachment;
                const sender = message.message_create.sender_id;
                const payload = {
                    status: text
                }
                if (attachment) {
                    const media = attachment.media;
                    const shortUrl = attachment.media.url;
                    payload.status = text.split(shortUrl)[0];
    
                    const type = attachment.media.type;
                    let mediaUrl = '';
                    if (type === 'animated_gif') {
                        mediaUrl = media.video_info.variants[0].url;
                    } else if (type === 'video') {
                        mediaUrl = media.video_info.variants[0].url.split('?')[0];
                    } else {
                        mediaUrl = attachment.media.media_url;
                    }
    
                    const splittedUrl = mediaUrl.split('/');
                    const fileName = splittedUrl[splittedUrl.length - 1];       
                    await downloadMedia(mediaUrl, fileName);                
                    const uploadedMedia = await this.uploadMedia(fileName, type);
                    fs.unlinkSync(fileName);
                    console.log(`Media ${fileName} has been deleted from local...`);  
                    payload.media_ids = [uploadedMedia.media_id_string];
                }

                console.log('POSTING TWEET STATUS FROM DM...........');
                this.T.post('statuses/update', payload, async (error, data) => {
                    if (!error) {
                        console.log(`Successfully posted message with DM ID : ${message.id}`);
                        resolve({
                            message: `Successfully posted message with DM ID : ${message.id}`,
                            data
                        });
                    } else if (error.code == 324) {
                        delete payload.media_ids;
                        const response = 'Maaf, media gagal di proses sehingga hanya teks yang dikirim berhasil di posting';
                        await this.respondDirectMessage(response, sender);
                        this.T.post('statuses/update', payload, (error, data) => {
                            if (!error) {
                                console.log(`Successfully posted message with DM ID : ${message.id}`);
                                resolve({
                                    message: `Successfully posted message with DM ID : ${message.id}`,
                                    data
                                });
                            } else {
                                reject(error);
                            }
                        })
                    } else {
                        const response = 'Maaf, pesan anda gagal di posting';
                        await this.respondDirectMessage(response, sender);
                        reject(error);
                    }
                })
            } catch (error) {
                reject(error);
            }
        });
    };

    deleteWelcomeRule = (welcomeRule) => {
        return new Promise((resolve, reject) => {
            const welcomeMessageRule = welcomeRule;
            this.T.delete('direct_messages/welcome_messages/rules/destroy', { id: welcomeMessageRule }, (error, data) => {
                if (!error) {
                    const msg = '\nOld message rule deleted';
                    console.log(msg);
                    resolve({
                        message: msg,
                        data
                    })
                } else {
                    reject(error);
                }
            })
        })
    };

    initializeWelcomeMessage = () => {
        return new Promise(async (resolve, reject) => {
            try {
                this.T.post('direct_messages/welcome_messages/new', {
                    name: "simple_welcome-message 01", 
                    welcome_message: {
                        message_data: {
                            text: "Welcome to the autobase twitter bot DM! Bot commands :\npost! : post a message sent \nhello! : get a response from the bot"
                        }
                    },
                }, async (error, data) => {
                    if (!error) {
                        console.log(data);
                        await this.deleteWelcomeRule(this.welcomeRule);
                        this.T.post('direct_messages/welcome_messages/rules/new', {
                            welcome_message_rule: { welcome_message_id: data.welcome_message.id }
                        }, (error, data) => {
                            if (!error) {
                                const msg = '\nNew welcome message set!';
                                console.log(msg);
                                //this.welcomeRule = data.welcome_message_rule.id;
                                resolve({
                                    message: msg,
                                    data
                                })
                            } else {
                                reject(error);
                            }
                        })
                    } else {
                        reject(error);
                    }
                })
            } catch (error) {
                reject(error);
            }
        })
    };
}

module.exports = { TwitterBot };
