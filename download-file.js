const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const axios = require('axios');
const fs = require('fs');

const OAuthHelper = (mediaUrl) => {
    const oauth = OAuth({
        consumer: {
            key: 'mtuDKKQatBsj5TjXPwkGZhsjr',
            secret: 'MnaqsZVo1kyhQOfAofze59GKYH6dmc7ezz5Ch9ydpqu3DV9FDv'
        },
        signature_method: 'HMAC-SHA1',
        hash_function(base_string, key) {
            return crypto.createHmac('sha1', key).update(base_string).digest('base64');
        }
    })

    const authorization = oauth.authorize({
        url: mediaUrl,
        method: 'GET',
    }, {
        key: '3012123247-4881DTFpplwz51nbUxpFL5YMKECKrTvO5DgOkVL',
        secret: 'z36X2rlqQnp7JC9CzUd7OURI57rp0JQrlsz6XjiGSiYda'
    });

    return oauth.toHeader(authorization);
};

const downloadMedia = async (mediaUrl, fileName) => {
    try {
        console.log('DOWNLOADING MEDIA.......................');
        const authorization = OAuthHelper(mediaUrl);
        const {data} = await axios.get(
            mediaUrl,
            {
                headers: authorization,
                responseType: 'arraybuffer',
            }
        )
        fs.writeFileSync(fileName, data);
        console.log('MEDIA SUCCESSFULLY DOWNLOADED...........');
        return data;
    } catch (error) {
        throw new Error('error from downloading media.');
    }
};

module.exports = { downloadMedia };