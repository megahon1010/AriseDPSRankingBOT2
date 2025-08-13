const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');

const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const dpsFilePath = './dps.json';
let dpsData = {};

// ファイルが存在しない場合は初期化
if (fs.existsSync(dpsFilePath)) {
    dpsData = JSON.parse(fs.readFileSync(dpsFilePath, 'utf8'));
}

// ... (コマンド定義部分は省略。前回と同じです) ...
// スラッシュコマンドの定義
const commands = [
    {
        name: 'dps',
        description: 'DPS数値を記録します',
        options: [
            {
                name: 'value',
                type: 10, // NUMBER
                description: 'DPSの数値',
                required: true,
            },
            {
                name: 'unit',
                type: 3, // STRING
                description: '単位 (例: no, dc, ud)',
                required: true,
                choices: [
                    { name: 'no', value: 'no' },
                    { name: 'dc', value: 'dc' },
                    { name: 'ud', value: 'ud' },
                ],
            },
        ],
    },
    {
        name: 'ranking',
        description: 'DPSランキングを表示し、トップユーザーにロールを付与します',
    },
];

// ボットが起動したときの処理
client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    // ... (コマンド登録部分は省略。前回と同じです) ...
    // スラッシュコマンドを登録
    const rest = new REST({ version: '10' }).setToken(config.token);
    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, config.guildId),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// スラッシュコマンドが実行されたときの処理
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'dps') {
        const dpsValue = options.getNumber('value');
        const dpsUnit = options.getString('unit');

        // データの保存
        dpsData[interaction.user.id] = {
            username: interaction.user.tag,
            value: dpsValue,
            unit: dpsUnit,
        };

        // ファイルに書き込み
        fs.writeFileSync(dpsFilePath, JSON.stringify(dpsData, null, 2), 'utf8');

        await interaction.reply(`DPS **${dpsValue} ${dpsUnit}** を記録しました！`);
    } else if (commandName === 'ranking') {
        // ランキングの作成
        const sortedDps = Object.values(dpsData)
            .sort((a, b) => {
                const units = ['ud', 'dc', 'no']; // 単位の優先順位
                const aUnitIndex = units.indexOf(a.unit);
                const bUnitIndex = units.indexOf(b.unit);

                if (aUnitIndex !== bUnitIndex) {
                    return aUnitIndex - bUnitIndex;
                }
                return b.value - a.value;
            });

        let rankingMessage = '### 🏆 DPSランキング 🏆\n\n';
        if (sortedDps.length === 0) {
            rankingMessage = 'まだDPSデータがありません。';
        } else {
            sortedDps.forEach((data, index) => {
                rankingMessage += `**${index + 1}.** ${data.username}: **${data.value} ${data.unit}**\n`;
            });
        }

        await interaction.reply({ content: rankingMessage, ephemeral: false });

        // ロール付与の処理
        if (sortedDps.length > 0) {
            const roleAssignments = {
                1: config.dpsRoleIds['1st'],
                2: config.dpsRoleIds['2nd'],
                3: config.dpsRoleIds['3rd'],
                10: config.dpsRoleIds['10th']
            };

            for (const rank in roleAssignments) {
                const roleId = roleAssignments[rank];
                const userIndex = parseInt(rank) - 1;

                if (roleId && sortedDps[userIndex]) {
                    const topUser = sortedDps[userIndex];
                    const memberId = Object.keys(dpsData).find(key => dpsData[key].username === topUser.username);
                    if (memberId) {
                        try {
                            const member = await interaction.guild.members.fetch(memberId);
                            if (member) {
                                await member.roles.add(roleId);
                                console.log(`${member.user.tag} (${rank}位) にロールを付与しました。`);
                            }
                        } catch (error) {
                            console.error(`ロール付与に失敗しました (${rank}位):`, error);
                            await interaction.followUp({ content: `${rank}位のユーザーへのロール付与に失敗しました。ボットの権限を確認してください。`, ephemeral: true });
                        }
                    }
                }
            }
        }
    }
});

// ボットにログイン
client.login(config.token);