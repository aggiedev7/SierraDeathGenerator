const { createCanvas, loadImage } = require('canvas')
const { renderText } = require('./js/render/render')
const fsp = require('fs').promises;
const { Client, MessageAttachment } = require('discord.js');

const argv = require('yargs')
  .option('g', {
    alias: 'game',
    demandOption: false,
    describe: 'abbreviated name of game to generate',
    type: 'string'
  })
  .option('w', {
    alias: 'wordwrap',
    demandOption: false,
    describe: 'if a game isnt provided, only pick from games that support wordwrap',
    type: 'boolean'
  })
  .option('c', {
    alias: 'channel',
    demandOption: true,
    describe: 'prefix of channel name to send image to',
    type: 'string'
  })
  .option('t', {
    alias: 'text',
    demandOption: false,
    describe: 'text to render',
    type: 'string'
  }).argv

async function run() {
  games = await fsp.readdir('games');
  [game, fontInfo] = await getGame(argv, games);
  const options = getSelectedOptions(argv, getValidGameOptions(fontInfo))
  const gamePath = 'games/' + game + '/' + game
  const baseImagePath = gamePath + '-blank.png'
  const fontImagePath = gamePath + '-font.png'

  const [baseImage, fontImage] = await Promise.all([loadImage(baseImagePath), loadImage(fontImagePath)])
  const imageCanvas = generateImage(argv.text, options, fontInfo, baseImage, fontImage)

  const fileName = createFileName(game, options)
  sendToDiscordChannel(argv.channel, imageCanvas, fileName)
}

async function getGame(name, games) {
  if ('g' in argv) {
    const fontInfo = await getFontInfoForGame(argv.g)
    return [argv.g, fontInfo]
  }
  else if ('wordwrap' in argv) {
    return getWordwrapEnabledRandomGame(games)
  }
  else {
    return getRandomGame(games)
  }
}

function getRandomGameName(games) {
  return games[Math.floor(Math.random() * games.length)]
}

async function getWordwrapEnabledRandomGame(games) {
  const [game, fontInfo] = await getRandomGame(games)
  return 'wrap-width' in fontInfo ? [game, fontInfo] : getWordwrapEnabledRandomGame(games)
}

async function getRandomGame(games) {
  const gameName = getRandomGameName(games)
  try {
    const fontInfo = await getFontInfoForGame(gameName)
    return [gameName, fontInfo]
  }
  catch (err) {
    if (err.code === 'ENOENT') {
      return await getRandomGame(games)
    }
    else {
      throw err
    }
  }
}

async function getFontInfoForGame(game) {
  const jsonString = await fsp.readFile('games/' + game + '/' + game + '.json');
  return await parseJsonAsync(jsonString);
}

const parseJsonAsync = (jsonString) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(JSON.parse(jsonString))
    })
  })
}

function createFileName(game, options) {
  return game + '-' + Object.values(options).join("-") + '.png'
}

async function sendToDiscordChannel(channelName, imageCanvas, fileName) {
  const client = new Client();

  client.once('ready', async () => {
    try {
      await sendCanvasToChannel(imageCanvas, channelName, fileName, client)
    }
    finally {
      client.destroy()
    }
  })

  client.login(process.env.BOT_TOKEN).catch(err => {
    client.destroy()
    throw err
  })
}

async function sendCanvasToChannel(imageCanvas, channelName, imageName, client) {
  const channel = client.channels.cache.find(channel => channel.name.startsWith(channelName))
  if (!channel) {
    throw 'Could not find channel with channel name'
  }
  const attachment = new MessageAttachment(imageCanvas.toBuffer(), imageName);
  console.log('sending ' + imageName + ' to ' + channel.name)
  return await channel.send('', attachment)
}

function getSelectedOptions(argv, generatorOptions) {
  return Object.fromEntries(Object.entries(generatorOptions).map(([name, possibleValues]) => {
    const optionSelectedValue = name in argv ? argv[name] : selectRandomOption(possibleValues)
    return [name, optionSelectedValue]
  }))
}

function getValidGameOptions(fontInfo) {
  if ('overlays' in fontInfo) {
    const toOptionsObject = ([overlayName, overlayInfo], i) => {
      console.log(overlayName)
      console.log(overlayInfo)
      return [overlayName, Object.keys(overlayInfo['options'])]
    }
    return Object.fromEntries(Object.entries(fontInfo['overlays']).map(toOptionsObject))
  }
  else {
    return {}
  }
}

function selectRandomOption(options) {
  return options[Math.floor(Math.random() * options.length)]
}

function generateImage(text, options, fontInfo, baseImage, fontImage) {
  const canvas = createCanvas(1000, 1000)
  renderText(canvas, fontInfo, baseImage, fontImage, text, options, false)
  return canvas
}

run()