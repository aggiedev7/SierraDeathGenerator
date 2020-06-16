const { createCanvas, loadImage } = require('canvas')
const { renderText } = require('./js/render/render')
const fsp = require('fs').promises;
const yargs = require('yargs').option('g', {
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
const argv = yargs.argv
const { Client, MessageAttachment } = require('discord.js');

const parseJsonAsync = (jsonString) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(JSON.parse(jsonString))
    })
  })
}

function getGame(argv, games) {
  if ('g' in argv) {
    return getFontInfoForGame(argv.g).then(([_, fontInfo]) => [argv.g, fontInfo])
  }
  else if ('wordwrap' in argv) {
    return getRandomGameWithWordwrap(games)
  }
  else {
    const game = getRandomGame(games)
    return getFontInfoForGame(game).then(([_, fontInfo]) => [game, fontInfo])
  }
}

function getRandomGame(games) {
  return games[Math.floor(Math.random() * games.length)]
}

function getRandomGameWithWordwrap(games) {
  return getFontInfoForGame(getRandomGame(games)).then(([game, fontInfo]) => 
  ('wrap-width' in fontInfo) ? [game, fontInfo] : getRandomGameWithWordwrap(games))
  .catch(err => {
    if (err.code  === 'ENOENT') {
      getRandomGameWithWordwrap(games)
    }
    else {
      throw err
    }
  })
}

function getFontInfoForGame(game) {
  return fsp.readFile('games/' + game + '/' + game + '.json')
  .then(parseJsonAsync)
  .then(json => [game, json]);
}

async function run() {
  games = await fsp.readdir('games');
  [game, fontInfo] = await getGame(argv, games);

  const [baseImage, fontImage] = await Promise.all([loadBaseImage(game), loadFontImage(game)])
  const selectedOptions = getSelectedOptions(argv)
  const options = buildOptions(selectedOptions, fontInfo)
  const imageCanvas = generateImage(argv.text, options, fontInfo, baseImage, fontImage)

  sendCanvasToChannel(imageCanvas, argv.channel, createFileName(game, options))
}

async function loadBaseImage(gameName) {
  return loadImage('games/' + game + '/' + game + '-blank.png')
}

async function loadFontImage(gameName) {
  return loadImage('games/' + game + '/' + game + '-font.png')
}

function sendCanvasToChannel(imageCanvas, channelName, imageName) {
  const client = new Client();
    client.on('ready', () => {
      console.log(client.channels.cache.map(channel => channel.name))
      const channel = client.channels.cache.find(channel => channel.name.startsWith(channelName))
      if (!channel) {
        throw 'Could not find channel with channel name'
      }
      const attachment = new MessageAttachment(imageCanvas.toBuffer(), imageName);
      console.log('sending ' + imageName + ' to ' + channel.name)
      channel.send('', attachment).finally(_ => client.destroy())
    })
    client.login(process.env.BOT_TOKEN)
}

function createFileName(game, options) {
  return game + '-' + Object.values(options).join("-") + '.png'
}

run()

/*fsp.readdir('games').then(games => getGame(argv, games)).then( ([game, fontInfo]) => {
  const loadImagePromise = loadImage('games/' + game + '/' + game + '-blank.png')
  const fontImagePromise = loadImage('games/' + game + '/' + game + '-font.png')

  Promise.all([loadImagePromise, fontImagePromise]).then((values) => {
    var baseImage = values[0]
    var fontImage = values[1]
    const selectedOptions = getSelectedOptions(argv)
    const options = buildOptions(selectedOptions, fontInfo)
    const imageCanvas = generateImage(text, options, fontInfo, baseImage, fontImage)
    //fsp.writeFile('test.png', imageCanvas.toBuffer())

    const client = new Client();
    client.on('ready', () => {
      const channel = client.channels.cache.get('666555950873706496')
      const attachment = new MessageAttachment(imageCanvas.toBuffer(), 'test.png');
      channel.send('', attachment).then(_ => client.destroy())
    })
    client.login(process.env.BOT_TOKEN)
  })
})*/


function getSelectedOptions(argv) {
  const selectedOptions = Object.assign({}, argv)
  delete selectedOptions._
  delete selectedOptions.$0
  delete selectedOptions.g
  delete selectedOptions.text
  delete selectedOptions.channel
  delete selectedOptions.wordwrap
  return selectedOptions
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

function buildOptions(argv, fontInfo) {
  const unselectedOptions = randomizeUnselectedOptions(Object.keys(argv), getValidGameOptions(fontInfo))
  return { ...argv, ...unselectedOptions }
}

function randomizeUnselectedOptions(providedOptions, options) {
  const unselectedOptions = Object.keys(options).filter(x => !providedOptions.includes(x));
  return Object.fromEntries(unselectedOptions.map(option => selectRandomOption(option, options)))
}

function selectRandomOption(option, options) {
  const optionEntries = options[option]
  return [option, optionEntries[Math.floor(Math.random() * optionEntries.length)]]
}

function generateImage() {

}

function generateImage(text, options, fontInfo, baseImage, fontImage) {
  const canvas = createCanvas(1000, 1000)
  renderText(canvas, fontInfo, baseImage, fontImage, text, options, false)
  return canvas
}