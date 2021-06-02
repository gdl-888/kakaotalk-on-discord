// const stream = require('stream');
// stream.Duplex.prototype.off = stream.Duplex.prototype.removeListener;
global.node_kakao = require('node-kakao');  // 버전 3.1.10
global.DJS11 = require('discord.js');  // 버전 11.6.3
require('node-kakao/dist/config/client-config').DefaultConfiguration.version = '3.2.7';
require('node-kakao/dist/config/client-config').DefaultConfiguration.appVersion = '3.2.7.2777';
// global.node_kakao4 = require('./node-kakao-v4-es5');
global.AuthApiClient = node_kakao.AuthApiClient;
global.KnownAuthStatusCode = node_kakao.AuthStatusCode;
global.TalkClient = node_kakao.TalkClient;
// global.URLSearchParams = require('./url-search-params-polyfill');
// require('url').URLSearchParams = URLSearchParams;
// global.TextDecoder = require('./text-encoding-polyfill').TextDecoder;
// global.WebAssembly = require('./wasm-polyfill.js').default;

node_kakao.NetworkManager.PING_INTERVAL = 30000;  // 타블렛 핑 간격 (5분에서 30초로)

// const asyncawait = require('asyncawait');
// global.async = asyncawait.async;
// global.await = global.aw = asyncawait.await;
global.print = function() {
    console.log.apply(undefined, arguments);
	return 0;
};
const readline = require('readline');
const fs = require('fs');
function input(prompt, hide) {
	const rl = readline.createInterface(process.stdin, process.stdout);
	var pwchar = '';
	rl._writeToOutput = function(s) {
		if (rl.x)
			rl.output.write('*'), pwchar += '*';
		else
			rl.output.write(s);
	};
	
	return new Promise(r => {
		rl.question(prompt, ret => {
			rl.close();
			if(hide) process.stdout.write('\r' + prompt + pwchar.replace(/[*]$/, '') + ' \n'), rl.history = rl.history.slice(1);;
			r(ret);
		});
		
		if(hide) rl.x = 1;
	});
}
global.input = input;

global.__defineGetter__('commit', () => {
	fs.writeFile('./config.json', JSON.stringify(config), dooly => '둘리');
});
global.__defineGetter__('commits', () => {
	fs.writeFileSync('./config.json', JSON.stringify(config));
});

try {
	global.config = require('./config.json');
	run();
} catch(e) {
	global.config = {};
	setup();
}

async function run() {
	'use strict';
	
	if(!config.email || !config.password) {
		const email = await (input('전자우편 주소: '));
		const password = await (input('비밀번호: ', 1));
		config.email = email;
		config.password = Buffer.from(password).toString('base64');
		commits;
	}
	
	if(!config.webhook) config.webhook = {}, commits;
	const webhooks = {};
	const webhook = id => (webhooks[id + ''] || {}).webhook;
	
	const email = config.email;
	const password = Buffer.from(config.password, 'base64').toString();
	
	const devname = config.deviceName;
	const uuid = config.deviceUUID;
	
	const bridge = new DJS11.Client;
	const Collection = DJS11.Collection;
	
	const read = new Collection;
	const chats = new Collection;
	const messages = new Collection;
	
	// https://github.com/storycraft/node-kakao/issues/149
	const client = new TalkClient(devname, uuid, /* {
		agent: 'android',
		mccmnc: '999', 
		deviceType: 'tablet',
		deviceModel: 'GT-N5100', 
		appVersion: '8.4.5', 
		version: '8.4.5', 
		netType: 0, 
		subDevice: true,
	} */);
	
	(function login() {
		client.login(email, password, true)
			.then(async r => {
				print('로그인 됨');
				if(!config.token) config.token = await (input('디스코드 봇 토큰: ')), commits;
				bridge.login(config.token)
					.then(async() => {
						if(!config.guild) {
							var i = 0;
							bridge.guilds.forEach(g => print('[' + ++i + '] ' + g.name));
							var guild;
							while(!guild) {
								var num = Number(await (input('카카오톡 서버(만드려면 0): ')));
								guild = bridge.guilds.array()[num - 1];
								if(!guild && num) print(' *** 번호가 올바르지 않습니다 *** ');
								else if(!num) try {
									guild = await (bridge.user.createGuild(await (input('서버 이름(기본값-카카오톡 서버): ')) || '카카오톡 서버'));
									var ch = guild.channels.find(ch => ch.type == 'text');
									await (ch.edit({ name: '실험실' }));
									var iv = await (ch.createInvite({
										maxAge: 0,
										maxUses: 1,
									}));
									var rl = await (guild.createRole({
										name: '초록빛둘리',
										color: 51400,
										permissions: 8,
									}));
									bridge.once('guildMemberAdd', async member => {
										await (guild.me.addRole(rl));
										guild.setOwner(member);
									});
									print(' - 서버 초대 코드: ' + iv.code + ', 서버에 들어오면 소유권을 줍니다 - ');
								} catch(e) {
									print(' *** 서버를 만드는 도중 문제가 발생했읍니다! 다시 시도하거나 이미 있는 써버를 고르세요 ***');
								}
							} print(guild.name + ' 서버가 선택되었읍니다');
							config.guild = guild.id;
							commits;
						} var guild = bridge.guilds.get(config.guild);
						
						function channelName(ch) {
							return ch.getDisplayName() || '채널-' + ch.id;  // 이 함수 있다는 거 진작에 알았어야 했는ㄷ(가이드 안 보고 소스코드 탐색하면서 찾음)
							
							if(ch.openLink && ch.openLink.linkStruct && ch.openLink.linkStruct.linkName)
								return ch.openLink.linkStruct.linkName;
							
							var meta = ch.dataStruct.channelMetaList;
							if(meta instanceof Array) {
								var ret = meta.find(item => item.type == 3);
								if(ret && ret.content) return ret.content;
							}
							
							if(ch.dataStruct.displayMemberList) {
								var ul = '';
								for(var item of ch.dataStruct.displayMemberList) ul += item.nickname + ', ';
								ul = ul.replace(/[,]\s$/, '');
								if(ul.length > 100) ul = ul.slice(0, 97) + '...';
							
								return ul;
							}
							
							return '채널-' + ch.id;
						}
						
						const md5 = require('md5');
						
						var currentChannelName = '';
						
						async function setupWebhook(msg) {
							if(!msg && config.webhook) {
								for(var whi in config.webhook) {
									var whdata = config.webhook[whi];
									webhooks[whi] = whdata;
									webhooks[whi].webhook = await (bridge.fetchWebhook(whdata.id, whdata.token));
									if(!webhooks[whi].webhook.token) webhooks[whi].webhook.token = whdata.token;
								}
								
								return;
							}
							
							if(!webhooks[msg.channel.id + '']) {
								if(!config.webhook[msg.channel.id + '']) {
									var ch = await (guild.createChannel(channelName(msg.channel)));
									var wh = await (ch.createWebhook('message-poster'));
									
									  config.webhook[msg.channel.id + '']
									= webhooks[msg.channel.id + '']
									= {
										token: wh.token,
										id: wh.id,
										channel: ch.id,
									};
									
									commit;
								}
								
								var whdata = config.webhook[msg.channel.id + ''];
								webhooks[msg.channel.id + ''] = whdata;
								webhooks[msg.channel.id + ''].webhook = await (bridge.fetchWebhook(whdata.id, whdata.token));
								if(!webhooks[msg.channel.id + ''].webhook.token) webhooks[msg.channel.id + ''].webhook.token = whdata.token;
							}
						}
						
						client.on('message', async msg => {
							var chname = channelName(msg.channel);
							if(currentChannelName != chname) print('\n[' + chname + ']');
							currentChannelName = chname;
							
							const chat = msg;
							const sender = msg.channel.getUserInfo(msg.sender).memberStruct;
							print((sender.nickname) + ': ' + msg.text);
							
							await (setupWebhook(msg));
							
							if(msg.text.startsWith('*')) read.set(msg.logId + '', msg);
							chats.set(msg.logId + '', msg);
							
							var i = 0;
							for(var item of (msg.attachmentList || [])) {
								msg.text += '\n[첨부파일 ' + ++i + (item.Name ? (' ' + item.Name) : '') + ': ' + (item.ImageURL || item.VideoURL || item.FileURL) + ' ]';
							}
							
							webhook(msg.channel.id).send(msg.text, {
								username: sender.nickname,
								avatarURL: 'https://secure.gravatar.com/avatar/' + md5(sender.nickname) + '?d=retro',
							}).then(msg => messages.set(chat.logId + '', msg));
						});
						
						function time() {
							return new Date().getHours() + ':' + (new Date().getMinutes() < 10 ? ('0' + new Date().getMinutes()) : new Date().getMinutes());
						}
						
						client.on('message_read', async(channel, reader, id) => {
							await (setupWebhook({ channel }));
							
							id = id + '';
							const msg = read.get(id);
							const dmsg = messages.get(id);
							
							if(!msg) return;
							
							bridge.rest.makeRequest('post', '/channels/' + webhook(msg.channel.id).channelID + '/messages', true, {
								content: channel.getUserInfo(reader).memberStruct.nickname + '님이 ' + time() + '분에 ' + channel.getUserInfo(msg.sender).memberStruct.nickname + '님의 메시지를 읽었습니다', 
								message_reference: dmsg ? ({
									message_id: dmsg.id,
									channel_id: dmsg.channel.id,
									guild_id:   dmsg.guild.id
								}) : undefined, allowed_mentions: {
									parse: ["users", "roles", "everyone"],
									replied_user: false,
								},
							}, null);
						});
						
						client.on('message_deleted', async feed => {
							const channel = feed.channel;
							
							await (setupWebhook({ channel }));
							
							const sender = channel.getUserInfo(feed.sender).memberStruct;
							const msgID = (feed.text.match(/["]logId["][:](\d+)/) || [])[1] || '-1';
							const msg = chats.get(msgID);
							const dmsg = messages.get(msgID);
							
							const infmsg = sender.nickname + '님이 ' + time() + '분에 메시지' + (msg ? ' "' + msg.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, ' ') + '"' : '') + '를 삭제했습니다';							
							print(' - ' + infmsg + ' - ');
							
							bridge.rest.makeRequest('post', '/channels/' + webhook(msg.channel.id).channelID + '/messages', true, {
								content: infmsg, message_reference: {
									message_id: dmsg.id,
									channel_id: dmsg.channel.id,
									guild_id:   dmsg.guild.id
								}, allowed_mentions: {
									parse: ["users", "roles", "everyone"],
									replied_user: false,
								},
							}, null);
						});
						
						client.on('message_hidden', async(channel, logID, feed) => {
							await (setupWebhook({ channel }));
							
							const sender = channel.getUserInfo(feed.sender).memberStruct;
							const msgID = (feed.text.match(/["]logId["][:](\d+)/) || [])[1] || '-1';
							const msg = chats.get(msgID);
							const dmsg = messages.get(msgID);
							
							const infmsg = sender.nickname + '님이 ' + time() + '분에 ' + channel.getUserInfo(msg.sender).memberStruct.nickname + '님의 메시지' + (msg ? ' "' + msg.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, ' ') + '"' : '') + '를 가렸습니다';							
							print(' - ' + infmsg + ' - ');
							
							bridge.rest.makeRequest('post', '/channels/' + webhook(msg.channel.id).channelID + '/messages', true, {
								content: infmsg, message_reference: {
									message_id: dmsg.id,
									channel_id: dmsg.channel.id,
									guild_id:   dmsg.guild.id
								}, allowed_mentions: {
									parse: ["users", "roles", "everyone"],
									replied_user: false,
								},
							}, null);
						});
						
						client.on('link_deleted', async channel => {
							await (setupWebhook({ channel }));
							bridge.channels.get(webhook(channel.id).channelID).send('채팅방이 닫혔습니다');
						});
						
						client.on('member_type_changed', async (channel, user, lastType) => {
							await (setupWebhook({ channel }));
							
							var newType = channel.getUserInfo(user).memberStruct.memberType;
							var oldType = lastType;
							
							user = channel.getUserInfo(user).memberStruct;
							
							var infmsg = '';
							if(oldType == 2 && newType == 4) infmsg = user.nickname + '님이 부방장이 되었습니다';
							else if(oldType == 4 && newType) infmsg = user.nickname + '님의 분홍 왕관을 방장에게 압수 당했습니다'
							
							if(infmsg)
								bridge.channels.get(webhook(channel.id).channelID).send(infmsg),
								print(' - ' + infmsg + ' - ');
						});
						
						client.on('user_join', async(channel, user, feed) => {
							await (setupWebhook({ channel }));
							bridge.channels.get(webhook(channel.id).channelID).send(channel.getUserInfo(user).memberStruct.nickname + '님이 들어왔습니다');
						});
						
						client.on('user_leave', async(channel, user, feed) => {
							await (setupWebhook({ channel }));
							bridge.channels.get(webhook(channel.id).channelID).send(feed.feed.member.nickName + '님이 나갔습니다');
						});
						
						client.on('user_kicked', async(channel, user, feed) => {
							await (setupWebhook({ channel }));
							try {
								bridge.channels.get(webhook(channel.id).channelID).send(feed.feed.member.nickName + '님이 ' + channel.getUserInfo(feed.sender).memberStruct.nickname + '에 의해 쫒겨났습니다');
							} catch(e) {
							}
						});
						
						bridge.on('message', async msg => {
							setupWebhook();
							
							if(msg.author.bot || msg.webhookID) return;
							
							for(var whi in webhooks) {
								var wh = webhooks[whi];
								
								if(wh.channel == msg.channel.id) {
									var cntnt = r => (r || '') + msg.content;
									var ref = null;
									var reply = '';
									
									function proc(msg) {
										if(msg.text.startsWith('*')) read.set(msg.logId + '', msg);
									}
									
									if(msg.reference) {
										try {
											ref = await (msg.channel.fetchMessage(msg.reference.messageID));
										} catch(e) {
											ref = { content: '', id: '0', author: { username: '전송자' } };
										}
										var fc = ref.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '[줄바꿈]').replace(/[(]/g, '[괄호열고]').replace(/[)]/g, '[괄호닫고]'), _fc = fc;
										if(fc.length > 15) fc = fc.slice(0, 15) + '...';
										reply = (ref ? (ref.author.username + '에게 답장 ' + fc + '\n--------\n') : '');
										client.channelManager.get(whi).sendText(cntnt(reply)).then(proc);
									} else client.channelManager.get(whi).sendText(cntnt(reply)).then(proc);
									break;
								}
							}
						});
					})
					.catch(e => print('디스코드 로그인에 실패했읍니다'));
			})
			.catch(e => {
				if(e.status == -100) {
					print('기기인증 중입니다. 전화기로 전송된 PIN 네 자리를 써주십시오');
					client.auth.requestPasscode(email, password, true)
						.then(async res => {
							client.auth.registerDevice(await (input('PIN: ')), email, password, true, true)
								.then(res => {
									if(res.status == -111 || res.status == -112) process.exit(2 + print('코드가 틀립니다. 다시 확인해 주십시요'));
									else if(res.status < 0) process.exit(2 + print('기기인증에 실패했읍니다 (' + res.status + ')'));
									login();
								});
						})
						.catch(e => process.exit(1 + print('기기인증 요청에 실패했읍니다')));
				} else process.exit(1 + print(`로그인에 실패했읍니다 (${e.stack})`));
			});
	})();
}

async function setup() {
	config.deviceName = await (input('기기 이름(아무거나): '));
	
	function randomUUID() {
		var ret = '';
		for(var i=0; i<86; i++)
			ret += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+	/'[Math.floor(Math.random() * 64)];
		return ret + '==';
	}
	
	config.deviceUUID = randomUUID();
	commits;
	run();
}
