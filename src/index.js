import { join } from 'path';
import { EOL } from 'os';

import { App } from '@tinyhttp/app';
import { json as jsonParser } from 'milliparsec';

import vkBot from 'node-vk-bot-api';
import vkMessageMarkup from 'node-vk-bot-api/lib/markup.js';

import config from './app-config.json';
import chats_settings from './app-chats-settings.json';

const staticDir = join(process.cwd(), 'static');

const app = new App();

app.use(jsonParser());

const BOT = new vkBot({
    token: config.bot.token,
    group_id: config.bot.group_id,
    secret: config.bot.secret,
    confirmation: config.bot.confirmCode,
});

const vkMessageLinkBtn = (label, url) =>
    vkMessageMarkup.button({
        action: {
            type: 'open_link',
            link: url,
            label,
            payload: {
                url,
            },
        },
    });

app.get('/', (req, res) => {
    res.status(403);
    res.sendFile('index.html', { root: staticDir });
});

app.get('/robots.txt', (req, res) => {
    res.sendFile('robots.txt', { root: staticDir });
});

app.post('/vk', (req, res) => {
    const body = req.body;

    if ('secret' in body && body.secret === config.bot.secret) {
        if (body.type && body.type === 'confirmation') {
            res.send(config.bot.confirmCode).end();
        }

        res.send('ok').end();
    } else {
        res.status(403).send('not ok').end();
    }
});

app.post('/teamcity', (req, res) => {
    const body = req.body;

    if ('build' in body) {
        const build = body.build;

        const buildData = {
            id: build.buildTypeId,
            name: build.buildName,
            number: build.buildNumber,
            result: build.buildResult,
            resultURL: build.buildStatusUrl,
        };

        chats_settings.forEach(chat => {
            if (buildData.id in chat.subscriptions) {
                const vkKeyboardButtons = [];

                const message =
                    `${chat.subscriptions[buildData.id]} – сборка #${buildData.number} завершена.${EOL}` +
                    `Результат: ${buildData.result === 'success' ? 'успех! 😊' : 'неудача 😰'}`;

                if (chat.alwaysShowResultLink || buildData.result !== 'success') {
                    vkKeyboardButtons.push(vkMessageLinkBtn('📝 Подробнее', buildData.resultURL));
                }

                if (chat.extraLinks && buildData.result === 'success') {
                    chat.extraLinks.forEach(extra => {
                        if (extra.trigger === buildData.id) {
                            extra.links.forEach(linkData => {
                                vkKeyboardButtons.push(vkMessageLinkBtn(linkData.text, linkData.url));
                            });
                        } else {
                            return;
                        }
                    });
                }

                const vkKeyboard = vkMessageMarkup.keyboard(vkKeyboardButtons).inline();

                BOT.sendMessage(chat.peer_id, message, null, vkKeyboard);
            }
        });

        res.send('ok').end();
    } else {
        res.status(403).send('not ok').end();
    }
});

app.listen(config.port);

console.log('Сервер для vk-teamcity-bot запущен на порту ' + config.port + EOL + 'Не закрывайте терминал, пожалуйста.');
